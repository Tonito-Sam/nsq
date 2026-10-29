-- Migration: create show_likes table and toggle_show_like RPC
-- Ensures pgcrypto is available for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create per-user likes table
CREATE TABLE IF NOT EXISTS show_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES studio_shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (show_id, user_id)
);

-- Ensure any previous toggle function is removed so return type/behavior can be safely changed
DROP FUNCTION IF EXISTS toggle_show_like(uuid, uuid);

-- Atomic toggle for a user's like on a show.
-- Returns the new `like_count` value for the show after toggling.
CREATE OR REPLACE FUNCTION toggle_show_like(p_show_id uuid, p_user_id uuid)
RETURNS integer AS $$
DECLARE
  new_count integer;
  existing_id uuid;
BEGIN
  -- Check if the user already liked the show
  SELECT id INTO existing_id FROM show_likes WHERE show_id = p_show_id AND user_id = p_user_id FOR UPDATE;

  IF existing_id IS NOT NULL THEN
    -- remove like
    DELETE FROM show_likes WHERE id = existing_id;
    UPDATE studio_shows
    SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
    WHERE id = p_show_id
    RETURNING like_count INTO new_count;
  ELSE
    -- add like
    INSERT INTO show_likes (show_id, user_id) VALUES (p_show_id, p_user_id);
    UPDATE studio_shows
    SET like_count = COALESCE(like_count, 0) + 1
    WHERE id = p_show_id
    RETURNING like_count INTO new_count;
  END IF;

  IF new_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN new_count;
EXCEPTION WHEN unique_violation THEN
  -- Concurrent insert; treat as already liked and remove
  DELETE FROM show_likes WHERE show_id = p_show_id AND user_id = p_user_id;
  UPDATE studio_shows
  SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
  WHERE id = p_show_id
  RETURNING like_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated role if using Supabase (adjust roles as needed)
-- GRANT EXECUTE ON FUNCTION toggle_show_like(uuid, uuid) TO authenticated;
