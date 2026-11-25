import InlineNotice from '@/components/InlineNotice';
import { PlannedRouteSummary } from '@/components/RoutePreview';
import TripLifecycleActions from '@/components/TripLifecycleActions';
import TripSheet from '@/components/TripSheet';
import { NextStop, StopChecklist } from '@/components/TripStops';
import type { useDriverFlow } from '@/hooks/useDriverFlow';
import type { Req, Trip } from '@/lib/rides';

type Props = {
  driver: ReturnType<typeof useDriverFlow>;
  trip: Trip;
  message: string;
  cancelling: boolean;
  // Accept or decline a request: the one in the popup unless another is given.
  onAnswer: (accept: boolean, request?: Req) => void;
  onStarted: () => void;
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
    </>
  );
}
