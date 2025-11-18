-- Migration: Create conversation_participants table and unread count RPC
-- Run this in your Supabase SQL editor or using your migration tool.

create table if not exists public.conversation_participants (
  conversation_id uuid not null,
  user_id uuid not null,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

-- Index for efficient unread queries by user
create index if not exists idx_conversation_participants_user_last_read on public.conversation_participants (user_id, last_read_at);

-- RPC to get unread message count for a user across their conversations
create or replace function public.get_unread_count_for_user(p_user_id uuid)
returns bigint as $$
  select count(m.*)::bigint
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.conversation_participants p on p.conversation_id = c.id and p.user_id = p_user_id
  where m.sender_id <> p_user_id
    and (p.last_read_at is null or m.created_at > p.last_read_at);
$$ language sql stable;

-- Grant execute to anon role if desired (adjust per your RLS setup)
-- grant execute on function public.get_unread_count_for_user(uuid) to anon;
