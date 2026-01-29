import { supabase } from '../integrations/supabase/client';

type ShowInput = {
  id?: number;
  title: string;
  schedule_pattern?: string; // 'daily', 'weekdays', 'weekly', 'custom'
  time_slot_start?: string; // '08:00'
  time_slot_end?: string;   // '11:00'
  days_of_week?: string[] | string; // array or comma-separated
  is_vod_available?: boolean;
};

const normalizeDays = (val?: string[] | string) => {
  if (!val) return undefined;
  if (Array.isArray(val)) return val.map(d => d.toLowerCase());
  return val.split(',').map(s => s.trim().toLowerCase());
};

export const computeEpisodeSlots = (show: ShowInput, daysAhead = 7) => {
  const out: { broadcast_date: string; scheduled_time: string; end_time: string; title: string }[] = [];
  const pattern = (show.schedule_pattern || '').toLowerCase();
  const days = normalizeDays(show.days_of_week) || [];
  const today = new Date();
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    let airs = false;
    if (pattern === 'daily') airs = true;
    else if (pattern === 'weekdays') airs = ['monday','tuesday','wednesday','thursday','friday'].includes(dayName);
    else if (pattern === 'weekly') airs = days.length === 0 ? true : days.includes(dayName);
    else if (days.length > 0) airs = days.includes(dayName);
    else airs = !!show.time_slot_start; // if time provided, treat as one-off / scheduled

    if (airs) {
      const dateIso = d.toISOString().split('T')[0];
      const scheduled_time = `${dateIso}T${(show.time_slot_start || '00:00')}:00`;
      const end_time = `${dateIso}T${(show.time_slot_end || show.time_slot_start || '00:30')}:00`;
      out.push({ broadcast_date: dateIso, scheduled_time, end_time, title: `${show.title} - ${d.toLocaleDateString()}` });
    }
  }
  return out;
};

export const generateEpisodesForShow = async (showId: number, showData: ShowInput, daysAhead = 7) => {
  const slots = computeEpisodeSlots(showData, daysAhead);
  if (slots.length === 0) return { inserted: 0 };
  const episodes = slots.map(s => ({
    show_id: showId,
    title: s.title,
    scheduled_time: s.scheduled_time,
    end_time: s.end_time,
    is_active: true,
    broadcast_date: s.broadcast_date,
    is_vod_available: showData.is_vod_available !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase.from('studio_episodes').insert(episodes);
  if (error) throw error;
  return { inserted: data?.length || 0 };
};

export default generateEpisodesForShow;
