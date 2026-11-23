import { useTheme } from '@/lib/theme';

// CARTO's free basemaps (OpenStreetMap data). Free for non-commercial use with attribution.
const DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export function useMapStyle() {
  const { mapMode } = useTheme();
  return mapMode === 'dark' ? DARK : LIGHT;
}
