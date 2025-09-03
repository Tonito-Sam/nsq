
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const HeaderLogo = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="flex items-center space-x-2 cursor-pointer"
      onClick={() => navigate('/')}
    >
      {/* Desktop Logo - Increased size to h-14 */}
      <img 
        src="/uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" 
        alt="NexSq" 
        className="hidden md:block h-14"
      />
      {/* Mobile Portrait Logo */}
      <img 
          src="/uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" 
        alt="NexSq" 
        className="block md:hidden h-8 w-20"
      />
    </div>
  );
};
