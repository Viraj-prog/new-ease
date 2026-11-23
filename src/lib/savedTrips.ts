import type { Pt } from '@/lib/geo';
import { loadPreviousTrips } from '@/lib/previousTrips';
import { supabase } from '@/lib/supabase';

export type SavedKind = 'home' | 'work' | 'school' | 'other';

export type SavedPlace = {
  id: string;
  label: string;
  kind: SavedKind;
  address: string;
};

export type RecentPlace = {
  // The place as it was named for the trip, such as "West Edmonton Mall".
  address: string;
  lastUsedAt: string;
  // Where it is on the map, so its city and province can be looked up.
  point: Pt | null;
  // The city and province shown under the name ("Edmonton, AB"), once looked up.
  detail?: string;
};

// Passenger or driver: their saved places, oldest first.
export async function loadSavedPlaces(userId: string): Promise<SavedPlace[]> {
  const { data, error } = await supabase
    .from('saved_places')
    .select('id, label, kind, address')
    .eq('userId', userId)
    .order('createdAt', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SavedPlace[];
}

// Add a place, or change the address if that label already exists.
export async function saveSavedPlace(args: {
  userId: string;
  label: string;
  kind: SavedKind;
  address: string;
}) {
  const { error } = await supabase
    .from('saved_places')
    .upsert(
      { userId: args.userId, label: args.label, kind: args.kind, address: args.address },
      { onConflict: 'userId,label' },
    );
  if (error) throw error;
}

export async function deleteSavedPlace(id: string) {
  const { error } = await supabase.from('saved_places').delete().eq('id', id);
  if (error) throw error;
}

// Where the user most recently finished a trip to, newest first, each place once.
export async function loadRecentPlaces(userId: string, limit = 5): Promise<RecentPlace[]> {
  const trips = await loadPreviousTrips(userId);
  const seen = new Set<string>();
  const out: RecentPlace[] = [];
  for (const t of trips) {
    const key = t.destination.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ address: t.destination.trim(), lastUsedAt: t.departAt ?? '', point: t.destinationPoint });
    if (out.length === limit) break;
  }
  return out;
}
