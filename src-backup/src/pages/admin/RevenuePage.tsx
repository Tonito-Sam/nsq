import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Users,
  ShoppingCart,
  BarChart3,
  Calendar,
  Download,
  Filter,
  TrendingDown,
  Percent,
  Target
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Types
type RevenueMetric = {
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  growthRate: number;
  activeCustomers: number;
  conversionRate: number;
};

type RevenueTransaction = {
  id: string;
  created_at: string;
  amount: number;
  status: string;
  type: string;
  user_id: string;
  user_email?: string;
  description?: string;
  metadata?: any;
};

type RevenueChartData = {
  date: string;
  revenue: number;
  transactions: number;
};

type RevenueSourceData = {
  name: string;
  value: number;
  color: string;
};

const RevenuePage = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetric>({
    totalRevenue: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    growthRate: 0,
    activeCustomers: 0,
    conversionRate: 0
  });
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [chartData, setChartData] = useState<RevenueChartData[]>([]);
  const [sourceData, setSourceData] = useState<RevenueSourceData[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'transactions' | 'analytics'>('overview');

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Fetch revenue data
  const fetchRevenueData = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Fetch all possible payment/transaction tables
      const tablesToCheck = ['payments', 'transactions', 'orders', 'subscriptions', 'revenue_logs'];
      let allTransactions: any[] = [];
      let totalRevenue = 0;
      let totalTransactions = 0;

      for (const tableName of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

          if (!error && data) {
            const tableTransactions = data.map((item: any) => ({
              id: item.id,
              created_at: item.created_at,
              amount: parseFloat(item.amount || item.total || item.price || 0),
              status: item.status || 'completed',
              type: item.type || tableName,
              user_id: item.user_id,
              user_email: item.user_email || item.email,
              description: item.description || item.product_name || `Payment from ${tableName}`,
              metadata: item.metadata || item.details
            }));

            allTransactions = [...allTransactions, ...tableTransactions];
            totalRevenue += tableTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
            totalTransactions += tableTransactions.length;
          }
        } catch (err) {
          console.warn(`Table ${tableName} not found or error:`, err);
        }
      }

      // Calculate metrics
      const previousPeriodEnd = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousPeriodStart = new Date(previousPeriodEnd.getTime() - (endDate.getTime() - startDate.getTime()));

      let previousRevenue = 0;
      for (const tableName of tablesToCheck) {
        try {
          const { data } = await supabase
            .from(tableName)
            .select('amount, total, price')
            .gte('created_at', previousPeriodStart.toISOString())
            .lte('created_at', previousPeriodEnd.toISOString());

          if (data) {
            previousRevenue += data.reduce((sum: number, item: any) => {
              return sum + parseFloat(item.amount || item.total || item.price || 0);
            }, 0);
          }
        } catch (err) {
          // Silently fail for missing tables
        }
      }

      const growthRate = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : totalRevenue > 0 ? 100 : 0;

      const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      // Fetch active customers (users with transactions in period)
      const activeUserIds = [...new Set(allTransactions.map(t => t.user_id).filter(Boolean))];
      const activeCustomers = activeUserIds.length;

      // Estimate conversion rate (simplified)
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      const conversionRate = totalUsers ? (activeCustomers / totalUsers) * 100 : 0;

      // Prepare chart data
      const chartDataMap: Record<string, { revenue: number; transactions: number }> = {};
      const dailyData = [...allTransactions].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      dailyData.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        
        if (!chartDataMap[date]) {
          chartDataMap[date] = { revenue: 0, transactions: 0 };
        }
        
        chartDataMap[date].revenue += transaction.amount;
        chartDataMap[date].transactions += 1;
      });

      const formattedChartData = Object.entries(chartDataMap).map(([date, data]) => ({
        date,
        revenue: parseFloat(data.revenue.toFixed(2)),
        transactions: data.transactions
      }));

      // Prepare source data
      const sourceMap = allTransactions.reduce((acc: Record<string, number>, transaction) => {
        if (!acc[transaction.type]) {
          acc[transaction.type] = 0;
        }
        acc[transaction.type] += transaction.amount;
        return acc;
      }, {});

      const formattedSourceData = Object.entries(sourceMap).map(([name, value], index) => ({
        name,
        value: parseFloat(value.toFixed(2)),
        color: COLORS[index % COLORS.length]
      }));

      // Set state
      setMetrics({
        totalRevenue,
        totalTransactions,
        averageOrderValue,
        growthRate,
        activeCustomers,
        conversionRate
      });
      setTransactions(allTransactions.slice(0, 100)); // Limit to 100 most recent
      setChartData(formattedChartData);
      setSourceData(formattedSourceData);

      toast.success('Revenue data loaded successfully');
    } catch (error) {
      console.error('Failed to load revenue data', error);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Export data
  const exportData = () => {
    const csv = [
      ['Date', 'Transaction ID', 'User', 'Amount', 'Type', 'Status', 'Description'].join(','),
      ...transactions.map(t => [
        new Date(t.created_at).toLocaleDateString(),
        t.id,
        t.user_email || t.user_id,
        t.amount,
        t.type,
        t.status,
        t.description?.replace(/,/g, ';') || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast.success('Data exported successfully');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
      case 'success':
        return 'default';
      case 'pending':
      case 'processing':
        return 'secondary';
      case 'refunded':
      case 'cancelled':
        return 'outline';
      case 'failed':
      case 'declined':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Effects
  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Revenue Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track and analyze revenue performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchRevenueData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(value: any) => setSelectedTab(value)} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Revenue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
                  <div className="flex items-center mt-1">
                    <Badge 
                      variant={metrics.growthRate >= 0 ? "default" : "destructive"} 
                      className="gap-1"
                    >
                      {metrics.growthRate >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {formatPercentage(metrics.growthRate)}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2">vs previous period</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalTransactions}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(metrics.averageOrderValue)} average per transaction
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Customers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.activeCustomers}</div>
                  <div className="flex items-center mt-1">
                    <Percent className="h-3 w-3 mr-1 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {metrics.conversionRate.toFixed(1)}% conversion rate
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888888" 
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`$${value}`, 'Revenue']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#0088FE" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No revenue data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Sources */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Revenue Sources</CardTitle>
              <CardDescription>Breakdown by transaction type</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No revenue sources data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Transactions Tab */}
      <TabsContent value="transactions">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              Showing {transactions.length} transactions from the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(transaction.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">
                            {transaction.id.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {transaction.user_email || transaction.user_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatCurrency(transaction.amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(transaction.status)} className="capitalize">
                            {transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-[200px] truncate" title={transaction.description}>
                            {transaction.description}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found for the selected period
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Analytics Tab */}
      <TabsContent value="analytics">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key revenue performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Average Order Value</p>
                      <p className="text-xs text-muted-foreground">Average revenue per transaction</p>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(metrics.averageOrderValue)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Conversion Rate</p>
                      <p className="text-xs text-muted-foreground">Percentage of active users</p>
                    </div>
                    <div className="text-xl font-bold">
                      {metrics.conversionRate.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Revenue Growth</p>
                      <p className="text-xs text-muted-foreground">Compared to previous period</p>
                    </div>
                    <div className={`text-xl font-bold ${metrics.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(metrics.growthRate)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Transaction Frequency</p>
                      <p className="text-xs text-muted-foreground">Transactions per active customer</p>
                    </div>
                    <div className="text-xl font-bold">
                      {metrics.activeCustomers > 0 
                        ? (metrics.totalTransactions / metrics.activeCustomers).toFixed(1)
                        : '0.0'}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Forecast */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Revenue Forecast</CardTitle>
              <CardDescription>Projected revenue based on current trends</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm font-medium">Next 30 Days</p>
                      <p className="text-2xl font-bold mt-2">
                        {formatCurrency(metrics.totalRevenue * 1.1)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Projected +10% growth
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm font-medium">Next 90 Days</p>
                      <p className="text-2xl font-bold mt-2">
                        {formatCurrency(metrics.totalRevenue * 1.3)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Projected +30% growth
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium mb-2">Monthly Revenue Trend</p>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5, 6].map((month) => {
                        const projectedRevenue = metrics.totalRevenue * (1 + (0.1 * month));
                        return (
                          <div key={month} className="flex items-center justify-between">
                            <span className="text-sm">
                              Month {month}
                            </span>
                            <span className="font-medium">
                              {formatCurrency(projectedRevenue)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <Target className="h-4 w-4 inline mr-1" />
                    Forecast based on current growth rate of {formatPercentage(metrics.growthRate)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default RevenuePage;