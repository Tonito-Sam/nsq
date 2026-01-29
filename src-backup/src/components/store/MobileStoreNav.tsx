
import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, MessageSquare, Package, ShoppingCart, BarChart3, Wallet, Settings } from 'lucide-react';

interface MobileStoreNavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  storeName: string;
}

export const MobileStoreNav: React.FC<MobileStoreNavProps> = ({ 
  activeSection, 
  onSectionChange, 
  storeName 
}) => {
  const mobileStoreNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="lg:hidden bg-white dark:bg-[#161616] border-b border-gray-200 dark:border-gray-700 p-3">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Welcome, {storeName}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your store from this dashboard
        </p>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {mobileStoreNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeSection === item.id ? "default" : "ghost"}
              size="sm"
              className="flex-shrink-0 flex flex-col items-center p-2 h-auto min-w-[60px]"
              onClick={() => onSectionChange(item.id)}
            >
              <Icon className="h-4 w-4 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
