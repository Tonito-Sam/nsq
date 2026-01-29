import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function useQuery() {
  return new URLSearchParams(window.location.search);
}

const WalletTopupResult: React.FC = () => {
  const query = useQuery();
  const status = query.get('status');
  const ref = query.get('ref');
  const navigate = useNavigate();

  let title = '';
  let message = '';
  let isSuccess = false;

  if (status === 'success') {
    title = 'Top Up Successful!';
    message = `Your wallet has been topped up successfully. Reference: ${ref}`;
    isSuccess = true;
  } else if (status === 'failed') {
    title = 'Top Up Failed';
    message = 'There was a problem processing your wallet top up. Please try again.';
  } else {
    title = 'Top Up Status Unknown';
    message = 'We could not determine the result of your wallet top up.';
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className={`text-2xl font-bold mb-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>{title}</h1>
      <p className="mb-6 text-gray-700 dark:text-gray-300">{message}</p>
      <Button onClick={() => navigate('/wallet')}>Return to Wallet</Button>
    </div>
  );
};

export default WalletTopupResult;
