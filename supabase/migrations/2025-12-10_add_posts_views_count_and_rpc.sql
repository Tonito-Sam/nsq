-- Migration: add views_count to posts and create RPC to increment it
-- Run this on your Supabase/Postgres instance with a service-role key

BEGIN;

-- Add column to store total impressions
ALTER TABLE IF EXISTS public.posts
ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- Create function to atomically increment views_count
-- Use UUID since `posts.id` is a UUID in this schema
CREATE OR REPLACE FUNCTION public.increment_post_views(pid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.posts
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = pid;
$$;

-- Ensure the function is executable by the anon role if you want public RPCs,
-- but in production you should call this via the service-role key only.
-- GRANT EXECUTE ON FUNCTION public.increment_post_views(bigint) TO anon;

COMMIT;
