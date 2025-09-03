-- Supabase SQL for post_views table
create table if not exists post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  viewed_at timestamp with time zone default now(),
  constraint unique_post_user unique (post_id, user_id)
);

-- Index for fast lookup
create index if not exists idx_post_views_post_id on post_views(post_id);
create index if not exists idx_post_views_user_id on post_views(user_id);
