-- Migration: add share_to_feed boolean column to posts
-- Run this in your Supabase SQL editor or as part of migrations

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS share_to_feed boolean DEFAULT false;

-- Optionally update existing rows (no-op since default false)
-- UPDATE public.posts SET share_to_feed = false WHERE share_to_feed IS NULL;
