-- Migration: Create studio_streams table for livestreams
CREATE TABLE IF NOT EXISTS studio_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES studio_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_live BOOLEAN DEFAULT FALSE,
    chat_enabled BOOLEAN DEFAULT TRUE,
  likes INTEGER DEFAULT 0,
  gifts JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_studio_streams_channel_id ON studio_streams(channel_id);

ALTER TABLE studio_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated" ON studio_streams
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow select for all" ON studio_streams
  FOR SELECT USING (true);
CREATE POLICY "Allow update for owner" ON studio_streams
  FOR UPDATE TO authenticated USING (auth.uid() = channel_id);
CREATE POLICY "Allow delete for owner" ON studio_streams
  FOR DELETE TO authenticated USING (auth.uid() = channel_id);

