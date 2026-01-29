-- Migration: add verification_level and counters, plus triggers to maintain them
BEGIN;

-- Add columns if not present
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS verification_level text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS followers_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_count integer DEFAULT 0;

-- Function: compute verification level for a user
CREATE OR REPLACE FUNCTION public.compute_user_verification(p_user_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  fcount integer := 0;
  pcount integer := 0;
  cur_level text;
BEGIN
  -- read current aggregated values if present
  SELECT followers_count, posts_count, verification_level INTO fcount, pcount, cur_level
  FROM public.users WHERE id = p_user_id;

  -- if counts are null, compute them
  IF fcount IS NULL THEN
    SELECT count(*)::integer INTO fcount FROM public.followers WHERE following_id = p_user_id;
  END IF;
  IF pcount IS NULL THEN
    SELECT count(*)::integer INTO pcount FROM public.posts WHERE user_id = p_user_id;
  END IF;

  -- do not override an explicit manual 'verified' flag (admin-set)
  IF cur_level = 'verified' THEN
    -- still ensure counters are stored
    UPDATE public.users SET followers_count = COALESCE(fcount, 0), posts_count = COALESCE(pcount, 0) WHERE id = p_user_id;
    RETURN;
  END IF;

  -- Determine level by thresholds
  IF (COALESCE(fcount,0) >= 10000) OR (COALESCE(pcount,0) >= 500) THEN
    UPDATE public.users SET verification_level = 'influencer', followers_count = COALESCE(fcount,0), posts_count = COALESCE(pcount,0) WHERE id = p_user_id;
  ELSIF (COALESCE(fcount,0) >= 1000) OR (COALESCE(pcount,0) >= 100) THEN
    UPDATE public.users SET verification_level = 'popular', followers_count = COALESCE(fcount,0), posts_count = COALESCE(pcount,0) WHERE id = p_user_id;
  ELSIF (COALESCE(fcount,0) >= 100) OR (COALESCE(pcount,0) >= 25) THEN
    UPDATE public.users SET verification_level = 'rising', followers_count = COALESCE(fcount,0), posts_count = COALESCE(pcount,0) WHERE id = p_user_id;
  ELSE
    UPDATE public.users SET verification_level = 'new', followers_count = COALESCE(fcount,0), posts_count = COALESCE(pcount,0) WHERE id = p_user_id;
  END IF;
END;
$$;

-- Trigger function for followers table
CREATE OR REPLACE FUNCTION public.trg_followers_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  u uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    u := NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    u := OLD.following_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- handle case where following_id changed
    PERFORM public.compute_user_verification(OLD.following_id);
    u := NEW.following_id;
  ELSE
    RETURN NULL;
  END IF;

  PERFORM public.compute_user_verification(u);
  RETURN NULL;
END;
$$;

-- Trigger function for posts table
CREATE OR REPLACE FUNCTION public.trg_posts_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  u uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    u := NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    u := OLD.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.compute_user_verification(OLD.user_id);
    u := NEW.user_id;
  ELSE
    RETURN NULL;
  END IF;

  PERFORM public.compute_user_verification(u);
  RETURN NULL;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS followers_update_trigger ON public.followers;
CREATE TRIGGER followers_update_trigger
AFTER INSERT OR DELETE OR UPDATE ON public.followers
FOR EACH ROW EXECUTE FUNCTION public.trg_followers_update();

DROP TRIGGER IF EXISTS posts_update_trigger ON public.posts;
CREATE TRIGGER posts_update_trigger
AFTER INSERT OR DELETE OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.trg_posts_update();

-- Backfill existing counts and verification levels
-- Update counters
UPDATE public.users u
SET followers_count = COALESCE((SELECT count(*) FROM public.followers f WHERE f.following_id = u.id),0),
    posts_count = COALESCE((SELECT count(*) FROM public.posts p WHERE p.user_id = u.id),0);

-- Compute verification for all users
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.users LOOP
    PERFORM public.compute_user_verification(r.id);
  END LOOP;
END$$;

COMMIT;
