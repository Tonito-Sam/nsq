import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, CreditCard, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';

interface WalletSidebarProps {
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onSendMoney?: () => void;
  onRequestPayment?: () => void;
}

export const WalletSidebar: React.FC<WalletSidebarProps> = ({ onTopUp, onWithdraw, onSendMoney, onRequestPayment }) => {
  const quickActions = [
    { label: 'Send Money', icon: ArrowUpRight, color: 'text-blue-600', onClick: onSendMoney },
    { label: 'Request Payment', icon: ArrowDownLeft, color: 'text-green-600', onClick: onRequestPayment },
    { label: 'Top Up', icon: CreditCard, color: 'text-purple-600', onClick: onTopUp },
    { label: 'Withdraw', icon: DollarSign, color: 'text-orange-600', onClick: onWithdraw }
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={action.onClick}
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Wallet Stats */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            This Month
          </h3>
          <div className="space-y-4">
            <div className="text-center p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                $0
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Earned
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  $0
                </div>
                <div className="text-xs text-gray-500">
                  Spent
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  0
                </div>
                <div className="text-xs text-gray-500">
                  Transactions
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Wallet Tips */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Wallet Tips
          </h3>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Secure Your Account
              </p>
              <p>Enable two-factor authentication for extra security.</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                Track Spending
              </p>
              <p>Review your transaction history regularly to track your spending.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
