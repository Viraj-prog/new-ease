import type { IconName } from '@/components/Icon';
import type { SavedKind, SavedPlace } from '@/lib/savedTrips';

// The three fixed saved places that always show up, even before an address is set.
export const SLOTS: { kind: Exclude<SavedKind, 'other'>; label: string; icon: IconName }[] = [
  { kind: 'home', label: 'Home', icon: 'home' },
  { kind: 'work', label: 'Work', icon: 'work' },
  { kind: 'school', label: 'School', icon: 'school' },
];

export type SlotItem = {
  key: string;
  label: string;
  icon: IconName;
  kind: SavedKind;
  // The saved row, if the user has set this place.
  place: SavedPlace | null;
};

// Home, Work and School, set or not. These are the only saved places for now.
export function slotItems(saved: SavedPlace[]): SlotItem[] {
  return SLOTS.map((s) => ({
    key: s.kind,
    label: s.label,
    icon: s.icon,
    kind: s.kind as SavedKind,
    place: saved.find((p) => p.kind === s.kind) ?? null,
  }));
}
