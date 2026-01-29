-- Migration: add free_until column to user_stores and grant 24 months free to existing stores
BEGIN;

ALTER TABLE public.user_stores
  ADD COLUMN IF NOT EXISTS free_until timestamptz DEFAULT NULL;

-- Grant 24 months free usage to all existing stores (set free_until to now() + 24 months)
UPDATE public.user_stores
SET free_until = now() + INTERVAL '24 months'
WHERE free_until IS NULL;

COMMIT;
