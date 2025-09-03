import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/Header';
import { EnhancedStoreSetupModal } from '@/components/EnhancedStoreSetupModal';
import { useNavigate, useLocation } from 'react-router-dom';

const CreateStore = () => {
  const [showSetup, setShowSetup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get ?step= param from URL
  const params = new URLSearchParams(location.search);
  const initialStep = parseInt(params.get('step') || '1', 10);

  const handleSuccess = () => {
    setShowSetup(false);
    navigate('/my-store');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Create Your Store</h1>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Welcome! You don't have a store yet. Click below to get started.
          </p>
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
            onClick={() => setShowSetup(true)}
          >
            Start Store Setup
          </button>
        </Card>
        {showSetup || initialStep > 1 ? (
          <EnhancedStoreSetupModal onClose={() => setShowSetup(false)} onSuccess={handleSuccess} initialStep={initialStep} />
        ) : null}
      </div>
    </div>
  );
};

export default CreateStore;
