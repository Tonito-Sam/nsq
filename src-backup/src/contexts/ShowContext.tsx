import React, { createContext, useContext, useState, ReactNode } from 'react';

interface StudioShow {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  scheduled_time?: string;
  end_time?: string;
  is_live: boolean;
  is_active: boolean;
  created_at: string;
}

interface ShowContextType {
  currentShow: StudioShow | null;
  setCurrentShow: (show: StudioShow | null) => void;
  viewerCount: number;
  setViewerCount: (count: number) => void;
  likeCount: number;
  setLikeCount: (count: number) => void;
}

const ShowContext = createContext<ShowContextType | undefined>(undefined);

export const ShowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Persistent state: rehydrate from localStorage/sessionStorage
  const [currentShow, setCurrentShowState] = useState<StudioShow | null>(() => {
    const saved = localStorage.getItem('currentShow');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewerCount, setViewerCountState] = useState(() => {
    const saved = sessionStorage.getItem('viewerCount');
    return saved ? Number(saved) : 0;
  });
  const [likeCount, setLikeCountState] = useState(() => {
    const saved = sessionStorage.getItem('likeCount');
    return saved ? Number(saved) : 0;
  });

  // Sync state to storage
  const setCurrentShow = (show: StudioShow | null) => {
    setCurrentShowState(show);
    if (show) {
      localStorage.setItem('currentShow', JSON.stringify(show));
    } else {
      localStorage.removeItem('currentShow');
    }
  };
  const setViewerCount = (count: number) => {
    setViewerCountState(count);
    sessionStorage.setItem('viewerCount', String(count));
  };
  const setLikeCount = (count: number) => {
    setLikeCountState(count);
    sessionStorage.setItem('likeCount', String(count));
  };

  // Visibilitychange handler: pause/resume logic, no reload
  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Resume logic here (e.g., refresh counts, revalidate show)
      } else {
        // Pause logic here (e.g., stop timers, pause video)
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <ShowContext.Provider value={{
      currentShow,
      setCurrentShow,
      viewerCount,
      setViewerCount,
      likeCount,
      setLikeCount
    }}>
      {children}
    </ShowContext.Provider>
  );
};

export const useShowContext = () => {
  const context = useContext(ShowContext);
  if (context === undefined) {
    throw new Error('useShowContext must be used within a ShowProvider');
  }
  return context;
};
