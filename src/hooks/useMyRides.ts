import { errText } from '@/lib/places';
import {
  cancelBooking,
  cancelPostedRide,
  loadBookedRides,
  loadPendingRequests,
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
  // How many unanswered requests each posted trip has, by rideId.
  const [waiting, setWaiting] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, b, pending] = await Promise.all([
        isDriver ? loadPostedRides(userId) : Promise.resolve([]),
        loadBookedRides(userId),
        isDriver ? loadPendingRequests(userId) : Promise.resolve([]),
      ]);
      const counts: Record<string, number> = {};
      for (const r of pending) counts[r.rideId] = (counts[r.rideId] ?? 0) + 1;
      setWaiting(counts);
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

  // Reload every time the tab is opened, and every 10 seconds while it is showing.
  useFocusEffect(
    useCallback(() => {
      reload();
      const timer = setInterval(reload, 10000);
      return () => clearInterval(timer);
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

  return { posted, booked, waiting, loading, error, reload, cancelPosted, cancelBooked };
}
