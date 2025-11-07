-- Migration: add background audio metadata to posts
-- Adds columns to store background audio reference and mixing metadata

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS background_audio_url text,
  ADD COLUMN IF NOT EXISTS background_audio_meta jsonb,
  ADD COLUMN IF NOT EXISTS audio_mix_meta jsonb;

-- Optional: add indexes if you plan to query metadata fields
-- CREATE INDEX IF NOT EXISTS idx_posts_background_audio_url ON public.posts (background_audio_url);
