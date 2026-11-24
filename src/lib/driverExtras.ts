import type { Result } from '@/lib/rides';

// The database has no vehicle, trip-count or arrival data yet, so these are placeholders that
// stay the same for a given ride. Replace this file's functions once the columns exist.
const CARS = [
  { model: 'Toyota Corolla', color: 'Silver', year: 2021 },
  { model: 'Honda Civic', color: 'Blue', year: 2020 },
  { model: 'Hyundai Elantra', color: 'White', year: 2022 },
  { model: 'Mazda 3', color: 'Red', year: 2019 },
  { model: 'Kia Forte', color: 'Black', year: 2021 },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export type DriverExtras = {
  car: string; // "Silver · 2021" style line is built from color + year
  model: string;
  detail: string;
  plate: string;
  trips: number;
  minAway: number;
};

export function driverExtras(r: Result): DriverExtras {
  const h = hash(r.rideId);
  const car = CARS[h % CARS.length];
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  // `>>>` (not `>>`) keeps the shifted number positive. A signed shift went negative for about
  // half of all ride ids, which looked up a letter that does not exist and printed "undefined".
  const plate = `${letters[h % letters.length]}${letters[(h >>> 3) % letters.length]}${
    letters[(h >>> 6) % letters.length]
  } ${1000 + (h % 9000)}`;
  return {
    car: car.model,
    model: car.model,
    detail: `${car.color} · ${car.year}`,
    plate,
    trips: 40 + (h % 360),
    minAway: Math.max(2, Math.round(r.pickupKm * 2) + 2),
  };
}

// The first driver offered: best rating, then lowest price. Drivers with no rating rank last.
// On a full tie the earliest in the list wins.
export function pickBest(drivers: Result[], priceOf: (r: Result) => number = () => 0): Result | null {
  let best: Result | null = null;
  for (const d of drivers) {
    if (!best) {
      best = d;
      continue;
    }
    const a = d.rating ?? -1;
    const b = best.rating ?? -1;
    if (a > b || (a === b && priceOf(d) < priceOf(best))) best = d;
  }
  return best;
}

// The designs colour the avatars in a fixed order (gold, blue, green, purple, red).
const SLOTS = [2, 4, 1, 0, 3];
export const avatarSlot = (i: number) => SLOTS[i % SLOTS.length];
