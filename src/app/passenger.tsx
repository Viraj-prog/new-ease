import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimeField from "../components/DateTimeField";
import RouteMap, { type MapMarker } from "../components/RouteMap";
import { TEST_PASSENGER_ID } from "../lib/config";
import { classifyTrip, dayRange, type Pt, type Zone } from "../lib/geo";
import { geocode, getCurrentPoint, getRoute } from "../lib/routing";
import { supabase } from "../lib/supabase";

type RideRow = {
  rideId: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  tripMdd: number | null;
  maxExtraKm: number | null;
  route: { points: Pt[]; distanceKm: number; durationMin: number } | null;
  drivers: {
    driverRating: number | null;
    mdd: number | null;
    users: { firstName: string; lastName: string } | null;
  } | null;
};

type Result = {
  rideId: string;
  driverName: string;
  rating: number | null;
  zone: Zone;
  pickupKm: number;
  dropoffKm: number;
  tripKm: number;
  tripMin: number;
  route: Pt[];
  start: Pt;
  end: Pt;
};

export default function PassengerPage() {
  const [fromText, setFromText] = useState("");
  const [fromPt, setFromPt] = useState<Pt | null>(null);
  const [toText, setToText] = useState("");
  const [when, setWhen] = useState(new Date()); // defaults to now

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [pickup, setPickup] = useState<Pt | null>(null);
  const [dropoff, setDropoff] = useState<Pt | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Result | null>(null);
  const [alt, setAlt] = useState<Pt[]>([]);
  const [extra, setExtra] = useState<{ km: number; min: number } | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function fillCurrentLocation() {
    const p = await getCurrentPoint();
    if (!p) {
      setMsg("Location permission is needed.");
      return;
    }
    setFromPt(p);
    setFromText("Current location");
  }

  async function onSearch() {
    Keyboard.dismiss();
    setMsg("");
    setLoading(true);
    setResults([]);
    setSelected(null);
    setAlt([]);
    setExtra(null);
    setSentTo(null);
    try {
      const from =
        fromPt ??
        (fromText.trim() ? await geocode(fromText) : await getCurrentPoint());
      const to = await geocode(toText);
      if (!from || !to) {
        setMsg("Could not find one of the places. Try adding the city.");
        return;
      }
      setPickup(from);
      setDropoff(to);

      // Save (or update) this passenger's open request so drivers can see it.
      const row = {
        passengerId: TEST_PASSENGER_ID,
        pickupLat: from.lat,
        pickupLng: from.lng,
        dropoffLat: to.lat,
        dropoffLng: to.lng,
        departAt: when.toISOString(),
        selectedRideId: null,
        status: "open",
        needsApproval: false,
      };
      if (requestId) {
        const { error } = await supabase
          .from("ride_requests")
          .update(row)
          .eq("id", requestId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("ride_requests")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        setRequestId(data.id);
      }

      // Find open trips for that day.
      const { from: a, to: b } = dayRange(when);
      const { data, error } = await supabase
        .from("rides")
        .select(
          `rideId, startLat, startLng, endLat, endLng, tripMdd, maxExtraKm, route,
                 drivers ( driverRating, mdd, users ( firstName, lastName ) )`,
        )
        .gte("departAt", a)
        .lte("departAt", b)
        .eq("isCompleted", false)
        .eq("occupied", false);
      if (error) throw error;

      const list: Result[] = [];
      for (const r of (data ?? []) as unknown as RideRow[]) {
        if (!r.route?.points?.length) continue;
        const mdd = r.tripMdd ?? r.drivers?.mdd ?? 2;
        const maxExtra = r.maxExtraKm ?? 2;
        const c = classifyTrip(r.route.points, from, to, mdd, maxExtra);
        if (c.zone === "out") continue;
        const u = r.drivers?.users;
        list.push({
          rideId: r.rideId,
          driverName: u ? `${u.firstName} ${u.lastName}` : "Driver",
          rating: r.drivers?.driverRating ?? null,
          zone: c.zone,
          pickupKm: c.pickupKm,
          dropoffKm: c.dropoffKm,
          tripKm: r.route.distanceKm,
          tripMin: r.route.durationMin,
          route: r.route.points,
          start: { lat: r.startLat, lng: r.startLng },
          end: { lat: r.endLat, lng: r.endLng },
        });
      }
      list.sort((x, y) =>
        x.zone === y.zone
          ? x.pickupKm + x.dropoffKm - (y.pickupKm + y.dropoffKm)
          : x.zone === "in_range"
            ? -1
            : 1,
      );
      setResults(list);
      if (list.length === 0) setMsg("No drivers on your route for that time.");
    } catch (e) {
      console.error(e);
      setMsg("Something went wrong. Check the terminal for the error.");
    } finally {
      setLoading(false);
    }
  }

  // Show the driver's route, plus a new route that goes through the passenger's points.
  async function onSelect(r: Result) {
    setSelected(r);
    setAlt([]);
    setExtra(null);
    if (!pickup || !dropoff) return;
    const rr = await getRoute([r.start, pickup, dropoff, r.end]);
    if (rr) {
      setAlt(rr.points);
      setExtra({
        km: rr.distanceKm - r.tripKm,
        min: rr.durationMin - r.tripMin,
      });
    }
  }

  async function onRequest(r: Result) {
    if (!requestId) return;
    const { error } = await supabase
      .from("ride_requests")
      .update({
        selectedRideId: r.rideId,
        status: "pending",
        needsApproval: r.zone === "needs_approval",
      })
      .eq("id", requestId);
    if (error) {
      console.error(error);
      setMsg("Could not send the request.");
      return;
    }
    setSentTo(r.rideId);
  }

  const markers: MapMarker[] = [];
  if (pickup) markers.push({ id: "pickup", point: pickup, color: "#16a34a" });
  if (dropoff)
    markers.push({ id: "dropoff", point: dropoff, color: "#dc2626" });

  return (
    <View style={styles.screen}>
      <RouteMap
        route={selected?.route ?? []}
        altRoute={alt}
        markers={markers}
        padding={{ top: 300, right: 40, bottom: 340, left: 40 }}
      />

      <View style={styles.panel}>
        <Link href="/" style={styles.link}>
          I'm a driver
        </Link>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="From (empty = my location)"
            value={fromText}
            onChangeText={(t) => {
              setFromText(t);
              setFromPt(null);
            }}
          />
          <Pressable style={styles.small} onPress={fillCurrentLocation}>
            <Text>Here</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="To (address)"
          value={toText}
          onChangeText={setToText}
        />
        <DateTimeField value={when} onChange={setWhen} />

        <Pressable style={styles.button} onPress={onSearch} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Search drivers</Text>
          )}
        </Pressable>
        {!!msg && <Text style={styles.msg}>{msg}</Text>}
      </View>

      {results.length > 0 && (
        <View style={styles.sheet}>
          <FlatList
            data={results}
            keyExtractor={(r) => r.rideId}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.item,
                  selected?.rideId === item.rideId && styles.itemSelected,
                ]}
                onPress={() => onSelect(item)}
              >
                <Text style={styles.title}>
                  {item.driverName}
                  {item.rating ? `  ·  rating ${item.rating}` : ""}
                </Text>
                <Text>
                  Your pickup is {item.pickupKm.toFixed(1)} km from their route
                  {item.zone === "needs_approval"
                    ? " (driver will be asked to approve)"
                    : ""}
                </Text>
                <Text>
                  Trip: {item.tripKm.toFixed(1)} km, about{" "}
                  {Math.round(item.tripMin)} min
                </Text>

                {selected?.rideId === item.rideId && (
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {extra && (
                      <Text>
                        With you the trip is +{Math.max(0, extra.km).toFixed(1)}{" "}
                        km and +{Math.max(0, Math.round(extra.min))} min for the
                        driver.
                      </Text>
                    )}
                    {sentTo === item.rideId ? (
                      <Text style={styles.link}>
                        Request sent. Waiting for the driver.
                      </Text>
                    ) : (
                      <Pressable
                        style={styles.button}
                        onPress={() => onRequest(item)}
                      >
                        <Text style={styles.buttonText}>
                          Request this driver
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  panel: {
    position: "absolute",
    top: 48,
    left: 12,
    right: 12,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 12,
    borderRadius: 12,
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  small: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  msg: { color: "#3f3f46" },
  link: { color: "#2563eb", fontWeight: "600" },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    maxHeight: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
  },
  item: { padding: 10, borderRadius: 8, gap: 2 },
  itemSelected: { backgroundColor: "#eff6ff" },
  title: { fontSize: 16, fontWeight: "700" },
});
