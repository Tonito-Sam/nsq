import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { 
  Users, UserCheck, MessageSquare, Flag, Activity, TrendingUp, 
  Shield, AlertCircle, DollarSign, Globe, Clock, BarChart3,
  CreditCard, Store, Package, ShoppingCart, CheckCircle, XCircle,
  UserPlus, Eye, Star, Heart, TrendingDown
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { supabase } from '../../integrations/supabase/client';
import { format } from 'date-fns';
import { Skeleton } from '../../components/ui/skeleton';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  // User stats
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  todaySignups: number;
  weekSignups: number;
  
  // Content stats
  totalPosts: number;
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  
  // System stats
  pendingReports: number;
  totalRevenue: number;
  avgSessionDuration: number;
  bounceRate: number;
  
  // Platform stats
  topCountry: string;
  popularCurrency: string;
  adminCount: number;
  
  // Growth metrics
  userGrowthRate: number;
  revenueGrowthRate: number;
  postGrowthRate: number;
}

interface ActivityItem {
  id: string;
  type: 'user' | 'post' | 'order' | 'report' | 'system' | 'admin';
  title: string;
  description: string;
  timestamp: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  metadata?: Record<string, any>;
}

interface ChartData {
  date: string;
  users: number;
  posts: number;
  revenue: number;
}

const OverviewPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    unverifiedUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    bannedUsers: 0,
    todaySignups: 0,
    weekSignups: 0,
    totalPosts: 0,
    totalStores: 0,
    totalProducts: 0,
    totalOrders: 0,
    pendingReports: 0,
    totalRevenue: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
    topCountry: 'N/A',
    popularCurrency: 'USD',
    adminCount: 0,
    userGrowthRate: 0,
    revenueGrowthRate: 0,
    postGrowthRate: 0
  });
  
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'activities'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserStats(),
        fetchContentStats(),
        fetchSystemStats(),
        fetchActivities(),
        fetchChartData()
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    
    // Determine verified users by calling the same RPC used in UsersPage (get_user_email_status)
    // This avoids using admin APIs from the browser which require a service role key.
    let verifiedUsers = 0;
    try {
      // Fetch all user ids (we only need ids to check verification)
      const { data: userIdsData, error: idError } = await supabase
        .from('users')
        .select('id');

      if (idError) throw idError;

      const ids = (userIdsData || []).map((u: any) => u.id) as string[];

      if (ids.length === 0) {
        verifiedUsers = 0;
      } else {
        // Call the RPC per user (same logic as UsersPage)
        const statusPromises = ids.map(async (userId) => {
          try {
            const { data } = await supabase.rpc('get_user_email_status', { user_id: userId });
            const payload = Array.isArray(data) ? data[0] : data;
            return !!(payload && (payload.is_verified || payload.is_verified === true));
          } catch (err) {
            return false;
          }
        });

        const results = await Promise.all(statusPromises);
        verifiedUsers = results.filter(Boolean).length;
      }
    } catch (err) {
      console.warn('Unable to compute verified users via RPC, falling back to false:', err);
      verifiedUsers = 0;
    }
    
    // User status counts
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
    
    const { count: adminCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('privilege', ['admin', 'superadmin']);
    
    // Today's signups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todaySignups } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    // Week's signups
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekSignups } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());
    
    // Top country
    const { data: countryData } = await supabase
      .from('users')
      .select('country')
      .not('country', 'is', null);
    
    const countryCounts = (countryData || []).reduce((acc: Record<string, number>, user) => {
      acc[user.country] = (acc[user.country] || 0) + 1;
      return acc;
    }, {});
    
    const topCountry = Object.entries(countryCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
    
    // Popular currency
    const { data: currencyData } = await supabase
      .from('users')
      .select('currency')
      .not('currency', 'is', null);
    
    const currencyCounts = (currencyData || []).reduce((acc: Record<string, number>, user) => {
      const currency = user.currency || 'USD';
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {});
    
    const popularCurrency = Object.entries(currencyCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'USD';

    setStats(prev => ({
      ...prev,
      totalUsers: totalUsers || 0,
      verifiedUsers,
      unverifiedUsers: (totalUsers || 0) - verifiedUsers,
      activeUsers: activeUsers || 0,
      suspendedUsers: suspendedUsers || 0,
      bannedUsers: bannedUsers || 0,
      todaySignups: todaySignups || 0,
      weekSignups: weekSignups || 0,
      adminCount: adminCount || 0,
      topCountry,
      popularCurrency
    }));
  };

  const fetchContentStats = async () => {
    // Posts
    const { count: totalPosts } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true });
    
    // Stores
    const { count: totalStores } = await supabase
      .from('user_stores')
      .select('id', { count: 'exact', head: true });
    
    // Products (use store_products table which holds product records per store)
    const { count: totalProducts } = await supabase
      .from('store_products')
      .select('id', { count: 'exact', head: true });
    
    // Orders
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });
    
    setStats(prev => ({
      ...prev,
      totalPosts: totalPosts || 0,
      totalStores: totalStores || 0,
      totalProducts: totalProducts || 0,
      totalOrders: totalOrders || 0
    }));
  };

  const fetchSystemStats = async () => {
    // Pending reports
    const { count: pendingReports } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'pending']);
    
    // Total revenue (sum of all successful orders)
    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount, status')
      .eq('status', 'completed');
    
    const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    
    // Growth rates (simplified calculation)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const { count: lastMonthUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', lastMonth.toISOString());
    
    const currentUsers = stats.totalUsers;
    const userGrowthRate = lastMonthUsers ? ((currentUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;
    
    setStats(prev => ({
      ...prev,
      pendingReports: pendingReports || 0,
      totalRevenue,
      userGrowthRate: Math.round(userGrowthRate * 100) / 100,
      revenueGrowthRate: 12.5, // Placeholder
      postGrowthRate: 8.3, // Placeholder
      avgSessionDuration: 4.5, // Placeholder (minutes)
      bounceRate: 32.1 // Placeholder (%)
    }));
  };

  const fetchActivities = async () => {
    const activities: ActivityItem[] = [];
    
    // Recent signups (last 10)
    const { data: recentSignups } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    recentSignups?.forEach(user => {
      activities.push({
        id: user.id,
        type: 'user',
        title: 'New User Registration',
        description: `${user.first_name || user.email} joined the platform`,
        timestamp: user.created_at,
        user_id: user.id,
        user_name: `${user.first_name} ${user.last_name}`.trim() || user.email,
        metadata: { email: user.email }
      });
    });
    
    // Recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, created_at, user_id, users(email, first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    recentOrders?.forEach(order => {
      const user = order.users as any;
      activities.push({
        id: order.id,
        type: 'order',
        title: 'New Order Placed',
        description: `Order #${order.order_number} for $${order.total_amount?.toFixed(2)}`,
        timestamp: order.created_at,
        user_id: order.user_id,
        user_name: user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown',
        metadata: { amount: order.total_amount, orderNumber: order.order_number }
      });
    });
    
    // Recent admin actions
    const { data: adminActions } = await supabase
      .from('admin_actions')
      .select('id, action_type, reason, created_at, admin_id, user_id, admin:users!admin_actions_admin_id_fkey(email), target_user:users!admin_actions_user_id_fkey(email)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    adminActions?.forEach(action => {
      activities.push({
        id: action.id,
        type: 'admin',
        title: 'Admin Action',
        description: `${action.action_type.replace(/_/g, ' ')} by ${(action.admin as any)?.email || 'Admin'}`,
        timestamp: action.created_at,
        metadata: { actionType: action.action_type, reason: action.reason }
      });
    });
    
    // Recent reports
    const { data: recentReports } = await supabase
      .from('content_reports')
      .select('id, report_type, status, created_at, reporter_id, users(email)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    recentReports?.forEach(report => {
      activities.push({
        id: report.id,
        type: 'report',
        title: 'Content Report',
        description: `${report.report_type} reported by ${(report.users as any)?.email || 'Anonymous'}`,
        timestamp: report.created_at,
        metadata: { type: report.report_type, status: report.status }
      });
    });
    
    // Sort by timestamp and limit to 15
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
    
    setRecentActivities(sortedActivities);
  };

  const fetchChartData = async () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data: ChartData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'MMM dd');
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get user signups for this day
      const { count: dailyUsers } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      // Get posts for this day
      const { count: dailyPosts } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      // Get revenue for this day
      const { data: dailyOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
      
      const dailyRevenue = dailyOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      
      data.push({
        date: dateStr,
        users: dailyUsers || 0,
        posts: dailyPosts || 0,
        revenue: dailyRevenue
      });
    }
    
    setChartData(data);
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user': return <UserPlus className="h-4 w-4" />;
      case 'post': return <MessageSquare className="h-4 w-4" />;
      case 'order': return <ShoppingCart className="h-4 w-4" />;
      case 'report': return <AlertCircle className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user': return 'text-blue-600 bg-blue-50';
      case 'post': return 'text-green-600 bg-green-50';
      case 'order': return 'text-purple-600 bg-purple-50';
      case 'report': return 'text-orange-600 bg-orange-50';
      case 'admin': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your platform today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <Clock className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={stats.userGrowthRate >= 0 ? "default" : "destructive"} className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                {stats.userGrowthRate >= 0 ? '+' : ''}{stats.userGrowthRate}%
              </Badge>
              <p className="text-xs text-muted-foreground">+{stats.todaySignups} today</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedUsers.toLocaleString()}</div>
            <div className="space-y-2 mt-1">
              <Progress value={(stats.verifiedUsers / stats.totalUsers) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.verifiedUsers / stats.totalUsers) * 100) || 0}% verification rate
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{stats.revenueGrowthRate}%
              </Badge>
              <p className="text-xs text-muted-foreground">from last month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingReports}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Platform Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-xl font-bold">{stats.totalPosts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-xl font-bold">{stats.totalStores.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Stores</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-xl font-bold">{stats.totalProducts.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
              <div className="text-center p-3 border rounded-lg">
                <div className="text-xl font-bold">{stats.totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Active Users</span>
                <span className="font-medium">{stats.activeUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Administrators</span>
                <span className="font-medium">{stats.adminCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Top Country</span>
                <span className="font-medium">{stats.topCountry}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Popular Currency</span>
                <span className="font-medium">{stats.popularCurrency}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Platform Growth ({timeRange.toUpperCase()})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={timeRange === '7d' ? 'default' : 'outline'}
                onClick={() => setTimeRange('7d')}
              >
                7D
              </Button>
              <Button
                size="sm"
                variant={timeRange === '30d' ? 'default' : 'outline'}
                onClick={() => setTimeRange('30d')}
              >
                30D
              </Button>
              <Button
                size="sm"
                variant={timeRange === '90d' ? 'default' : 'outline'}
                onClick={() => setTimeRange('90d')}
              >
                90D
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="#93c5fd" name="Users" />
                  <Area type="monotone" dataKey="posts" stroke="#10b981" fill="#a7f3d0" name="Posts" />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#c4b5fd" name="Revenue ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.activeUsers.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Active</p>
              <Badge variant="outline" className="mt-2">Normal</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.suspendedUsers.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Suspended</p>
              <Badge variant="secondary" className="mt-2">Temporary</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.bannedUsers.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Banned</p>
              <Badge variant="destructive" className="mt-2">Permanent</Badge>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.unverifiedUsers.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Unverified</p>
              <Badge variant="outline" className="mt-2">Email Pending</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Recent Platform Activities
            </CardTitle>
            <CardDescription>
              Latest actions and events across the platform
            </CardDescription>
          </div>
          <Badge variant="outline">{recentActivities.length} activities</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent activities to display
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{activity.title}</p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                    {activity.user_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        By {activity.user_name}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(activity.timestamp), 'MMM dd, h:mm a')}
                      </span>
                      {activity.metadata?.amount && (
                        <span className="text-xs font-medium text-green-600">
                          ${activity.metadata.amount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <div className="text-xl font-bold">{stats.weekSignups}</div>
          <p className="text-sm text-muted-foreground">Signups this week</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-xl font-bold">{Math.round(stats.avgSessionDuration)}min</div>
          <p className="text-sm text-muted-foreground">Avg. session</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-xl font-bold">{stats.bounceRate}%</div>
          <p className="text-sm text-muted-foreground">Bounce rate</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <div className="text-xl font-bold">{stats.postGrowthRate}%</div>
          <p className="text-sm text-muted-foreground">Content growth</p>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;