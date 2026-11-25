import { errText } from '@/lib/places';
import { loadRideHistory, type PreviousTrip } from '@/lib/previousTrips';
import {
  cancelBooking,
  cancelPostedRide,
  loadBookedRides,
  loadOpenSearches,
  loadPostedRides,
  type BookedRide,
  type OpenSearch,
  type PostedRide,
} from '@/lib/rides';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// The Rides tab: trips the user posted as a driver, and rides they booked as a passenger.
export function useMyRides(userId: string | undefined, watchPending: boolean) {
  const [posted, setPosted] = useState<PostedRide[]>([]);
  const [booked, setBooked] = useState<BookedRide[]>([]);
  const [searches, setSearches] = useState<OpenSearch[]>([]);
  const [history, setHistory] = useState<PreviousTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, b, s, historyCards] = await Promise.all([
        loadPostedRides(userId),
        loadBookedRides(userId),
        loadOpenSearches(userId),
        loadRideHistory(userId),
      ]);
      setPosted(p);
      setBooked(b);
      setSearches(s);
      setHistory(historyCards);
      setError('');
    } catch (e) {
      console.error(e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Keep Pending current while it is showing.
  useFocusEffect(
    useCallback(() => {
      void reload();
      if (!watchPending || !userId) return;
      let active = true;
      let checking = false;
      const timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          const [mine, rows, open] = await Promise.all([
            loadPostedRides(userId),
            loadBookedRides(userId),
            loadOpenSearches(userId),
          ]);
          if (active) {
            setPosted(mine);
            setBooked(rows);
            setSearches(open);
          }
        } catch (e) {
          console.warn('Could not refresh bookings', errText(e));
        } finally {
          checking = false;
        }
      }, 10000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [reload, userId, watchPending]),
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

  return { posted, booked, searches, history, loading, error, reload, cancelPosted, cancelBooked };
}
