-- Migration: add like_count column to studio_shows
ALTER TABLE IF EXISTS studio_shows
ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;

-- Backfill existing rows to 0 (if needed)
UPDATE studio_shows SET like_count = 0 WHERE like_count IS NULL;
