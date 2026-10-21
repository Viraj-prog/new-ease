import { Link } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimeField from "../components/DateTimeField";
import RouteMap, { type MapMarker } from "../components/RouteMap";
import { TEST_DRIVER_ID } from "../lib/config";
import {
  classifyTrip,
  dayRange,
  localDate,
  type Pt,
  type Zone,
} from "../lib/geo";
import { geocode, getCurrentPoint, getRoute } from "../lib/routing";
import { supabase } from "../lib/supabase";

type Trip = {
  rideId: string;
  route: Pt[];
  mdd: number;
  extra: number;
  when: Date;
};
type Req = {
  id: string;
  status: string;
  zone: Zone;
  pickupKm: number;
  dropoffKm: number;
  pickup: Pt;
};

export default function DriverPage() {
  const [startText, setStartText] = useState("");
  const [startPt, setStartPt] = useState<Pt | null>(null);
  const [endText, setEndText] = useState("");
  const [when, setWhen] = useState(new Date());
  const [mddText, setMddText] = useState("2");
  const [extraText, setExtraText] = useState("2");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [selected, setSelected] = useState<Req | null>(null);

  async function fillCurrentLocation() {
    const p = await getCurrentPoint();
    if (!p) {
      setMsg("Location permission is needed.");
      return;
    }
    setStartPt(p);
    setStartText("Current location");
  }

  async function onSchedule() {
    Keyboard.dismiss();
    setMsg("");
    setLoading(true);
    setSelected(null);
    setRequests([]);
    try {
      const start = startPt ?? (await geocode(startText));
      const end = await geocode(endText);
      if (!start || !end) {
        setMsg("Could not find one of the places. Try adding the city.");
        return;
      }

      const r = await getRoute([start, end]);
      if (!r) {
        setMsg("No road route found between those places.");
        return;
      }

      const mdd = parseFloat(mddText) || 2;
      const extra = parseFloat(extraText) || 2;

      const { data, error } = await supabase
        .from("rides")
        .insert({
          driverId: TEST_DRIVER_ID,
          driverStartLocation: startText,
          driverEndLocation: endText,
          date: localDate(when),
          departAt: when.toISOString(),
          startLat: start.lat,
          startLng: start.lng,
          endLat: end.lat,
          endLng: end.lng,
          tripMdd: mdd,
          maxExtraKm: extra,
          route: {
            points: r.points,
            distanceKm: r.distanceKm,
            durationMin: r.durationMin,
          },
          isCompleted: false,
          occupied: false,
        })
        .select("rideId")
        .single();
      if (error) throw error;

      setTrip({ rideId: data.rideId, route: r.points, mdd, extra, when });
      setMsg(
        `Trip posted: ${r.distanceKm.toFixed(1)} km, about ${Math.round(r.durationMin)} min`,
      );
    } catch (e) {
      console.error(e);
      setMsg("Something went wrong. Check the terminal for the error.");
    } finally {
      setLoading(false);
    }
  }

  // Load passengers near the route, and refresh every 10 seconds.
  useEffect(() => {
    if (!trip) return;
    let cancelled = false;

    async function load() {
      if (!trip) return;
      const { from, to } = dayRange(trip.when);
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*")
        .gte("departAt", from)
        .lte("departAt", to)
        .or(
          `status.eq.open,and(status.eq.pending,selectedRideId.eq.${trip.rideId})`,
        );
      if (error) {
        console.error(error);
        return;
      }

      const found: Req[] = [];
      for (const r of data ?? []) {
        const pickup = { lat: r.pickupLat, lng: r.pickupLng };
        const dropoff = { lat: r.dropoffLat, lng: r.dropoffLng };
        const c = classifyTrip(
          trip.route,
          pickup,
          dropoff,
          trip.mdd,
          trip.extra,
        );
        if (c.zone === "out") continue;
        found.push({ id: r.id, status: r.status, pickup, ...c });
      }
      if (!cancelled) setRequests(found);
    }

    load();
    const t = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [trip]);

  async function respond(req: Req, accept: boolean) {
    if (!trip) return;
    const { error } = await supabase
      .from("ride_requests")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", req.id);
    if (error) {
      console.error(error);
      return;
    }
    if (accept) {
      await supabase
        .from("rides")
        .update({ occupied: true })
        .eq("rideId", trip.rideId);
    }
    setRequests((rs) => rs.filter((r) => r.id !== req.id));
    setSelected(null);
  }

  const markers: MapMarker[] = requests.map((r) => ({
    id: r.id,
    point: r.pickup,
    color: r.zone === "in_range" ? "#16a34a" : "#f97316",
    onPress: () => setSelected(r),
  }));

  return (
    <View style={styles.screen}>
      <RouteMap route={trip?.route ?? []} markers={markers} />

      <View style={styles.panel}>
        <Link href="/passenger" style={styles.link}>
          I'm a passenger
        </Link>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Start (address)"
            value={startText}
            onChangeText={(t) => {
              setStartText(t);
              setStartPt(null);
            }}
          />
          <Pressable style={styles.small} onPress={fillCurrentLocation}>
            <Text>Here</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Destination (address)"
          value={endText}
          onChangeText={setEndText}
        />
        <DateTimeField value={when} onChange={setWhen} />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="MDD (km)"
            value={mddText}
            onChangeText={setMddText}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            placeholder="Extra I'd drive (km)"
            value={extraText}
            onChangeText={setExtraText}
          />
        </View>

        <Pressable
          style={styles.button}
          onPress={onSchedule}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Schedule</Text>
          )}
        </Pressable>
        {!!msg && <Text style={styles.msg}>{msg}</Text>}
      </View>

      {selected && trip && (
        <View style={styles.card}>
          <Text style={styles.title}>
            {selected.zone === "in_range"
              ? "Passenger on your route"
              : "Passenger a bit off your route"}
          </Text>
          <Text>
            Pickup is {selected.pickupKm.toFixed(1)} km from your route,
            drop-off {selected.dropoffKm.toFixed(1)} km.
          </Text>
          {selected.zone === "needs_approval" && (
            <Text style={styles.warn}>
              That is about{" "}
              {(
                Math.max(selected.pickupKm, selected.dropoffKm) - trip.mdd
              ).toFixed(1)}{" "}
              km beyond your usual limit. Are you willing to drive the extra
              distance?
            </Text>
          )}
          {selected.status === "pending" ? (
            <View style={styles.row}>
              <Pressable
                style={[styles.button, { flex: 1 }]}
                onPress={() => respond(selected, true)}
              >
                <Text style={styles.buttonText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.decline, { flex: 1 }]}
                onPress={() => respond(selected, false)}
              >
                <Text style={styles.buttonText}>Decline</Text>
              </Pressable>
            </View>
          ) : (
            <Text>Waiting for this passenger to choose a driver.</Text>
          )}
          <Pressable onPress={() => setSelected(null)}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
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
  decline: { backgroundColor: "#71717a" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  msg: { color: "#3f3f46" },
  link: { color: "#2563eb", fontWeight: "600" },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    gap: 8,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
  },
  title: { fontSize: 16, fontWeight: "700" },
  warn: { color: "#c2410c" },
});
