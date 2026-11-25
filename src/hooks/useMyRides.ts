import { errText } from '@/lib/places';
import { loadRideHistory, type PreviousTrip } from '@/lib/previousTrips';
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
export function useMyRides(userId: string | undefined, watchBookings: boolean) {
  const [posted, setPosted] = useState<PostedRide[]>([]);
  const [booked, setBooked] = useState<BookedRide[]>([]);
  const [history, setHistory] = useState<PreviousTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, b, historyCards] = await Promise.all([
        loadPostedRides(userId),
        loadBookedRides(userId),
        loadRideHistory(userId),
      ]);
      setPosted(p);
      setBooked(b);
      setHistory(historyCards);
      setError('');
    } catch (e) {
      console.error(e);
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Keep the rider's pending bookings current while a driver starts or finishes.
  useFocusEffect(
    useCallback(() => {
      void reload();
      if (!watchBookings || !userId) return;
      let active = true;
      let checking = false;
      const timer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          const rows = await loadBookedRides(userId);
          if (active) setBooked(rows);
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
    }, [reload, userId, watchBookings]),
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

  return { posted, booked, history, loading, error, reload, cancelPosted, cancelBooked };
}
