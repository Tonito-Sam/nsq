
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const HeaderLogo = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="flex items-center space-x-2 cursor-pointer"
      onClick={() => navigate('/')}
    >
      <img
        src="/nexsq-logo-2026-transparent.png"
        alt="NexSq" 
        className="h-[26px] w-[115px] object-cover md:h-[45px] md:w-[205px]"
        style={{ objectPosition: 'center 54%' }}
      />
    </div>
  );
};
