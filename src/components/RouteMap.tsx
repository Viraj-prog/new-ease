import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
} from "@maplibre/maplibre-react-native";
import { Pressable, StyleSheet } from "react-native";
import { boundsOf, type Pt } from "../lib/geo";

// Free style with street detail, no API key. Fine for development.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
  padding?: { top: number; right: number; bottom: number; left: number };
};

const toLine = (pts: Pt[]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "LineString" as const,
    coordinates: pts.map((p) => [p.lng, p.lat]),
  },
});

export default function RouteMap({
  route = [],
  altRoute = [],
  markers = [],
  padding = { top: 300, right: 40, bottom: 260, left: 40 },
}: Props) {
  const bounds = boundsOf([
    ...route,
    ...altRoute,
    ...markers.map((m) => m.point),
  ]);

  return (
    <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={STYLE}>
      <Camera
        initialViewState={{ center: [-113.4909, 53.5461], zoom: 10 }}
        bounds={bounds}
        padding={padding}
        duration={600}
      />

      {route.length > 1 && (
        <GeoJSONSource id="route" data={toLine(route)}>
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#2563eb", "line-width": 5 }}
          />
        </GeoJSONSource>
      )}

      {altRoute.length > 1 && (
        <GeoJSONSource id="alt-route" data={toLine(altRoute)}>
          <Layer
            id="alt-route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#f97316", "line-width": 4 }}
          />
        </GeoJSONSource>
      )}

      {markers.map((m) => (
        <Marker key={m.id} lngLat={[m.point.lng, m.point.lat]}>
          <Pressable
            onPress={m.onPress}
            style={[styles.dot, { backgroundColor: m.color }]}
          />
        </Marker>
      ))}
    </MapLibreMap>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: "#fff",
  },
});
