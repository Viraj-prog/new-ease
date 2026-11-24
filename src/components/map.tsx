import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { boundsOf, type Pt } from '@/lib/geo';
import { useMapStyle } from '@/lib/mapStyle';
import { useTheme } from '@/lib/theme';
import type { PickupStop } from '@/lib/pickupPlanner';

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
  plannedStops?: readonly PickupStop[];
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
  plannedStops = [],
  padding = { top: 120, right: 40, bottom: 320, left: 40 },
}: Props) {
  const mapStyle = useMapStyle();
  const { colors } = useTheme();
  const bounds = boundsOf([...route, ...altRoute, ...markers.map((m) => m.point), ...plannedStops]);
  const stopGroups = new Map<string, { stop: PickupStop; number: number }[]>();
  plannedStops.forEach((stop, index) => {
    const key = `${stop.lng},${stop.lat}`;
    const group = stopGroups.get(key) ?? [];
    group.push({ stop, number: index + 1 });
    stopGroups.set(key, group);
  });

  return (
    <MapView style={styles.map} mapStyle={mapStyle}>
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
            id='route-glow'
            type='line'
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.brand, 'line-width': 14, 'line-opacity': 0.25 }}
          />
          <Layer
            id='route-line'
            type='line'
            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': colors.brand, 'line-width': 5 }}
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
          <Pressable
            onPress={m.onPress}
            style={[styles.dot, { backgroundColor: m.color, borderColor: colors.ring }]}
          />
        </Marker>
      ))}

      {[...stopGroups].map(([key, group]) => (
        <Marker key={`plan-${key}`} lngLat={[group[0].stop.lng, group[0].stop.lat]}>
          <View style={styles.stopGroup}>
            {group.map(({ stop, number }) => (
              <View
                key={number}
                accessible
                accessibilityLabel={`${stop.type === 'pickup' ? 'Pickup' : 'Drop-off'} ${number}`}
                style={[styles.numberedStop, {
                  backgroundColor: stop.type === 'pickup' ? colors.brand : colors.alert,
                  borderColor: colors.ring,
                }]}
              >
                <Text style={[styles.stopNumber, { color: stop.type === 'pickup' ? colors.onBrand : colors.onAlert }]}>
                  {number}
                </Text>
              </View>
            ))}
          </View>
        </Marker>
      ))}

      <UserLocation />
    </MapView>
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
  },
  stopGroup: { flexDirection: 'row', gap: 2 },
  numberedStop: {
    minWidth: 28, height: 28, borderRadius: 14, borderWidth: 2,
    paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center',
  },
  stopNumber: { fontSize: 12, fontWeight: '700' },
});
