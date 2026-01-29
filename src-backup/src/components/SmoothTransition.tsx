import React, { useRef, useEffect, useState } from 'react';

interface SmoothTransitionProps {
  children: React.ReactNode;
  triggerKey: string | number;
}

export const SmoothTransition: React.FC<SmoothTransitionProps> = ({ children, triggerKey }) => {
  const [show, setShow] = useState(true);
  const prevKey = useRef(triggerKey);

  useEffect(() => {
    if (prevKey.current !== triggerKey) {
      setShow(false);
      setTimeout(() => {
        setShow(true);
        prevKey.current = triggerKey;
      }, 200); // duration of fade out
    }
  }, [triggerKey]);

  return (
    <div
      style={{
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)', // smooth ease-in-out
        opacity: show ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};
