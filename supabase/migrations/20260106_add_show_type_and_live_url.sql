-- Migration: add show_type and live_url to studio_shows
-- Date: 2026-01-06

ALTER TABLE public.studio_shows
  ADD COLUMN IF NOT EXISTS show_type text DEFAULT 'show',
  ADD COLUMN IF NOT EXISTS live_url text;

-- Optional: create index on show_type for faster queries
CREATE INDEX IF NOT EXISTS idx_studio_shows_show_type ON public.studio_shows (show_type);
