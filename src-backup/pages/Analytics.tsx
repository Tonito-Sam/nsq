
import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  Calendar,
  DollarSign
} from 'lucide-react';

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Mock data
  const engagementData = [
    { name: 'Mon', views: 4000, likes: 2400, comments: 400, shares: 240 },
    { name: 'Tue', views: 3000, likes: 1398, comments: 210, shares: 180 },
    { name: 'Wed', views: 2000, likes: 9800, comments: 290, shares: 320 },
    { name: 'Thu', views: 2780, likes: 3908, comments: 200, shares: 250 },
    { name: 'Fri', views: 1890, likes: 4800, comments: 181, shares: 190 },
    { name: 'Sat', views: 2390, likes: 3800, comments: 250, shares: 280 },
    { name: 'Sun', views: 3490, likes: 4300, comments: 310, shares: 300 },
  ];

  const audienceData = [
    { name: '18-24', value: 35, color: '#8884d8' },
    { name: '25-34', value: 28, color: '#82ca9d' },
    { name: '35-44', value: 20, color: '#ffc658' },
    { name: '45-54', value: 12, color: '#ff7300' },
    { name: '55+', value: 5, color: '#d084d0' },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 1200, orders: 45 },
    { month: 'Feb', revenue: 1500, orders: 52 },
    { month: 'Mar', revenue: 1800, orders: 64 },
    { month: 'Apr', revenue: 2200, orders: 78 },
    { month: 'May', revenue: 2600, orders: 85 },
    { month: 'Jun', revenue: 3100, orders: 92 },
  ];

  const topPosts = [
    { id: 1, title: "Amazing sunset photo", views: 15420, likes: 892, comments: 156 },
    { id: 2, title: "Tech review: Latest smartphone", views: 12300, likes: 674, comments: 89 },
    { id: 3, title: "Cooking tutorial", views: 9800, likes: 445, comments: 67 },
    { id: 4, title: "Travel vlog", views: 8600, likes: 398, comments: 45 },
    { id: 5, title: "Art process video", views: 7200, likes: 334, comments: 78 },
  ];

  const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          <span className={`${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {change}
          </span>{' '}
          from last period
        </p>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400">Track your performance and engagement</p>
          </div>
          <div className="flex items-center space-x-2">
            {['7d', '30d', '90d'].map((range) => (
              <Badge
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Badge>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Views"
            value="45.2K"
            change="+12.5%"
            icon={Eye}
            trend="up"
          />
          <StatCard
            title="Engagement Rate"
            value="8.4%"
            change="+2.1%"
            icon={Heart}
            trend="up"
          />
          <StatCard
            title="New Followers"
            value="324"
            change="+18.2%"
            icon={Users}
            trend="up"
          />
          <StatCard
            title="Revenue"
            value="$2,431"
            change="+5.8%"
            icon={DollarSign}
            trend="up"
          />
        </div>

        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="likes" stroke="#82ca9d" strokeWidth={2} />
                    <Line type="monotone" dataKey="comments" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Interactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="likes" fill="#8884d8" />
                      <Bar dataKey="comments" fill="#82ca9d" />
                      <Bar dataKey="shares" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topPosts.map((post, index) => (
                      <div key={post.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{post.title}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Eye className="h-3 w-3" />
                              <span>{post.views.toLocaleString()}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Heart className="h-3 w-3" />
                              <span>{post.likes}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <MessageCircle className="h-3 w-3" />
                              <span>{post.comments}</span>
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline">#{index + 1}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audience" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Age Demographics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={audienceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {audienceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Follower Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={engagementData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" stroke="#8884d8" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPosts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{post.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>{post.views.toLocaleString()} views</span>
                          <span>{post.likes} likes</span>
                          <span>{post.comments} comments</span>
                        </div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Analytics;
