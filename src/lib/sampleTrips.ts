import type { IconName } from '@/components/Icon';

// TODO: replace with the user's real past trips once they are loaded from the database.
export const SAMPLE_RECENT = [
  { place: 'University LRT Station', when: 'Your last trip · Nov 14' },
  { place: 'West Side Library', when: 'Nov 9' },
];

// Saved places. They open the Saved Trips page until that page is built.
export const SAVED: { label: string; icon: IconName }[] = [
  { label: 'Home', icon: 'home' },
  { label: 'Work', icon: 'work' },
  { label: 'School', icon: 'school' },
];
