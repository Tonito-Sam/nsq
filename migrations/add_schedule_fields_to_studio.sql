-- Add schedule-related fields to studio_shows and studio_episodes
-- Run this migration against your Postgres DB (e.g. supabase) to enable scheduling features

ALTER TABLE IF EXISTS studio_shows
  ADD COLUMN IF NOT EXISTS schedule_pattern VARCHAR(50), -- 'daily','weekdays','weekly','custom'
  ADD COLUMN IF NOT EXISTS time_slot_start TIME,
  ADD COLUMN IF NOT EXISTS time_slot_end TIME,
  ADD COLUMN IF NOT EXISTS days_of_week TEXT,
  ADD COLUMN IF NOT EXISTS is_rerun BOOLEAN DEFAULT false,
  -- `studio_shows.id` in this project is UUID; ensure FK matches that type
  ADD COLUMN IF NOT EXISTS original_show_id UUID REFERENCES studio_shows(id),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE IF EXISTS studio_episodes
  ADD COLUMN IF NOT EXISTS broadcast_date DATE,
  ADD COLUMN IF NOT EXISTS is_vod_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS vod_expiry_date DATE;

-- Note: `days_of_week` stored as TEXT (comma-separated) for compatibility with existing clients.
