-- Migration: Create studio_video_comments table for video comments
CREATE TABLE IF NOT EXISTS studio_video_comments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES studio_videos(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_studio_video_comments_video_id ON studio_video_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_studio_video_comments_user_id ON studio_video_comments(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE studio_video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated" ON studio_video_comments
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Allow select for authenticated" ON studio_video_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Allow update for owner" ON studio_video_comments
  FOR UPDATE
  USING (auth.uid()::uuid = user_id);

CREATE POLICY "Allow delete for owner" ON studio_video_comments
  FOR DELETE
  USING (auth.uid()::uuid = user_id);


