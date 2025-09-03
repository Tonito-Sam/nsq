import { useLocation } from 'react-router-dom';

export default function OrderSummaryFailed() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  const status = params.get('status');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#18181b] px-4">
      <div className="max-w-md w-full bg-white dark:bg-[#23232b] rounded-xl shadow-lg p-8 flex flex-col items-center">
        <div className="bg-red-100 rounded-full p-3 mb-4">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-4 text-center">
          Your payment could not be processed.<br />
          Please try again or contact support.
        </p>
        {ref && (
          <div className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Reference:</span> {ref}
          </div>
        )}
        {status && (
          <div className="mb-4 text-sm text-gray-500">
            <span className="font-semibold">Status:</span> {status}
          </div>
        )}
        <a
          href="/cart"
          className="w-full mt-2 inline-block text-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          Return to Cart
        </a>
      </div>
    </div>
  );
} 