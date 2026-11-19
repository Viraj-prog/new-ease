import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Alert } from 'react-native';

// Driver / Rider switch used by the drawer and the plan view.
// Switching to Driver as a non-driver makes them a driver first.
export function useRoleSwitch() {
  const { isDriver, driverMode, setDriverMode, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);

  async function choose(driver: boolean) {
    if (switching || driver === driverMode) return;
    if (driver && !isDriver) {
      setSwitching(true);
      const { error } = await supabase.rpc('become_driver');
      if (error) {
        setSwitching(false);
        Alert.alert('Could not switch to driving', error.message);
        return;
      }
      await refreshProfile();
      setSwitching(false);
    }
    setDriverMode(driver);
  }

  return { driverMode, switching, choose };
}
