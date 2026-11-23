# Ease: final app spec (instructions for Codex)

**Status: v1, ready for Codex.** Everything here is decided unless it is listed under "Out of scope for now". Start with Phase 0 only (section 9) and wait for the user before each later phase.

---

## 1. How to work

1. Read `AGENTS.md` first and follow it. This file only adds rules specific to this task.
2. Work **one phase at a time** (the phase list comes in a later part). After each phase, stop, summarise what changed, and wait for the user to test on their phone before starting the next one.
3. If a requirement is unclear, ask the user. Do not guess.
4. **You cannot reach the Supabase database.** Never assume a schema change has been applied. For any database change:
   - Write a new SQL script in `supabase/migrations/`, named `NNN_short_description.sql` (NNN = the next free number, starting at `001`; refer to migrations by their description, not their number).
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
- **After every login**, show a role screen with two large circular buttons, left and right: **Passenger** and **Driver**. The user picks one each time. Keep the chosen role **in memory only** (not saved to the device), so the role screen also appears when the app is opened again from a closed state, even if the login session is still valid.
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
- A **Search** button shows a list of matching drivers at the bottom. Only rides on the **same day** as the requested time are listed, sorted by how close the driver's departure time is to the requested time (closest first, furthest last). Break ties by the smaller detour. Each driver card shows the fare. The passenger can request a ride from any of them.
- Requested and booked rides go into the passenger's ride history.

---

## 4. Decisions already made

- **Two separate screens** (driver and passenger), not one screen that switches modes. Shared pieces (map, hooks, `rides.ts`) stay shared.
- Role screen appears on **every** login.
- **No limit** on accepted passengers per ride. Remove the one-passenger rule from the database and the app.
- Database changes are delivered as SQL scripts the user runs by hand (section 1, rule 4).
- Units are kilometres. Price is **per km**.
- **Pickup route:** when the driver accepts passengers, compute the order of pickups and drop-offs that gives the **shortest route for the driver**, from the driver's start to the driver's destination, where each passenger is picked up **before** they are dropped off. Use OSRM for distances and the final route.
- **Passenger time cap:** no passenger may spend more than **1.5 times** their direct trip time in the car (direct = their own pickup to their own drop-off by road). If no ordering satisfies this for every accepted passenger plus a new one, that new request cannot be accepted.
- **Fare:** `price per km` (set by the driver on the ride) times the **direct distance from the passenger's pickup to their drop-off**. Show it to the passenger before they request, and to the driver on each request.
- **One divergence distance only.** Remove the "Extra Drive" setting (`maxExtraKm`) and the "needs approval" zone. A passenger is eligible when their pickup and drop-off are within the driver's **maximum divergence distance (mdd) of the driver's original posted route**. Eligibility becomes simply in range or out of range.
- **The request list changes after every accept.** After the driver accepts a passenger, re-evaluate every still-pending request against the updated pickup plan (the 1.5x cap above, and the mdd). Requests that no longer fit disappear from the list or are marked unavailable, so the driver is never offered a passenger who would force an unpaid detour. For each remaining request, show its fare and the extra distance it adds to the current route.
- **Which requests a driver sees:** both (a) requests sent to their ride and (b) nearby passengers who are still searching and have not picked a driver. Both must be within the mdd of the original route and travelling in the same direction (pickup before drop-off along the route, as `classifyTrip` already checks). The driver can accept either kind.
- **Several drivers at once:** a passenger can send a request to several drivers. The **first driver to accept wins**. The passenger's other requests close, and the passenger stops appearing in other drivers' lists. Accepting must be atomic in the database.
- **Start trip:** a **Start trip** button on a scheduled ride opens Google Maps with every stop in the planned order (pickups and drop-offs), and records that the trip started. Before writing it, fetch the current Google Maps URLs documentation and check the maximum number of waypoints. If a ride has more stops than that, split the trip into consecutive legs and handle it gracefully. A **Finish trip** button marks the ride completed.
- **Driver cancels a ride that has accepted passengers:** those passengers' requests go back to `open` (searching) so they can find another driver. Clear `"acceptedRideId"` and `"agreedFare"`, mark their offers on that ride `cancelled`, and keep the entry in their history as "Cancelled by driver". The passenger's app must show a clear notice the next time it loads that request.
- **Several rides per day are allowed if they do not overlap.** A ride occupies the time from `"departAt"` to `"departAt"` plus the longer of `route.durationMin` and `plan.durationMin`. Rides with status `cancelled` or `completed` are ignored. Reject a new ride that overlaps another `scheduled` or `in_progress` ride of the same driver. Also reject an `accept_request` whose new plan would make the ride overlap another one of the driver's rides, with a clear error message.
- **Push notifications are wanted**, but they are the last phase (phase 9). Until then the app refreshes automatically about every 10 seconds while it is open, as it does today.
- **Payment is planned but out of scope now.** Passengers will pay in advance in a later version. Do not build payment, and do not add placeholder payment buttons. Just keep storing the fare (`ride_offers.fare` and `ride_requests."agreedFare"`) so payment can be added later.
- **Names:** a passenger who is only searching appears to nearby drivers as **"A passenger"**. Their name is shown only once they have requested that driver's ride, or after they are accepted.

