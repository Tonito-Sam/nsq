import React from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, Package, TrendingUp, Eye } from 'lucide-react';

interface StoreDashboardProps {
  stats: {
    totalRevenue: number;
    totalProducts: number;
    totalSales: number;
    totalViews: number;
  };
  storeCurrency?: string;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({ stats, storeCurrency = 'ZAR' }) => {
  return (
    <div className="space-y-6">
      {/* Enhanced Stats Cards with Icons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="dark:bg-[#161616] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full mb-3">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {storeCurrency} {stats.totalRevenue.toLocaleString()}
            </p>
          </div>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-3">
              <Package className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Products</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalProducts}</p>
          </div>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-3">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalSales}</p>
          </div>
        </Card>

        <Card className="dark:bg-[#161616] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-3">
              <Eye className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">Views</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalViews.toLocaleString()}</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
