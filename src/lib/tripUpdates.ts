import { supabase } from '@/lib/supabase';

// What the user's trips looked like at one check, from both sides: the requests they sent as a
// rider and the requests on their rides as a driver. Comparing two of these shows what the other
// person has done since.

type OfferState = {
  // 'rider' = the user's own request; 'driver' = a request on the user's ride.
  side: 'rider' | 'driver';
  offer: string;
  ride: string;
  byDriver: boolean;
  noShow: boolean;
  endedEarly: boolean;
  destination: string;
  // The driver's id (rider side) or the passenger's id (driver side), for the name.
  otherId: string;
};

export type Snapshot = Record<string, OfferState>;

export type TripEvent = {
  kind: 'alert' | 'success';
  title: string;
  subtitle: string;
  // Whose name replaces "{name}" in the text, and what to call them if it cannot be read.
  otherId: string;
  otherAs: 'your driver' | 'a passenger';
  // Lower shows first when several things happened at once.
  order: number;
  // The rider's trip is over: send them to Home.
  goHome?: boolean;
};

// Rides older than this no longer produce updates.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type OfferRow = {
  id: string;
  status: string;
  cancelledByDriver: boolean;
  noShowAt: string | null;
  ride_requests: { passengerId: string };
  rides: { driverId: string; status: string; driverEndLocation: string; endedEarlyAt: string | null };
};

export async function loadSnapshot(userId: string): Promise<Snapshot> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const query = () => supabase
    .from('ride_offers')
    .select(`id, status, cancelledByDriver, noShowAt, ride_requests!inner(passengerId),
             rides!inner(driverId, status, driverEndLocation, departAt, endedEarlyAt)`)
    .gte('rides.departAt', since);
  const [asRider, asDriver] = await Promise.all([
    query().eq('ride_requests.passengerId', userId),
    query().eq('rides.driverId', userId),
  ]);
  if (asRider.error) throw asRider.error;
  if (asDriver.error) throw asDriver.error;

  const snapshot: Snapshot = {};
  const add = (side: OfferState['side'], rows: OfferRow[]) => {
    for (const r of rows) {
      snapshot[`${side}:${r.id}`] = {
        side,
        offer: r.status,
        ride: r.rides.status,
        byDriver: r.cancelledByDriver,
        noShow: !!r.noShowAt,
        endedEarly: !!r.rides.endedEarlyAt,
        destination: r.rides.driverEndLocation,
        otherId: side === 'rider' ? r.rides.driverId : r.ride_requests.passengerId,
      };
    }
  };
  add('rider', (asRider.data ?? []) as unknown as OfferRow[]);
  add('driver', (asDriver.data ?? []) as unknown as OfferRow[]);
  return snapshot;
}

// What the driver did to one of the user's requests.
function riderEvent(was: OfferState | undefined, now: OfferState): TripEvent | null {
  const event = (kind: TripEvent['kind'], title: string, subtitle: string, order: number): TripEvent =>
    ({ kind, title, subtitle, order, otherId: now.otherId, otherAs: 'your driver' });

  if (now.noShow && !was?.noShow) {
    return event('alert', 'Marked as a no show', `Your booking for the trip to ${now.destination} was cancelled.`, 0);
  }
  if (now.byDriver && !was?.byDriver) {
    // Cancelled after it started: the trip is over. Before that, the search opens again.
    if (now.endedEarly) {
      return {
        ...event('alert', 'Your driver cancelled the trip', `Your ride to ${now.destination} was cancelled.`, 0),
        goHome: true,
      };
    }
    return event('alert', 'Your driver cancelled', 'Find another driver in Scheduled Trips.', 0);
  }
  if (now.offer === 'accepted') {
    if (was?.offer !== 'accepted') {
      return event('success', 'Trip Successfully Booked!', '{name} will pick you up soon', 2);
    }
    if (now.ride === 'completed' && was.ride !== 'completed') {
      return event('success', 'Your ride is finished', `Trip to ${now.destination}`, 3);
    }
    if (now.ride === 'in_progress' && was.ride !== 'in_progress') {
      return event('success', 'Your ride has started', '{name} started the trip', 1);
    }
  }
  if (now.offer === 'declined' && was?.offer === 'pending') {
    return now.ride === 'cancelled'
      ? event('alert', 'A ride you asked for was cancelled', `Trip to ${now.destination}`, 1)
      : event('alert', '{name} can’t take your request', 'Your search is still in Scheduled Trips.', 1);
  }
  return null;
}

// What a rider did on one of the user's rides.
function driverEvent(was: OfferState | undefined, now: OfferState): TripEvent | null {
  const event = (kind: TripEvent['kind'], title: string, subtitle: string, order: number): TripEvent =>
    ({ kind, title, subtitle, order, otherId: now.otherId, otherAs: 'a passenger' });
  const live = now.ride === 'scheduled' || now.ride === 'in_progress';
  if (!live) return null;

  if (now.offer === 'pending' && was?.offer !== 'pending') {
    return event('success', 'New ride request', `{name} wants to join your trip to ${now.destination}`, 1);
  }
  if (now.offer === 'cancelled' && !now.byDriver && !now.noShow) {
    if (was?.offer === 'accepted') {
      return event('alert', 'A passenger cancelled', `They are off your trip to ${now.destination}.`, 0);
    }
    if (was?.offer === 'pending') {
      return event('alert', 'A request was withdrawn', `For your trip to ${now.destination}.`, 2);
    }
  }
  return null;
}

// Everything the other people did between two checks, most urgent first.
export function tripEvents(before: Snapshot, after: Snapshot): TripEvent[] {
  const events: TripEvent[] = [];
  for (const [key, now] of Object.entries(after)) {
    const was = before[key];
    const found = now.side === 'rider' ? riderEvent(was, now) : driverEvent(was, now);
    if (found) events.push(found);
  }
  return events.sort((a, b) => a.order - b.order);
}

// Puts the other person's name into an event's text, or a plain word when it cannot be read.
export async function nameEvent(event: TripEvent): Promise<TripEvent> {
  if (!`${event.title}${event.subtitle}`.includes('{name}')) return event;
  const { data } = await supabase
    .from('users')
    .select('firstName, lastName')
    .eq('userId', event.otherId)
    .maybeSingle();
  const name = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim();
  const fill = (text: string) => {
    const filled = text.replace('{name}', name || event.otherAs);
    return filled.charAt(0).toUpperCase() + filled.slice(1);
  };
  return { ...event, title: fill(event.title), subtitle: fill(event.subtitle) };
}
