ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_slug text;

UPDATE public.posts
SET event_slug =
  COALESCE(
    NULLIF(
      trim(both '-' FROM regexp_replace(lower(COALESCE(content, '')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'event'
  ) || '-' || left(id::text, 8)
WHERE post_type = 'event'
  AND (event_slug IS NULL OR btrim(event_slug) = '');

CREATE UNIQUE INDEX IF NOT EXISTS posts_event_slug_unique
  ON public.posts (event_slug)
  WHERE event_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
BEGIN
  IF NEW.post_type = 'event' AND (NEW.event_slug IS NULL OR btrim(NEW.event_slug) = '') THEN
    base_slug := COALESCE(
      NULLIF(
        trim(both '-' FROM regexp_replace(lower(COALESCE(NEW.content, '')), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'event'
    );
    NEW.event_slug := base_slug || '-' || left(NEW.id::text, 8);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_assign_event_slug ON public.posts;
CREATE TRIGGER posts_assign_event_slug
  BEFORE INSERT OR UPDATE OF event_slug, post_type, content
  ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_event_slug();

DROP POLICY IF EXISTS public_event_posts_read ON public.posts;
CREATE POLICY public_event_posts_read
  ON public.posts
  FOR SELECT
  TO anon, authenticated
  USING (
    post_type = 'event'
    AND privacy = 'public'
    AND event_slug IS NOT NULL
  );

ALTER TABLE public.event_registrations
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN username DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_guest_email_unique
  ON public.event_registrations (post_id, lower(btrim(email)))
  WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION public.register_guest_event(
  p_post_id uuid,
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_custom_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  custom_answers jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_questions jsonb;
  registration_answers jsonb := COALESCE(p_custom_answers, '[]'::jsonb);
  answer_count integer;
BEGIN
  IF p_full_name IS NULL OR length(btrim(p_full_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Enter your full name.';
  END IF;

  IF p_email IS NULL OR btrim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.';
  END IF;

  IF p_phone IS NOT NULL AND length(btrim(p_phone)) > 50 THEN
    RAISE EXCEPTION 'Phone number is too long.';
  END IF;

  SELECT COALESCE(event_registration_fields, '[]'::jsonb)
  INTO event_questions
  FROM public.posts
  WHERE id = p_post_id
    AND post_type = 'event'
    AND privacy = 'public'
    AND (event_date IS NULL OR event_date >= now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event is not available for registration.';
  END IF;

  IF jsonb_typeof(event_questions) <> 'array'
    OR jsonb_typeof(registration_answers) <> 'array' THEN
    RAISE EXCEPTION 'Invalid registration answers.';
  END IF;

  answer_count := jsonb_array_length(registration_answers);
  IF answer_count <> jsonb_array_length(event_questions) THEN
    RAISE EXCEPTION 'Complete all event registration questions.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(registration_answers) AS answer(value)
    WHERE jsonb_typeof(answer.value) <> 'string'
      OR btrim(answer.value #>> '{}') = ''
      OR length(answer.value #>> '{}') > 1000
  ) THEN
    RAISE EXCEPTION 'Complete all event registration questions.';
  END IF;

  RETURN QUERY
  INSERT INTO public.event_registrations AS registration (
    post_id,
    user_id,
    full_name,
    username,
    email,
    phone,
    custom_answers
  )
  VALUES (
    p_post_id,
    NULL,
    btrim(p_full_name),
    NULL,
    lower(btrim(p_email)),
    NULLIF(btrim(p_phone), ''),
    registration_answers
  )
  RETURNING
    registration.id,
    registration.full_name,
    registration.username,
    registration.email,
    registration.phone,
    registration.custom_answers,
    registration.created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This email is already registered for this event.'
      USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_event_registration(
  p_registration_id uuid,
  p_email text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  custom_answers jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    registration.id,
    registration.full_name,
    registration.username,
    registration.email,
    registration.phone,
    registration.custom_answers,
    registration.created_at
  FROM public.event_registrations AS registration
  WHERE registration.id = p_registration_id
    AND registration.user_id IS NULL
    AND lower(btrim(registration.email)) = lower(btrim(p_email));
$$;

CREATE OR REPLACE FUNCTION public.claim_guest_event_registration(
  p_registration_id uuid
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  email text,
  phone text,
  custom_answers jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  signed_in_user_id uuid := auth.uid();
  verified_email text;
  email_is_verified boolean;
  resolved_username text;
BEGIN
  IF signed_in_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to claim this event registration.';
  END IF;

  SELECT
    lower(auth_user.email),
    auth_user.email_confirmed_at IS NOT NULL,
    COALESCE(app_user.username, auth_user.raw_user_meta_data ->> 'username', split_part(auth_user.email, '@', 1))
  INTO verified_email, email_is_verified, resolved_username
  FROM auth.users AS auth_user
  LEFT JOIN public.users AS app_user ON app_user.id = auth_user.id
  WHERE auth_user.id = signed_in_user_id;

  IF NOT FOUND OR NOT email_is_verified THEN
    RAISE EXCEPTION 'Confirm your account email before claiming this registration.';
  END IF;

  UPDATE public.event_registrations AS registration
  SET user_id = signed_in_user_id,
      username = resolved_username
  WHERE registration.id = p_registration_id
    AND registration.user_id IS NULL
    AND lower(btrim(registration.email)) = verified_email;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.event_registrations AS registration
      WHERE registration.id = p_registration_id
        AND registration.user_id = signed_in_user_id
    ) THEN
      RETURN QUERY
      SELECT
        registration.id,
        registration.full_name,
        registration.username,
        registration.email,
        registration.phone,
        registration.custom_answers,
        registration.created_at
      FROM public.event_registrations AS registration
      WHERE registration.id = p_registration_id;
      RETURN;
    END IF;

    RAISE EXCEPTION 'This registration does not match your verified account email.';
  END IF;

  RETURN QUERY
  SELECT
    registration.id,
    registration.full_name,
    registration.username,
    registration.email,
    registration.phone,
    registration.custom_answers,
    registration.created_at
  FROM public.event_registrations AS registration
  WHERE registration.id = p_registration_id
    AND registration.user_id = signed_in_user_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Your account already has a registration for this event.'
      USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.register_guest_event(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guest_event(uuid, text, text, text, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_guest_event_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_event_registration(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.claim_guest_event_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_guest_event_registration(uuid) TO authenticated;
