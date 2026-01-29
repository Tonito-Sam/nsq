import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("auth_user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [session, setSession] = useState<Session | null>(() => {
    const storedSession = localStorage.getItem("auth_session");
    return storedSession ? JSON.parse(storedSession) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial session fetch from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        localStorage.setItem("auth_session", JSON.stringify(session));
        localStorage.setItem("auth_user", JSON.stringify(session.user));
      }
    });

    // Subscribe to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session) {
          localStorage.setItem("auth_session", JSON.stringify(session));
          localStorage.setItem("auth_user", JSON.stringify(session.user));
        } else {
          localStorage.removeItem("auth_session");
          localStorage.removeItem("auth_user");
        }
      }
    );

    // Validate session when tab becomes visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id !== user?.id) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session) {
            localStorage.setItem("auth_session", JSON.stringify(session));
            localStorage.setItem("auth_user", JSON.stringify(session.user));
          } else {
            localStorage.removeItem("auth_session");
            localStorage.removeItem("auth_user");
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Sync login/logout across multiple tabs
    const syncAuth = () => {
      const storedSession = localStorage.getItem("auth_session");
      const storedUser = localStorage.getItem("auth_user");
      setSession(storedSession ? JSON.parse(storedSession) : null);
      setUser(storedUser ? JSON.parse(storedUser) : null);
    };
    window.addEventListener("storage", syncAuth);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", syncAuth);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signUp = async (email: string, password: string, userData: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData },
    });

    if (data.user && !error) {
      await supabase.from('users').insert({
        id: data.user.id,
        email: data.user.email,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
      });
    }

    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_user");
  };

  const value = { user, session, loading, signIn, signUp, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
