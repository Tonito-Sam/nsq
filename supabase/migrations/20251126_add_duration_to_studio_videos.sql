-- Add duration column to studio_videos so front-end can query by video length
ALTER TABLE IF EXISTS studio_videos
ADD COLUMN IF NOT EXISTS duration integer;
