import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { useNotify } from '@/lib/notify';

// Driver / Rider switch used by the drawer and the plan view.
// Switching to Driver as a non-driver makes them a driver first.
export function useRoleSwitch() {
  const { isDriver, driverMode, setDriverMode, refreshProfile } = useAuth();
  const [switching, setSwitching] = useState(false);
  const notify = useNotify();

  async function choose(driver: boolean) {
    if (switching || driver === driverMode) return;
    if (driver && !isDriver) {
      setSwitching(true);
      const { error } = await supabase.rpc('become_driver');
      if (error) {
        setSwitching(false);
        notify({ kind: 'alert', title: 'Could not switch to driving', subtitle: error.message });
        return;
      }
      await refreshProfile();
      setSwitching(false);
    }
    setDriverMode(driver);
  }

  return { driverMode, switching, choose };
}
