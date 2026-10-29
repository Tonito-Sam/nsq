-- Migration: create RPCs for atomic show counters
-- Creates functions: increment_show_views(show_id), increment_show_comments(show_id), decrement_show_comments(show_id)

-- Ensure previous versions are removed so return types can be changed safely
DROP FUNCTION IF EXISTS increment_show_views(uuid);
DROP FUNCTION IF EXISTS increment_show_comments(uuid);
DROP FUNCTION IF EXISTS decrement_show_comments(uuid);

-- Increment total_views atomically and return the new count
CREATE OR REPLACE FUNCTION increment_show_views(show_id uuid)
RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE studio_shows
  SET total_views = COALESCE(total_views, 0) + 1
  WHERE id = show_id
  RETURNING total_views INTO new_count;

  IF new_count IS NULL THEN
    -- no matching row
    RETURN 0;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Increment comment_count atomically and return the new count
CREATE OR REPLACE FUNCTION increment_show_comments(show_id uuid)
RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE studio_shows
  SET comment_count = COALESCE(comment_count, 0) + 1
  WHERE id = show_id
  RETURNING comment_count INTO new_count;

  IF new_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Decrement comment_count atomically (not below 0) and return the new count
CREATE OR REPLACE FUNCTION decrement_show_comments(show_id uuid)
RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE studio_shows
  SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
  WHERE id = show_id
  RETURNING comment_count INTO new_count;

  IF new_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
