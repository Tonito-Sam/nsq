-- Add hashtags column to posts so typed hashtags are persisted
-- Column type: text[] (array of text) which matches the client code that writes an array of strings

BEGIN;

ALTER TABLE IF EXISTS public.posts
  ADD COLUMN IF NOT EXISTS hashtags text[];

-- Add a GIN index to accelerate searches on the hashtags array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_posts_hashtags_gin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_posts_hashtags_gin ON public.posts USING gin (hashtags)';
  END IF;
END$$;

COMMIT;
