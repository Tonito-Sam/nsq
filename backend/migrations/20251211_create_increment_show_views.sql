-- Create RPC to increment studio_shows.views safely
CREATE OR REPLACE FUNCTION public.increment_show_views(p_show_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.studio_shows
  SET views = COALESCE(views, 0) + 1,
      updated_at = now()
  WHERE id = p_show_id;
  RETURN;
END;
$$;