---

## 5. Assumptions (not yet confirmed by the user)

- Ride statuses are `scheduled`, `in_progress`, `completed`, `cancelled`. In the driver's Scheduled Rides tabs, **Pending** = `scheduled` and `in_progress`, **Completed** = `completed`, **History** = every status including `cancelled`.
- Finishing and cancelling a ride currently both set `isCompleted`; they need to be told apart.
- First-time Driver registration uses the existing `become_driver()` function.

---

## 6. Out of scope for now

Do not build these. If a task seems to need one of them, ask the user first.

- In-app payment (planned for later, see section 4).
- Ratings and reviews after a trip.
- Chat between driver and passenger.
- In-app turn-by-turn navigation (the Start trip button hands off to Google Maps instead).
- iOS. Android only.
- Estimated pickup times shown to passengers.

---

## 7. Database design

First, **do not trust this section's column names blindly.** `driver_setup.sql` is a patch file, not the full schema. Phase 0 (section 9) has you collect the real schema from the user before writing any migration.

Existing tables: `users`, `drivers`, `rides`, `ride_requests` (names and quoted camelCase columns as in `driver_setup.sql`). Keep that naming style.

### Changes to `rides`

- Add `"pricePerKm" numeric` (not null for new rides, check >= 0).
- Add `"status" text not null default 'scheduled'` with a check for `scheduled`, `in_progress`, `completed`, `cancelled`. Backfill: rows with `"isCompleted" = true` become `completed`.
- Add `"startedAt" timestamptz` and `"completedAt" timestamptz`.
- Add `"plan" jsonb`: the current pickup plan, shaped like `{ stops: [{ type: 'pickup'|'dropoff', requestId, lat, lng }], points: [{lat,lng}], distanceKm, durationMin, passengerIds: [uuid] }`.
- Stop using `occupied`, `requestorId` and `"maxExtraKm"`. Leave the columns in place until the cleanup phase, then drop them.
- Replace the `guard_one_trip_per_day` trigger with an **overlap check** (see section 4): a new or rescheduled ride may not overlap another `scheduled` or `in_progress` ride of the same driver.

### Changes to `ride_requests` (the passenger's search)

