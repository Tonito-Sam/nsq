-- Migration: create notifications and notification_preferences tables
-- Run this against your Postgres/Supabase database.

-- Make sure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Notifications table: stores events to be delivered in-app and by email
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NULL,
  type text NOT NULL,
  object_type text NULL,
  object_id text NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Ensure expected columns exist for older schemas: add columns if missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivered_email boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivered_inapp boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create indexes after ensuring columns exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_isread ON notifications (user_id, is_read);

-- Preferences per user (per-channel/topic preferences can be stored in JSON)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email_preferences jsonb DEFAULT '{}'::jsonb,
  inapp_preferences jsonb DEFAULT '{}'::jsonb,
  frequency text DEFAULT 'immediate', -- immediate|hourly|daily
  updated_at timestamptz DEFAULT now()
);

-- Ensure columns exist if table already existed without them
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS email_preferences jsonb DEFAULT '{}'::jsonb;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS inapp_preferences jsonb DEFAULT '{}'::jsonb;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'immediate';
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences (user_id);

-- Optional: add trigger to update `updated_at` on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS trg_notification_prefs_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
