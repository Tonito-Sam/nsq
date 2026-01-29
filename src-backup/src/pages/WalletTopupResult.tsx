import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const WalletTopupResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const status = params.get('status');
  const ref = params.get('ref');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1a1a1a]">
      <Card className="p-8 max-w-md w-full text-center dark:bg-[#161616]">
        {status === 'success' ? (
          <>
            <h2 className="text-2xl font-bold mb-4 text-green-600">Wallet Top-up Successful</h2>
            <p className="mb-2 text-gray-700 dark:text-gray-300">Your wallet has been credited.</p>
            <p className="mb-6 text-xs text-gray-500">Reference: {ref}</p>
            <Button className="w-full" onClick={() => navigate('/wallet')}>Return to Wallet</Button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4 text-red-600">Payment Failed</h2>
            <p className="mb-2 text-gray-700 dark:text-gray-300">Your wallet top-up could not be processed.</p>
            <p className="mb-6 text-xs text-gray-500">Reference: {ref}</p>
            <Button className="w-full" onClick={() => navigate('/wallet')}>Return to Wallet</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default WalletTopupResult;
