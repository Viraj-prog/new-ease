# Ease: final app spec (instructions for Codex)

**Status: DRAFT. Part 1 of several.** Sections marked TBD are still being decided with the user. Do not implement anything marked TBD.

---

## 1. How to work

1. Read `AGENTS.md` first and follow it. This file only adds rules specific to this task.
2. Work **one phase at a time** (the phase list comes in a later part). After each phase, stop, summarise what changed, and wait for the user to test on their phone before starting the next one.
3. If a requirement is unclear, ask the user. Do not guess.
4. **You cannot reach the Supabase database.** Never assume a schema change has been applied. For any database change:
   - Write a new SQL script in `supabase/migrations/`, named `NNN_short_description.sql` (NNN = next number, starting at `001`).
   - Make it **safe to run more than once** (`if not exists`, `create or replace`, `drop ... if exists`), in the same style as `supabase/driver_setup.sql`.
   - Tell the user exactly what to do: "Run `supabase/migrations/NNN_...sql` in the Supabase SQL editor, then tell me when it succeeded."
   - Do **not** write app code that depends on the new schema until the user confirms the script ran.
   - Do not edit `driver_setup.sql`. It is the historical setup file.
5. Keep row-level security (RLS) on. Every new table or column that the app touches needs policies or function checks that stop a user from reading or changing other users' data. State in your summary which policies you added.
6. Do not add a package with native code without telling the user first, because it forces a full rebuild with `npm run android`. Use `npx expo install` for any package.
7. Never create, edit or commit `.env.local` or any secret.
8. Before declaring a phase done, run `npx expo lint` and `npx tsc --noEmit` and fix what they report.
9. Follow the existing code style: TypeScript, `StyleSheet`, colours from `@/styles/global`, the `@/` import alias, routes only in `src/app/`, everything else outside it.
10. Reuse what already works. Do not rewrite the map component, `routing.ts`, `geo.ts`, auth, or the popups unless a phase says so.
11. Target platform is **Android**, run as a development build (`npm run android`). MapLibre does not work in Expo Go.
12. Distances are in **kilometres** everywhere in the UI and data.

---

## 2. What the app looks like today (so you do not rediscover it)

- Expo SDK 57, Expo Router, routes in `src/app/`. `src/app/_layout.tsx` uses `Stack.Protected` to send logged-out users to `login` and logged-in users to the `(drawer)` group.
- `src/app/(drawer)/` has `index` (Home), `rides`, `profile`, `settings`.
- **Home (`index.tsx`, ~490 lines) serves both roles.** It switches on `driverMode` from `useAuth()`: drivers see "Post Ride" and passengers see "Find Ride". The inputs live in a bottom sheet.
- Role today: `users.isDriver` in the database, set by the `become_driver()` function (Settings), plus a per-device preference `driverMode` kept in `src/lib/auth.tsx`.
- Data layer: `src/lib/rides.ts`. Hooks: `useDriverFlow`, `usePassengerFlow`, `useMyRides`, `useProfile`. Routing: `src/lib/routing.ts` (OSRM). Detour logic: `src/lib/geo.ts`.
- Database tables: `users`, `drivers`, `rides`, `ride_requests`. Functions: `become_driver`, `accept_request`, `cancel_booking`, `cancel_ride`, `finish_trip`. Triggers include `guard_one_trip_per_day` and `guard_request_target`.
- **One passenger per ride is enforced in the database** (`rides.occupied`, `rides.requestorId`, and `accept_request` declining the other pending requests). This is going to change.

---

## 3. Product overview (the final app)

### Login and role choice

- Login, signup and password reset stay as they are.
- **After every login**, show a role screen with two large circular buttons, left and right: **Passenger** and **Driver**. The user picks one each time they log in.
- Choosing Driver for the first time registers them as a driver (use the existing `become_driver()` function). Then open the driver screen.
- Choosing Passenger opens the passenger screen.
- The drawer has a **Switch role** item that returns to the role screen.

### Driver screen

- Full-screen map. At the top: **start location** and **drop-off location** inputs.
- Inputs below or beside them: **maximum divergence distance** (how far from the route the driver will go, in km), **date**, **time** (both default to now, both opened with a native picker instead of typing), and **price per km**.
- A **Schedule Ride** button posts the route and saves it.

### Scheduled Rides (driver drawer item)

- Lists all of the driver's scheduled routes in three tabs: **Pending**, **Completed**, **History**.
- Each ride has a **View requests** button that opens a **new page** listing passenger requests for that ride.
- The driver can accept **any number** of requests (no seat limit).
- Accepting passengers creates a **new route** for the driver that picks them up and ends at the original destination (see section 4).

### Passenger screen

- Full-screen map. At the top: **start location**, **destination**, and **date and time** (default now, native picker).
- A **Search** button shows a list of matching drivers at the bottom. The passenger can request a ride from any of them.
- Requested and booked rides go into the passenger's ride history.

---

## 4. Decisions already made

- **Two separate screens** (driver and passenger), not one screen that switches modes. Shared pieces (map, hooks, `rides.ts`) stay shared.
- Role screen appears on **every** login.
- **No limit** on accepted passengers per ride. Remove the one-passenger rule from the database and the app.
- Database changes are delivered as SQL scripts the user runs by hand (section 1, rule 4).
- Units are kilometres. Price is **per km**.
- **Pickup route:** when the driver accepts passengers, compute the order of pickups and drop-offs that gives the **shortest route for the driver**, from the driver's start to the driver's destination, where each passenger is picked up **before** they are dropped off. Use OSRM for distances and the final route. How this is computed, and any limit on each passenger's time in the car, is TBD.

---

## 5. Assumptions to confirm with the user

- A driver can schedule several rides per day as long as their times do not overlap. This means removing the `guard_one_trip_per_day` trigger and replacing it with an overlap check, or dropping the check.
- Ride statuses are `scheduled`, `completed`, `cancelled`. Pending = scheduled, Completed = completed, History = all of them.
- Finishing and cancelling a ride currently both set `isCompleted`; they need to be told apart.

---

## 6. TBD (do not implement yet)

- Passenger in-car time limit for the pickup route.
- How a passenger's fare is calculated and displayed.
- Whether the "Extra Drive" setting and the "needs approval" zone stay.
- Database design, phase list, and acceptance checks for each phase.
