-- Migration: add email delivery retry metadata to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS email_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_email_attempt_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_email_error text NULL;

-- Add an index to help find undelivered notifications
CREATE INDEX IF NOT EXISTS idx_notifications_delivered_email_attempts ON notifications (delivered_email, email_attempts, created_at);
