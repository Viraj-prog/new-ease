import { errText } from '@/lib/places';
import {
  cancelBooking,
  cancelPostedRide,
  loadBookedRides,
  loadPostedRides,
  type BookedRide,
  type PostedRide,
} from '@/lib/rides';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// The Rides tab: trips the user posted as a driver, and rides they booked as a passenger.
export function useMyRides(userId: string | undefined, isDriver: boolean) {
  const [posted, setPosted] = useState<PostedRide[]>([]);
  const [booked, setBooked] = useState<BookedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, b] = await Promise.all([
        isDriver ? loadPostedRides(userId) : Promise.resolve([]),
        loadBookedRides(userId),
      ]);
      setPosted(p);
      setBooked(b);
      setError('');
    } catch (e) {
      console.error(e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [userId, isDriver]);

  // Reload every time the tab is opened.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Both return an error message on failure, or null on success.
  async function cancelPosted(rideId: string): Promise<string | null> {
    try {
      await cancelPostedRide(rideId);
      await reload();
      return null;
    } catch (e) {
      console.error(e);
      return errText(e);
    }
  }

  async function cancelBooked(requestId: string): Promise<string | null> {
    try {
      await cancelBooking(requestId);
      await reload();
      return null;
    } catch (e) {
      console.error(e);
      return errText(e);
    }
  }

  return { posted, booked, loading, error, reload, cancelPosted, cancelBooked };
}
