# Deferred Android tests

## High priority

1. **Phase 5 · Live overlap and rollback.** Schedule a second ride just after the original route of the first ride ends. From Android, accept a rider whose pickup plan would extend the first ride into the second. Expect “The pickup plan would overlap another scheduled ride.” In Supabase, compare the ride’s `plan`, the request’s status, `acceptedRideId` and price, and all associated offers before and after. Expect every value to stay unchanged, including any other pending offers.
2. **Phase 5 · Tap Retry after an OSRM failure.** Keep Supabase reachable and temporarily block or time out OSRM for an uncached acceptance. Tap Accept and verify the pending request and prior plan are unchanged. Restore OSRM and tap **Retry**. Expect one acceptance and one complete saved plan. Repeat from Home and **View requests** if both are available.
3. **Phase 5 · Live cap rejection with real passengers.** Use real rider accounts on a ride where adding one request produces no valid route within every passenger’s 1.5× cap. Record the accepted list, the candidate’s offer status and the existing plan before tapping Accept. Expect “Accepting this passenger would make another passenger’s ride too long” and unchanged Supabase rows. If step 3 filters the request first, verify it is unavailable and use a request that becomes invalid between list refresh and acceptance to exercise the accept-time guard.

## Phase 1 · Driver scheduling

- **Verify stored price and ride status.** Schedule a ride with a nonzero price per kilometre and inspect the row in Supabase. Expect the entered `pricePerKm` and `status = scheduled`.
- **Verify both non-overlapping rides persisted.** Schedule two rides for the same driver and date with enough time between them. After an overlapping third attempt is rejected, open Scheduled Rides or inspect Supabase. Expect both original rides to remain and no third ride. The overlap warning itself was already confirmed.

## Phase 2 · Passenger search and fare

- **Verify day and account exclusions.** From the same account that posted one ride, search as a rider with a matching ride from a different driver on the selected date and another on a different date. Expect the other driver’s same-day ride only.
- **Verify stored direct trip metrics.** Preview and search for a known rider route, then inspect the new request in Supabase. Expect `directKm` and `directMin` to match the preview’s direct route, before the request is accepted. Departure ranking, fares, and the Pending entry were already confirmed on Android.

## Phase 3 · Scheduled Rides and history

- **Verify finished ride tab membership.** Finish a scheduled test ride and open **Scheduled Rides**. Expect it under **History** with a green check, and absent from **Pending**. The four Redo cases were already confirmed.
- **Verify an in-progress entry in Pending.** Use a scheduled test ride whose stored status is `in_progress` through a controlled test setup. In Driver mode, open **Scheduled Rides → Pending**. Expect the active ride to appear with an **In progress** label and no History entry until it is finished. The Android Start trip action that records this status belongs to a later phase.

## Phase 4 · Offers and cancellation

- **First driver to accept wins.** Send one rider request to matching drivers A and B. Verify both offers share the same request ID in Supabase. Accept from A. Refresh B’s request list and the rider’s Trips screen. Expect one accepted booking with A, B’s offer closed, and the rider absent from B’s available requests.
- **Accept a searching rider directly.** Search without sending an offer. Open a matching ride’s **View requests** as the driver. Expect the rider to appear as **A passenger** under **Nearby riders**. Accept and expect one booking, with the name visible after acceptance.
- **Rider cancellation removes the booking.** Cancel an accepted booking from the rider’s Pending tab. Refresh **View requests** as the driver. Expect that rider to leave Accepted passengers and the cancelled entry to appear in rider History.
- **Rider stays put after a driver cancels.** Cancel a scheduled ride that has an accepted rider. Watch the rider’s app for one refresh cycle, and repeat with it closed until after the cancellation. Expect only the cancellation notice: the rider stays on the same page, and nothing opens by itself. The search stays under **Scheduled Trips → Pending** with **Find drivers**.

## Phase 5 · Pickup planning

- **Three passengers and persisted stop order.** Accept three compatible riders, using both Home and **View requests**. Verify every pickup precedes its matching drop-off and each rider’s routed onboard duration is within 1.5× their direct time. Check numbered markers, list labels, kilometres and duration, then reopen the ride and verify the same saved plan is shown.
- **Recheck remaining candidates.** Keep both a pending offer and a nearby searching rider on the list before accepting a passenger. After acceptance, expect remaining eligible requests to show fare and extra kilometres against the updated plan. A candidate who violates any cap, maximum divergence, or travel direction should be hidden or explained as unavailable.
- **Verify candidate fare and distance.** For a matching request, compare the displayed fare with the driver’s rate multiplied by the rider’s direct kilometres. Compare extra kilometres with the full candidate route distance minus the current plan distance, or the original route distance when there is no plan.
- **Replan after rider cancellation.** Accept two riders, cancel one booking as the rider, then reopen or refresh the scheduled ride as the driver. Expect the saved plan to omit the cancelled rider’s stops and ID, and the map and totals to reflect the remaining rider. Repeat for the last rider to verify the original route is restored.
- **Verify lazy evaluation and caching.** Use a ride with more than ten candidates. Open the requests list and observe network activity during refresh and ordinary rerenders. Expect candidate work to start in limited batches and repeated work for unchanged stops to reuse cached routing results.

## Phase 6 · Start, Resume, and Finish

- **Start with accepted passengers.** From Home, tap **Start trip** on a scheduled ride that has a saved pickup plan. Expect the ride to become `in_progress`, `startedAt` to be set, and Google Maps to open from your current location with pickups and drop-offs in the saved order, ending at the ride destination. Check that the sample navigation screen never appears.
- **Start a ride with no passengers.** From **Scheduled Rides → Pending**, tap **Start trip** on a ride with no accepted passengers. Expect Google Maps to use the ride’s own start and destination.
- **Split a long route.** Start a ride whose plan has more than three intermediate stops. Check each Maps leg in order. Expect the previous leg’s destination to be the next leg’s origin, every planned stop to appear in sequence, and the last leg to end at the ride destination.
- **Resume after leaving the app.** Reopen the in-progress ride, including after closing and relaunching the app. Tap **Resume** and verify it opens the same route leg. After completing that leg, advance to the next leg and verify Resume opens the new leg.
- **Browser fallback.** Disable Google Maps on the Android test device, then open a ride leg. Expect the browser to open the ordered directions for that leg. Re-enable Maps afterward.
- **Enforce in-progress rules.** Start a ride with an accepted passenger and a pending offer. Confirm the pending offer closes and the accepted passenger stays booked. Verify acceptance and cancellation are unavailable in the driver and rider UI, and that an attempted action from a stale screen is rejected by Supabase without changing the ride or booking.
- **Finish and verify fares.** Finish an in-progress ride that has two accepted riders with distinct fares. Expect `status = completed`, a populated `completedAt`, disappearance from Pending, and each passenger’s fare in Previous Trips and History.
