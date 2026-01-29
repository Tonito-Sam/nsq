-- Seed TV-style shows and auto-generate episodes for next 7 days
-- Run this in your Supabase SQL editor to create sample shows and episodes for testing.

BEGIN;

-- Breakfast Show (weekdays)
WITH s AS (
  INSERT INTO studio_shows (title, description, video_url, thumbnail_url, duration, is_live, is_active, created_by, created_at, updated_at, scheduled_time, schedule_pattern, time_slot_start, time_slot_end, days_of_week, category)
  VALUES (
    'Mic''d Podcast Breakfast Show',
    'Morning breakfast show - news, chat and interviews',
    '',
    '',
    180,
    false,
    true,
    NULL,
    now(), now(),
    now(),
    'weekdays', '08:00', '11:00', 'monday,tuesday,wednesday,thursday,friday', 'podcast'
   ) RETURNING id, title, duration
)
INSERT INTO studio_episodes (show_id, title, episode_number, duration, scheduled_time, end_time, is_active, broadcast_date, is_vod_available, created_at, updated_at)
  SELECT s.id,
         s.title || ' - ' || to_char(d, 'YYYY-MM-DD'),
         row_number() OVER (PARTITION BY s.id ORDER BY d) as episode_number,
         s.duration,
         (d::date + time '08:00')::timestamptz,
         (d::date + time '11:00')::timestamptz,
         true,
         d::date,
         true,
         now(), now()
FROM s, generate_series(current_date, current_date + interval '6 days', interval '1 day') d
WHERE EXTRACT(ISODOW FROM d) BETWEEN 1 AND 5;

-- Fanalysis (daily 11:30-12:00)
WITH s AS (
  INSERT INTO studio_shows (title, description, video_url, thumbnail_url, duration, is_live, is_active, created_by, created_at, updated_at, scheduled_time, schedule_pattern, time_slot_start, time_slot_end, category)
  VALUES (
    'Fanalysis',
    'Daily sports talk and analysis',
    '',
    '',
    30,
    false,
    true,
    NULL,
    now(), now(),
    now(),
    'daily', '11:30', '12:00', 'sports'
   ) RETURNING id, title, duration
)
INSERT INTO studio_episodes (show_id, title, episode_number, duration, scheduled_time, end_time, is_active, broadcast_date, is_vod_available, created_at, updated_at)
  SELECT s.id,
         s.title || ' - ' || to_char(d, 'YYYY-MM-DD'),
         row_number() OVER (PARTITION BY s.id ORDER BY d) as episode_number,
         s.duration,
         (d::date + time '11:30')::timestamptz,
         (d::date + time '12:00')::timestamptz,
         true,
         d::date,
         true,
         now(), now()
FROM s, generate_series(current_date, current_date + interval '6 days', interval '1 day') d;

-- Mid-day groove (daily 12:00-14:00)
WITH s AS (
  INSERT INTO studio_shows (title, description, video_url, thumbnail_url, duration, is_live, is_active, created_by, created_at, updated_at, scheduled_time, schedule_pattern, time_slot_start, time_slot_end, category)
  VALUES (
    'Mid-day groove',
    'Music playlist and mixes for midday',
    '',
    '',
    120,
    false,
    true,
    NULL,
    now(), now(),
    now(),
    'daily', '12:00', '14:00', 'music'
   ) RETURNING id, title, duration
)
INSERT INTO studio_episodes (show_id, title, episode_number, duration, scheduled_time, end_time, is_active, broadcast_date, is_vod_available, created_at, updated_at)
  SELECT s.id,
         s.title || ' - ' || to_char(d, 'YYYY-MM-DD'),
         row_number() OVER (PARTITION BY s.id ORDER BY d) as episode_number,
         s.duration,
         (d::date + time '12:00')::timestamptz,
         (d::date + time '14:00')::timestamptz,
         true,
         d::date,
         true,
         now(), now()
FROM s, generate_series(current_date, current_date + interval '6 days', interval '1 day') d;

-- Perspective (weekly mon/wed/fri 18:00-20:00)
WITH s AS (
  INSERT INTO studio_shows (title, description, video_url, thumbnail_url, duration, is_live, is_active, created_by, created_at, updated_at, scheduled_time, schedule_pattern, time_slot_start, time_slot_end, days_of_week, category)
  VALUES (
    'Perspective',
    'Evening topical discussions and guest interviews',
    '',
    '',
    120,
    false,
    true,
    NULL,
    now(), now(),
    now(),
    'weekly', '18:00', '20:00', 'monday,wednesday,friday', 'talk'
   ) RETURNING id, title, days_of_week, duration
)
INSERT INTO studio_episodes (show_id, title, episode_number, duration, scheduled_time, end_time, is_active, broadcast_date, is_vod_available, created_at, updated_at)
  SELECT s.id,
         s.title || ' - ' || to_char(d, 'YYYY-MM-DD'),
         row_number() OVER (PARTITION BY s.id ORDER BY d) as episode_number,
         s.duration,
         (d::date + time '18:00')::timestamptz,
         (d::date + time '20:00')::timestamptz,
         true,
         d::date,
         true,
         now(), now()
FROM s, generate_series(current_date, current_date + interval '6 days', interval '1 day') d
WHERE to_char(d, 'FMDay') ILIKE ANY (string_to_array(s.days_of_week, ','));

COMMIT;
