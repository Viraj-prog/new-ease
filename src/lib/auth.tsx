import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { secureStorage } from './secureStorage';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  // Loaded from the users table; false until it arrives (or if there is no row).
  isDriver: boolean;
  // True when the user is a driver AND has driver mode switched on (see Settings).
  driverMode: boolean;
  setDriverMode: (on: boolean) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  isDriver: false,
  driverMode: false,
  setDriverMode: () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriver, setIsDriver] = useState(false);
  // Drivers can switch to passenger view and back; remembered per user on this device.
  const [driverPref, setDriverPref] = useState(true);
  const userId = session?.user.id;
  const prefKey = `driverMode.${userId}`;

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.warn('getSession failed', error.message);
        setSession(data.session);
      })
      .catch((err) => console.warn('getSession threw', err))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setIsDriver(false);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('isDriver')
      .eq('userId', userId)
      .maybeSingle();
    if (error) console.warn('load profile failed', error.message);
    setIsDriver(!!data?.isDriver);
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!userId) return;
    secureStorage.getItem(prefKey).then((v) => setDriverPref(v !== 'off'));
  }, [userId, prefKey]);

  function setDriverMode(on: boolean) {
    setDriverPref(on);
    if (userId) secureStorage.setItem(prefKey, on ? 'on' : 'off');
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, isDriver, driverMode: isDriver && driverPref, setDriverMode, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