- Add `"directKm" numeric` and `"directMin" numeric` (the passenger's own pickup-to-drop-off road distance and time, computed in the app with OSRM when the search is saved).
- Add `"acceptedRideId" uuid` and `"agreedFare" numeric`.
- `status` becomes `open` (searching), `accepted`, or `cancelled`. The old `pending` and `declined` states move to the new table below. Stop using `"selectedRideId"` and `"needsApproval"`.

### New table `ride_offers` (a passenger's request to one ride)

- `id uuid primary key default gen_random_uuid()`
- `"requestId" uuid references ride_requests(id) on delete cascade`
- `"rideId" uuid references rides("rideId") on delete cascade`
- `status text not null default 'pending'` with a check for `pending`, `accepted`, `declined`, `taken`, `cancelled` (`cancelled` = the driver cancelled the ride after accepting)
- `fare numeric` (set by the database as `"pricePerKm"` times `"directKm"`, never by the client)
- `"createdAt" timestamptz default now()`
- `unique ("requestId", "rideId")`

### Functions (all `security definer`, `set search_path = public`, check `auth.uid()`, `revoke all ... from public, anon`, `grant execute ... to authenticated`)

- `send_offer(request_id, ride_id)`: passenger only, own request only, ride must be `scheduled` and not their own.
- `accept_request(request_id, ride_id, new_plan jsonb)`: driver of the ride only. Works for an offer in `pending` **or** a searching (`open`) request with no offer yet. In one transaction it checks the request is still `open`, marks it `accepted` with `"acceptedRideId"` and `"agreedFare"`, marks that offer `accepted` (creating it if needed), marks the passenger's other offers `taken`, and saves `new_plan` on the ride. If the request was already accepted by someone else, raise a clear error.
- `decline_offer(request_id, ride_id)`, `cancel_booking(request_id)`, `start_trip(ride_id)`, `finish_trip(ride_id)`: rewritten for the new statuses.
- `cancel_ride(ride_id)`: sets the ride `cancelled`, marks its open offers `declined` and its accepted offers `cancelled`, and returns every passenger whose request was accepted on it to `open`.
- `cancel_booking(request_id)`: a passenger cancelling an accepted booking sets the request `cancelled` and the offer `cancelled`. The ride's plan is recomputed by the driver app (section 8).
- **Lock order:** always lock the ride row before the request row, in every function, so two calls cannot deadlock.
- The database cannot recompute OSRM routes, so the 1.5x time cap and the mdd check are enforced in the app. Say so in a comment in the SQL.

### Row-level security

- `ride_offers`: a passenger reads offers for their own requests, a driver reads offers for their own rides, and nobody inserts or updates directly (only through the functions above).
- A driver may read `ride_requests` rows that are `open` or that have an offer on one of their rides, and nothing else.
- Replace the policy `users read requesters of my rides`: a driver may read a passenger's name only if that passenger has an offer (`pending` or `accepted`) on one of the driver's rides. Searching passengers who have not requested that driver must not be readable, and the app shows "A passenger" for them.

---

## 8. Pickup plan

- Inputs: the driver's start and destination, and for each accepted passenger a pickup point and a drop-off point.
- Goal: the stop order with the **lowest total driving time**, such that every pickup comes before its own drop-off and every passenger's time between pickup and drop-off is at most **1.5 times** their direct trip time (`"directMin"`).
- Get driving times between all stops with one OSRM `table` request, then search the orderings. For up to about 5 passengers, check every valid ordering. For more, build the order by cheapest insertion and then improve it with simple swaps. Always validate the final order against the 1.5x cap.
- Then call the existing `getRoute()` with the stops in order to get the road line, distance and time. Save it as the ride's `plan` through `accept_request`.
- **The plan is derived data.** Store `passengerIds` in it. When the driver opens a ride and the accepted passengers differ from `plan.passengerIds` (for example, a passenger cancelled), recompute and save it.
- To judge a candidate request, compute the plan **with** that passenger added. Show its fare and the extra kilometres it adds compared with the current plan. If no valid ordering exists, the request is not offered.
- The public OSRM server is shared and rate limited. Cache results and avoid calling it on every render.

---

## 9. Phases and acceptance checks

Do one phase at a time. After each phase, list the manual tests below for the user to run on their phone, and wait.

**Rule for every migration:** do not drop or change anything the currently shipped app code still uses until the phase that replaces that code.

### Phase 0: schema check (no code changes)

- Write a read-only SQL query that lists the real columns, constraints, triggers, functions and policies for `users`, `drivers`, `rides`, `ride_requests`. The user runs it in the Supabase SQL editor and pastes the result.
- Adjust sections 7 and 8 to the real schema and show the user what changed.
- **Done when:** the user has pasted the output and approved the adjusted design.

### Phase 1: role screen and split routes (no database changes)

- Role screen after login with two circular buttons. Separate driver and passenger screens and drawers. A **Switch role** drawer item. Choosing Driver the first time calls `become_driver()`.
- **Test:** log in, see the role screen. Driver opens the driver screen, Passenger opens the passenger screen. The drawers differ. Switch role returns to the role screen. Close and reopen the app, and the role screen shows again. A brand-new account choosing Driver becomes a driver. Log out works.

### Phase 2: driver screen and rides migration

- Rides migration (next free number, see section 1): `pricePerKm`, `status`, `startedAt`, `completedAt`, `plan`, the overlap check replacing `guard_one_trip_per_day`.
- Driver screen: inputs at the top over a full-screen map (start, drop-off, max divergence distance, date and time with native pickers defaulting to now, price per km), and a **Schedule Ride** button. Remove the Extra Drive setting.
- **Test:** schedule a ride with a price. It is saved with status `scheduled`. A second non-overlapping ride on the same day works. An overlapping ride is rejected with a clear message.

### Phase 3: passenger screen

- Inputs at the top (start, destination, date and time defaulting to now), Search, and the driver list (same day only, sorted by departure-time closeness, with the fare). Save `directKm` and `directMin` on the request (needs a small migration in this phase, using the next free number).
- **Test:** the list shows only same-day rides, closest time first, with a fare. The passenger's own rides are excluded. Requesting a ride works.

### Phase 4: Scheduled Rides and history

- Driver drawer item **Scheduled Rides** with tabs Pending, Completed, History. Passenger drawer item with the passenger's ride history.
- **Test:** a cancelled ride appears only under History. A finished ride appears under Completed and History. Pending shows scheduled and in-progress rides.

### Phase 5: requests and multi-accept (offers migration)

- Offers migration (next free number): `ride_offers`, request changes, the new functions and policies (section 7).
- **View requests** page per ride. Drivers see requests sent to them and nearby searching passengers (as "A passenger" until they have requested that driver).
- **Test:** two passengers request one ride and the driver accepts both. One passenger requests two drivers, driver A accepts, and driver B's request closes and the passenger disappears from B's list. A driver can accept a searching passenger directly. A driver cancelling a ride sends its accepted passengers back to searching with a notice.

### Phase 6: pickup plan

- Section 8. Recompute the plan on every accept. Re-check the remaining requests after each accept. Show each request's fare and extra kilometres.
- **Test:** with three passengers, every pickup comes before its drop-off and no passenger's ride exceeds 1.5 times their direct time. A request that would break that disappears from the list. If an accepted passenger cancels, opening the ride recomputes the plan.

### Phase 7: Start trip and Finish trip

- Section 4, Start trip. Google Maps hand-off with stops in plan order. Status changes to `in_progress`, then `completed` on Finish.
- **Test:** Start trip opens Google Maps with the right stops in order. A ride with more stops than Google Maps allows is handled without crashing.

### Phase 8: cleanup

- A final migration that drops unused columns and old functions (`occupied`, `requestorId`, `maxExtraKm`, `selectedRideId`, `needsApproval`, old triggers). Remove dead code. `npx expo lint` and `npx tsc --noEmit` pass. Run the full test list from every phase again.

### Phase 9: push notifications

- Notify: the driver when a passenger requests their ride or cancels a booking; the passenger when their request is accepted, when the driver cancels, and when the trip starts.
- Read the current Expo push-notification docs for this SDK first (see `AGENTS.md`). Do not assume Expo Go supports it. It needs the development build.
- Store push tokens in a new `push_tokens` table with row-level security (a user may write and read only their own token). Send notifications from Supabase with a database trigger or webhook calling an Edge Function that uses the Expo push service. The user cannot run the Supabase CLI, so write the function code and give them step-by-step instructions to create it in the Supabase dashboard.
- **Before starting, tell the user what they must set up themselves** (for example, Firebase Cloud Messaging credentials for Android, and uploading them through EAS) and **wait until they confirm.** Do not guess credentials.
- **Test:** with the app closed, a new request produces a notification on the driver's phone, and an accept produces one on the passenger's phone.
