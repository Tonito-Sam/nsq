import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SalesReportsProps {
  storeId?: string;
  storeCurrency: string;
}

export const SalesReports: React.FC<SalesReportsProps> = ({ storeId, storeCurrency }) => {
  const [reportData, setReportData] = useState({
    thisMonth: { revenue: 0, orders: 0, customers: 0 },
    lastMonth: { revenue: 0, orders: 0, customers: 0 },
    topProducts: [],
    recentOrders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      fetchReportData();
    }
  }, [storeId]);

  const fetchReportData = async () => {
    if (!storeId) return;

    try {
      // 1. Get orders for this store for this month and last month
      const now = new Date();
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      // This month
      const { data: thisMonthOrders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at, id, customer_id, product_id')
        .eq('store_id', storeId)
        .gte('created_at', firstOfThisMonth.toISOString());
      // Last month
      const { data: lastMonthOrders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at, id, customer_id, product_id')
        .eq('store_id', storeId)
        .gte('created_at', firstOfLastMonth.toISOString())
        .lt('created_at', firstOfThisMonth.toISOString());
      // Customers
      const thisMonthCustomers = Array.from(new Set((thisMonthOrders || []).map(o => o.customer_id))).length;
      const lastMonthCustomers = Array.from(new Set((lastMonthOrders || []).map(o => o.customer_id))).length;
      // Revenue and orders
      const thisMonthRevenue = (thisMonthOrders || []).filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_amount), 0);
      const lastMonthRevenue = (lastMonthOrders || []).filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total_amount), 0);
      const thisMonthOrderCount = (thisMonthOrders || []).length;
      const lastMonthOrderCount = (lastMonthOrders || []).length;
      // Top products
      const { data: products } = await supabase
        .from('store_products')
        .select('id, title')
        .eq('store_id', storeId);
      const productSales = {};
      (thisMonthOrders || []).forEach(o => {
        if (!productSales[o.product_id]) productSales[o.product_id] = { sales: 0, revenue: 0 };
        productSales[o.product_id].sales += 1;
        productSales[o.product_id].revenue += Number(o.total_amount);
      });
      const topProducts = Object.entries(productSales)
        .map(([id, stats]) => ({
          name: (products || []).find(p => p.id === id)?.title || 'Unknown',
          sales: stats.sales,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      // Recent orders
      const recentOrders = (thisMonthOrders || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(o => ({
          id: o.id,
          customer: o.customer_id,
          amount: Number(o.total_amount),
          status: o.status,
          date: o.created_at
        }));
      setReportData({
        thisMonth: { revenue: thisMonthRevenue, orders: thisMonthOrderCount, customers: thisMonthCustomers },
        lastMonth: { revenue: lastMonthRevenue, orders: lastMonthOrderCount, customers: lastMonthCustomers },
        topProducts,
        recentOrders
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  if (loading) {
    return (
      <Card className="dark:bg-[#161616] p-8 text-center">
        <div className="text-gray-600 dark:text-gray-400">Loading reports...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sales Reports</h2>

      {/* Monthly Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-right">
              {calculateGrowth(reportData.thisMonth.revenue, reportData.lastMonth.revenue) >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Revenue</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {storeCurrency} {reportData.thisMonth.revenue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">
            {calculateGrowth(reportData.thisMonth.revenue, reportData.lastMonth.revenue).toFixed(1)}% vs last month
          </p>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-right">
              {calculateGrowth(reportData.thisMonth.orders, reportData.lastMonth.orders) >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Orders</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {reportData.thisMonth.orders}
          </p>
          <p className="text-sm text-gray-500">
            {calculateGrowth(reportData.thisMonth.orders, reportData.lastMonth.orders).toFixed(1)}% vs last month
          </p>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-right">
              {calculateGrowth(reportData.thisMonth.customers, reportData.lastMonth.customers) >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">New Customers</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {reportData.thisMonth.customers}
          </p>
          <p className="text-sm text-gray-500">
            {calculateGrowth(reportData.thisMonth.customers, reportData.lastMonth.customers).toFixed(1)}% vs last month
          </p>
        </Card>
      </div>

      {/* Top Products & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="dark:bg-[#161616] p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Products</h3>
          <div className="space-y-4">
            {reportData.topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                  <p className="text-sm text-gray-500">{product.sales} sales</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {storeCurrency} {product.revenue.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Orders</h3>
          <div className="space-y-4">
            {reportData.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{order.customer}</p>
                  <p className="text-sm text-gray-500">{order.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {storeCurrency} {order.amount}
                  </p>
                  <Badge 
                    className={order.status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}
                  >
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
