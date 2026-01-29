import { supabase } from '@/integrations/supabase/client';

// In your search page or API endpoint
export const searchVideos = async (query: string): Promise<any[]> => {
  try {
    const { data } = await supabase
      .from('studio_videos')
      .select('*')
      .or(`title.ilike.%${query}%,caption.ilike.%${query}%,categories.cs.{${query}}`)
      .limit(50);
    return data || [];
  } catch (err) {
    console.error('searchVideos error', err);
    return [];
  }
};

export const searchChannels = async (query: string): Promise<any[]> => {
  try {
    const { data } = await supabase
      .from('studio_channels')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(50);
    return data || [];
  } catch (err) {
    console.error('searchChannels error', err);
    return [];
  }
};

export const searchCreators = async (query: string): Promise<any[]> => {
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(50);
    return data || [];
  } catch (err) {
    console.error('searchCreators error', err);
    return [];
  }
};