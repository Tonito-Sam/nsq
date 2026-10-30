ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS posts_tagged_user_ids_gin_idx
  ON public.posts USING gin (tagged_user_ids);