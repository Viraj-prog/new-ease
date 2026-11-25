# Trip flow fixes: plan

Agreed by Fortune on 2026-11-25. **Viraj: please read and agree before step 2 starts.**

The problems below were found by reading the app code and the scripts in `supabase/`, not by
testing every case. The live database may differ from those scripts.

## Rule for every step: keep the UI consistent

Anything new or changed must look and behave like the rest of the app.

- Colours come from `src/styles/theme.ts` (both light and dark) and fonts from
  `src/styles/fonts.ts`. No new hard-coded colours.
- Buttons use `PressButton`. Icons use `Icon`, or Ionicons where the set has no match.
- Cards: `card` background, 1 px `border`, rounded corners (18).
- Reuse existing pieces before making new ones: `SegmentedToggle`, `SettingPopup`, `PopupShell`,
  `InlineNotice`, `ConfirmDialog`, and the History rows in `TripHistory.tsx`.
- Check each changed screen in dark mode, light mode and with large text.

Differences that exist today. Settle each one when its screen is next changed:

| Difference | Where |
| --- | --- |
| **Preview Route** is a pill; **Schedule Ride**, **Find driver** and popup buttons have squarer corners | plan page, route preview, popups |
| **Preview Route** has white text in light mode; other blue buttons have dark text | same |
| History rows press in with no ripple; other buttons ripple | whole app |
| Pending uses the older ride card; History uses the new rows | Scheduled Trips |

Step 7 settled the last one: Pending now has its own card in the same style, and Scheduled Trips
uses the app's popup instead of the phone's. Step 10 replaced the last native alerts in the trip
buttons. The first three differences are still open.

## Decisions

1. Searches expire 1 hour after their time. A driver is asked about an unstarted ride after 3 hours.
2. One open search per rider per day. (This rules out separate morning and evening searches.)
3. Navigation opens Google Maps with the **remaining** stops. The driver marks stops done.
4. **End trip early:** riders still waiting go back to searching, riders in the car are marked
   cancelled, riders already dropped off stay completed.
5. Arrival: ask the driver to confirm when they return to the app near a stop. No background
   location tracking.

## Problems and fixes

**A. Searches and rides that never end.** An open search cannot be cancelled and can be accepted
after the rider gave up; searches pile up; rides never expire.
Fix: list open searches in Pending with **Find drivers** and **Cancel**; cancel abandoned and
duplicate searches; hide expired ones, then have the database refuse them; ask the driver about an
overdue ride (the `ui-changes` branch has `OverdueTripPrompt.tsx` to adapt).

**B. Telling the other person.** Cancellations, declines and trip starts can go unnoticed; the
driver's Home can show a rider who has cancelled, and names only one passenger.
Fix: one in-app checker (every 10 seconds) for accepted, declined, cancelled, started, finished and
new requests; build the booked list from fresh data and show every passenger. Push notifications
come later.

**C. Running a trip.** The app is not told when navigation ends; **Resume** reopens stops already
visited; a started trip cannot be aborted.
Fix: save Picked up / Dropped off / No show for each rider; open Maps with remaining stops; arrival
prompt; **End trip early**.

**D. Home and Pending.** Switching to Driving can replace the plan form with the active ride; Home
shows only the earliest ride; Pending follows the role switch.
Fix: keep the form while scheduling and show the active ride as a small card; show the next ride on
Home; show driving and riding trips together in Pending; make Back leave the ride view.

## Steps

| # | Change | Main files | Database | Status |
| --- | --- | --- | --- | --- |
| 1 | Commit the current work; agree this plan | none | no | committed; plan awaiting Viraj |
| 2 | Split the large Home screen without changing behaviour; remove unused `TripNavigation.tsx` and `RideStatusPopup.tsx` | `index.tsx`, new Home components | no | committed |
| 3 | List open searches in Pending with Cancel | `rides.ts`, `useMyRides.ts`, `rides.tsx` | no | committed |
| 4 | Close abandoned and duplicate searches; hide expired ones | `usePassengerFlow.ts`, `rides.ts`, Home | no | committed |
| 5 | Add the trip-updates checker; replace the cancellation notices | new hook, drawer layout, recovery hook | no | committed |
| 6 | Fix stale bookings and list all passengers | `useDriverFlow.ts`, `TripSheet.tsx`, `rides.ts` | no | committed |
| 7 | Fix Home, Back and Pending flows | Home components, `rides.tsx` | no | committed |
| 8 | Overdue ride popup, including forgotten in-progress trips | new component, drawer layout | no | committed |
| 9 | Refuse expired requests and acceptances | migration `012` | **yes** | committed; `012` run |
| 10 | Stop progress, stop buttons, Resume and arrival prompt | migration `013`, lifecycle and Maps files | **yes** | committed; `013` run |
| 11 | End trip early; correct History for each rider | migration `014`, lifecycle and History files | **yes** | committed; `014` run |
| 12 | Test every case with two accounts; then plan push notifications | none | later | |

Database steps (9 to 11): the script is written first, run by hand in the Supabase SQL editor, and
app code that depends on it is added only after it is confirmed to have worked. Agree step 10
together, because it changes how Google Maps routes are built.
