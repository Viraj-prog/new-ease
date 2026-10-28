import { useAuth } from '@/lib/auth';
import { errText } from '@/lib/places';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type Profile = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  dateOfBirth: string | null;
  isVerified: boolean;
  isDriver: boolean;
  profilePicture: string | null;
  // Only drivers have a rating.
  rating: number | null;
  // Accepted rides as a passenger, plus the driver's trip count.
  totalRides: number;
};

// Whole years since a YYYY-MM-DD date of birth, or null.
export function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const beforeBirthday =
    now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

// Loads the logged-in user's profile; reloads each time the screen comes into focus.
export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data: u, error: uError } = await supabase
        .from('users')
        .select('firstName, lastName, email, dateOfBirth, isVerified, isDriver, profilePicture')
        .eq('userId', userId)
        .maybeSingle();
      if (uError) throw uError;
      if (!u) {
        setProfile(null);
        setError('No profile found for this account yet.');
        return;
      }

      const { data: d } = await supabase
        .from('drivers')
        .select('driverRating, totalTrips')
        .eq('driverId', userId)
        .maybeSingle();

      const { count } = await supabase
        .from('ride_requests')
        .select('id', { count: 'exact', head: true })
        .eq('passengerId', userId)
        .eq('status', 'accepted');

      setProfile({
        ...u,
        rating: d ? Number(d.driverRating) : null,
        totalRides: (count ?? 0) + Number(d?.totalTrips ?? 0),
      });
      setError('');
    } catch (e) {
      console.error(e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { profile, loading, error, email: profile?.email ?? session?.user.email ?? null };
}
