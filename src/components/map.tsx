import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { boundsOf, type Pt } from '@/lib/geo';

// Free demo style; swap for a Stadia Maps style URL once you have an API key.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Fallback centre (Vancouver) used until the user's location is available.
const DEFAULT_CENTER: [number, number] = [-123.1207, 49.2827];

export type MapMarker = {
  id: string;
  point: Pt;
  color: string;
  onPress?: () => void;
};

type Props = {
  route?: Pt[];
  altRoute?: Pt[];
  markers?: MapMarker[];
  // How much of the map is covered by the bottom sheet / menu button, so a drawn
  // route is fitted into the part that is still visible.
  padding?: { top: number; right: number; bottom: number; left: number };
};

const toLine = (pts: Pt[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: {
    type: 'LineString' as const,
    coordinates: pts.map((p) => [p.lng, p.lat]),
  },
});

export default function InteractiveMap({
  route = [],
  altRoute = [],
  markers = [],
  padding = { top: 120, right: 40, bottom: 320, left: 40 },
}: Props) {
  const bounds = boundsOf([...route, ...altRoute, ...markers.map((m) => m.point)]);

  return (
    <Map style={styles.map} mapStyle={MAP_STYLE}>
      {bounds ? (
        // Something to show: fit it into the visible area above the sheet.
        <Camera bounds={bounds} padding={padding} duration={600} />
      ) : (
        // Nothing to show: follow the user.
        <Camera
          initialViewState={{ center: DEFAULT_CENTER, zoom: 15 }}
          trackUserLocation='default'
          zoom={15}
        />
      )}

      {route.length > 1 && (
        <GeoJSONSource id='route' data={toLine(route)}>
          <Layer
            id='route-line'
            type='line'
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#2563eb', 'line-width': 5 }}
          />
        </GeoJSONSource>
      )}

      {altRoute.length > 1 && (
        <GeoJSONSource id='alt-route' data={toLine(altRoute)}>
          <Layer
            id='alt-route-line'
            type='line'
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#f97316', 'line-width': 4 }}
          />
        </GeoJSONSource>
      )}

      {markers.map((m) => (
        <Marker key={m.id} lngLat={[m.point.lng, m.point.lat]}>
          <Pressable onPress={m.onPress} style={[styles.dot, { backgroundColor: m.color }]} />
        </Marker>
      ))}

      <UserLocation />
    </Map>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
