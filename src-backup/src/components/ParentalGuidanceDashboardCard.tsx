import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ParentalGuidanceDashboardCard: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Card className="p-6 dark:bg-[#161616] flex flex-col items-center">
      <div className="flex items-center mb-2">
        <Shield className="h-5 w-5 mr-2 text-primary" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Parental Guidance Dashboard</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
        Overview of all minor accounts, activity, and parental controls.
      </p>
      {/* Example stats, replace with real data if needed */}
      <div className="mb-4 w-full">
        <div className="flex justify-between text-sm mb-2">
          <span>Minors Managed:</span>
          <span className="font-bold">--</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>Active Time Limits:</span>
          <span className="font-bold">--</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>Monitoring Enabled:</span>
          <span className="font-bold">--</span>
        </div>
      </div>
      <Button className="w-full" onClick={() => navigate('/pgp-dashboard')}>
        Go to Dashboard
      </Button>
    </Card>
  );
};

export default ParentalGuidanceDashboardCard;
