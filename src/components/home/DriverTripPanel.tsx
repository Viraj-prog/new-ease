import ConfirmDialog from '@/components/ConfirmDialog';
import InlineNotice from '@/components/InlineNotice';
import { PlannedRouteSummary } from '@/components/RoutePreview';
import TripLifecycleActions from '@/components/TripLifecycleActions';
import TripSheet from '@/components/TripSheet';
import { NextStop, StopChecklist } from '@/components/TripStops';
import type { useDriverFlow } from '@/hooks/useDriverFlow';
import { useNotify } from '@/lib/notify';
import { errText } from '@/lib/places';
import type { Req, Trip } from '@/lib/rides';
import { endTripEarly } from '@/lib/stopProgress';
import { useState } from 'react';

type Props = {
  driver: ReturnType<typeof useDriverFlow>;
  trip: Trip;
  message: string;
  cancelling: boolean;
  // Accept or decline a request: the one in the popup unless another is given.
  onAnswer: (accept: boolean, request?: Req) => void;
  onStarted: () => void;
  // The trip was finished, or cancelled under way.
  onFinished: () => void;
  onCancel: () => void;
  onScheduleAnother: () => void;
};

// The driver's posted trip on the Home sheet: its planned route, any problem, who is on it or
// asking to be, and the buttons that start, finish or cancel it.
export default function DriverTripPanel(p: Props) {
  const { driver, trip } = p;
  const inProgress = trip.status === 'in_progress';
  const retryPassenger = driver.acceptError?.retry;
  const notify = useNotify();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  async function endEarly() {
    setEnding(true);
    try {
      await endTripEarly(trip.rideId);
      setConfirmEnd(false);
      notify({ kind: 'success', title: 'Trip cancelled' });
      p.onFinished();
    } catch (e) {
      console.error(e);
      setConfirmEnd(false);
      notify({ kind: 'alert', title: 'Could not cancel the trip', subtitle: errText(e) });
    } finally {
      setEnding(false);
    }
  }

  return (
    <>
      {trip.plan && <PlannedRouteSummary plan={trip.plan} />}
      {driver.planError && <InlineNotice message={driver.planError} onRetry={driver.retryPlan} />}
      {driver.acceptError && (
        <InlineNotice
          message={driver.acceptError.message}
          onRetry={retryPassenger && !driver.responding
            ? () => p.onAnswer(true, retryPassenger)
            : undefined}
        />
      )}
      <TripSheet
        startText={trip.startText}
        endText={trip.endText}
        mddKm={trip.mdd}
        request={driver.popup}
        passengers={driver.passengers}
        message={p.message}
        responding={driver.responding}
        estimate={driver.popupEstimate}
        canAccept={trip.status === 'scheduled'}
        onRetryCheck={driver.retryChecks}
        onAccept={() => p.onAnswer(true)}
        onDecline={() => p.onAnswer(false)}
        onNotNow={driver.closePopup}
        inProgress={inProgress}
        nextStop={<NextStop stops={driver.stops} busy={driver.marking} onMark={driver.mark} />}
        stopList={<StopChecklist stops={driver.stops} />}
        onEndEarly={() => setConfirmEnd(true)}
        lifecycleActions={
          <TripLifecycleActions
            key={trip.rideId}
            large
            rideId={trip.rideId}
            status={trip.status}
            departAt={trip.when}
            disabled={driver.responding || p.cancelling}
            onChanged={(status) => (status === 'in_progress' ? p.onStarted() : p.onFinished())}
          />
        }
        onCancel={inProgress ? undefined : p.onCancel}
        onScheduleAnother={p.onScheduleAnother}
      />
      <ConfirmDialog
        visible={confirmEnd}
        title='Cancel this trip?'
        message={driver.passengers.length
          ? 'Passengers waiting or in your car will be cancelled and told. Anyone already dropped off stays completed.'
          : 'This ride will move to History.'}
        busy={ending}
        onYes={endEarly}
        onNo={() => setConfirmEnd(false)}
      />
    </>
  );
}
