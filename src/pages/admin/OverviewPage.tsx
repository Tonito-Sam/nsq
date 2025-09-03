import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, UserCheck, MessageSquare, Flag, Activity } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { supabase } from '../../integrations/supabase/client';

const OverviewPage = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    bannedUsers: 0,
    totalPosts: 0,
    pendingReports: 0,
    todaySignups: 0,
    totalRevenue: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Users
        const { count: totalUsers } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true });
        const { count: activeUsers } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('privilege', 'user');
        const { count: suspendedUsers } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('privilege', 'suspended');
        const { count: bannedUsers } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('privilege', 'banned');
        // Posts
        const { count: totalPosts } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true });
        // Reports
        const { count: pendingReports } = await supabase
          .from('content_reports')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'pending']);
        // Today's signups
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todaySignups } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today.toISOString());
        // Revenue (placeholder)
        const totalRevenue = 0;
        setStats({
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          suspendedUsers: suspendedUsers || 0,
          bannedUsers: bannedUsers || 0,
          totalPosts: totalPosts || 0,
          pendingReports: pendingReports || 0,
          todaySignups: todaySignups || 0,
          totalRevenue
        });
        // Recent admin activities
        const { data: activities } = await supabase
          .from('admin_actions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        if (activities) setRecentActivities(activities);
      } catch (error) {
        // handle error if needed
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="py-16 text-center">Loading...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-100 to-white dark:from-gray-900 dark:to-black">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-5 w-5 text-purple-700" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+{stats.todaySignups} new today</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-100 to-white dark:from-gray-900 dark:to-black">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-5 w-5 text-green-700" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.totalUsers ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% active</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-gradient-to-br from-pink-100 to-white dark:from-gray-900 dark:to-black">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-5 w-5 text-pink-700" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalPosts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Platform content</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-100 to-white dark:from-gray-900 dark:to-black">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <Flag className="h-5 w-5 text-orange-700" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.pendingReports}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>
      {/* Recent Activities */}
      <Card className="shadow-lg border-0 mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-purple-700" />
            <span>Recent Admin Activities</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent activities</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {activity.action_type} • {new Date(activity.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{activity.target_type || 'System'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewPage;
