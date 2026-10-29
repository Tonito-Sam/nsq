-- Migration: add comment_count column to studio_shows
ALTER TABLE IF EXISTS studio_shows
ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;

-- Backfill existing rows to 0 (if needed)
UPDATE studio_shows SET comment_count = 0 WHERE comment_count IS NULL;
