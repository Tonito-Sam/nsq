import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Badge import removed: not used in this component
import { TrendingUp, DollarSign, CreditCard, ArrowUpRight, ArrowDownLeft, Users, UserPlus } from 'lucide-react';
import ExchangeRatesCard from '@/components/ExchangeRatesCard';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url?: string | null;
}

interface WalletSidebarProps {
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onSendMoney?: () => void;
  onRequestPayment?: () => void;
  // New props for the two cards
  recentRecipients?: User[];
  onSelectRecipient?: (recipient: User) => void;
  onSendToRecipient?: (recipient: User) => void;
  userCurrency?: string;
  walletBalance?: number;
  // rates and related props are handled by the ExchangeRatesCard component
}

export const WalletSidebar: React.FC<WalletSidebarProps> = ({ 
  onTopUp, 
  onWithdraw, 
  onSendMoney, 
  onRequestPayment,
  recentRecipients = [],
  onSelectRecipient,
  onSendToRecipient,
  userCurrency = 'USD',
  walletBalance = 0,
  
}) => {
  const quickActions = [
    { label: 'Send Money', icon: ArrowUpRight, color: 'text-blue-600', onClick: onSendMoney },
    { label: 'Request Payment', icon: ArrowDownLeft, color: 'text-green-600', onClick: onRequestPayment },
    { label: 'Top Up', icon: CreditCard, color: 'text-purple-600', onClick: onTopUp },
    { label: 'Withdraw', icon: DollarSign, color: 'text-orange-600', onClick: onWithdraw }
  ];

  // ExchangeRatesCard handles local currency conversion and display

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

      {/* REPLACED: Wallet Tips with two new cards */}
      <div className="space-y-4">
        {/* Recent Recipients Card */}
        <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Recent Recipients</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentRecipients && recentRecipients.length > 0 ? (
              <div className="space-y-3">
                {recentRecipients.map((recipient) => (
                  <div 
                    key={recipient.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => onSelectRecipient?.(recipient)}
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {recipient.full_name || recipient.username || recipient.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {recipient.full_name && recipient.username ? `@${recipient.username}` : recipient.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendToRecipient?.(recipient);
                      }}
                    >
                      Send
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recent recipients
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Send money to see recipients here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exchange Rates Card (replaced by ExchangeRatesCard component) */}
        <ExchangeRatesCard userCurrency={userCurrency} walletBalance={walletBalance} showCurrencySelector={true} />
      </div>
    </div>
  );
};