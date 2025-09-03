import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle, HelpCircle, XCircle, Eye } from 'lucide-react';

interface SidebarEventAnalyticsProps {
  eventId: string;
}

export const SidebarEventAnalytics: React.FC<SidebarEventAnalyticsProps> = ({ eventId }) => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [views, setViews] = useState<number>(0);
  const [attendanceStats, setAttendanceStats] = useState<{yes: number, notSure: number, no: number}>({yes: 0, notSure: 0, no: 0});

  useEffect(() => {
    fetchAttendees();
    fetchViews();
    fetchAttendanceStats();
  }, [eventId]);

  const fetchAttendees = async () => {
    const { data } = await supabase
      .from('event_attendance')
      .select('user_id, status, users (username, first_name, last_name, avatar_url)')
      .eq('event_id', eventId)
      .eq('status', 'going');
    setAttendees(data || []);
  };

  const fetchViews = async () => {
    const { count } = await supabase
      .from('event_views')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    setViews(count || 0);
  };

  const fetchAttendanceStats = async () => {
    const { data } = await supabase
      .from('event_attendance')
      .select('status')
      .eq('event_id', eventId);
    setAttendanceStats({
      yes: data?.filter((a: any) => a.status === 'going').length || 0,
      notSure: data?.filter((a: any) => a.status === 'maybe').length || 0,
      no: data?.filter((a: any) => a.status === 'not_going').length || 0,
    });
  };

  return (
    <div className="mt-4 p-3 rounded-lg bg-muted border border-gray-200 dark:border-gray-700">
      <div className="mb-2 flex w-full justify-between items-end">
        <div className="flex flex-col items-center flex-1">
          <CheckCircle className="w-5 h-5 mb-1 text-green-600 dark:text-green-400" />
          <span className="text-lg font-bold text-green-600 dark:text-green-400">{attendanceStats.yes}</span>
          <span className="text-xs text-muted-foreground">Yes</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <HelpCircle className="w-5 h-5 mb-1 text-yellow-600 dark:text-yellow-400" />
          <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{attendanceStats.notSure}</span>
          <span className="text-xs text-muted-foreground">Not Sure</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <XCircle className="w-5 h-5 mb-1 text-red-600 dark:text-red-400" />
          <span className="text-lg font-bold text-red-600 dark:text-red-400">{attendanceStats.no}</span>
          <span className="text-xs text-muted-foreground">No</span>
        </div>
        <div className="flex flex-col items-center flex-1">
          <Eye className="w-5 h-5 mb-1 text-pink-600 dark:text-pink-400" />
          <span className="text-lg font-bold text-pink-600 dark:text-pink-400">{views}</span>
          <span className="text-xs text-muted-foreground">Views</span>
        </div>
      </div>
      <div>
        <h4 className="font-semibold mb-2 text-sm">Attendees (Yes)</h4>
        <div className="flex flex-wrap gap-2">
          {attendees.length === 0 && <span className="text-xs text-muted-foreground">No attendees yet.</span>}
          {attendees.length > 0 && attendees.map(a => (
            <div key={a.user_id} className="flex items-center gap-2 bg-background rounded px-2 py-1">
              <Avatar className="w-6 h-6">
                <AvatarImage src={a.users?.avatar_url} />
                <AvatarFallback>{a.users?.first_name?.[0] || a.users?.username?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{a.users?.first_name || ''} {a.users?.last_name || ''} (@{a.users?.username})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
