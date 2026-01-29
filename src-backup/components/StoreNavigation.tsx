
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Wallet, 
  Settings 
} from 'lucide-react';

interface StoreNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  storeName: string;
}

export const StoreNavigation: React.FC<StoreNavigationProps> = ({ 
  activeSection, 
  onSectionChange, 
  storeName 
}) => {
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'chat', label: 'Chat Board', icon: MessageSquare },
    { id: 'products', label: 'Manage Products', icon: Package },
    { id: 'orders', label: 'Manage Orders', icon: ShoppingCart },
    { id: 'reports', label: 'Sales Reports', icon: TrendingUp },
    { id: 'wallet', label: 'Store Wallet', icon: Wallet },
    { id: 'settings', label: 'Store Settings', icon: Settings }
  ];

  return (
    <Card className="dark:bg-[#161616] p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Welcome, {storeName}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your store from this dashboard
        </p>
      </div>
      
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeSection === item.id ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => onSectionChange(item.id)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </Card>
  );
};
