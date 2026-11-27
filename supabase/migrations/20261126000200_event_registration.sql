ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS event_registration_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_logo text,
  ADD COLUMN IF NOT EXISTS event_organizer_phone text,
  ADD COLUMN IF NOT EXISTS event_organizer_website text;

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  phone text,
  custom_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_registrations_post_user_key UNIQUE (post_id, user_id),
  CONSTRAINT event_registrations_custom_answers_array CHECK (jsonb_typeof(custom_answers) = 'array')
);

CREATE INDEX IF NOT EXISTS event_registrations_post_created_idx
  ON public.event_registrations (post_id, created_at);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_registrations TO authenticated;
REVOKE ALL ON TABLE public.event_registrations FROM anon;

DROP POLICY IF EXISTS event_registrations_select_attendee_or_owner ON public.event_registrations;
CREATE POLICY event_registrations_select_attendee_or_owner
  ON public.event_registrations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.posts AS event_post
      WHERE event_post.id = event_registrations.post_id
        AND event_post.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS event_registrations_insert_self ON public.event_registrations;
CREATE POLICY event_registrations_insert_self
  ON public.event_registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.posts AS event_post
      WHERE event_post.id = event_registrations.post_id
        AND event_post.post_type = 'event'
    )
  );

DROP POLICY IF EXISTS event_registrations_update_self ON public.event_registrations;
CREATE POLICY event_registrations_update_self
  ON public.event_registrations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.posts AS event_post
      WHERE event_post.id = event_registrations.post_id
        AND event_post.post_type = 'event'
    )
  );

DROP POLICY IF EXISTS event_registrations_delete_self ON public.event_registrations;
CREATE POLICY event_registrations_delete_self
  ON public.event_registrations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
