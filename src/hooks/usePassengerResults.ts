import type { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { useCallback, useState } from 'react';

type Options = {
  driverMode: boolean;
  passenger: ReturnType<typeof usePassengerFlow>;
};

// Rider: whether the list of drivers is showing, and which one is picked. It only opens when the
// rider asks for it, with "Find driver" or from Scheduled Trips; a driver cancelling does not.
export function usePassengerResults({ driverMode, passenger }: Options) {
  // The driver tapped in the "Available drivers" list.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  // Opened from Scheduled Trips.
  const [reopened, setReopened] = useState(false);

  // The list of matching drivers replaces everything else.
  const showResults = !driverMode && listOpen && (passenger.results.length > 0 || reopened);

  const reset = useCallback(() => {
    setReopened(false);
    setListOpen(false);
    setChosenId(null);
  }, []);

  // "Find driver" was pressed.
  function startFinding() {
    setChosenId(null);
    setListOpen(true);
  }

  // Scheduled Trips sent a search back to be carried on.
  function openFromHistory() {
    setChosenId(null);
    setListOpen(true);
    setReopened(true);
  }

  // Stay in the driver list so the passenger can send more offers for the same request.
  function confirmChosen() {
    const r = passenger.results.find((x) => x.rideId === chosenId);
    if (r) void passenger.request(r);
  }

  return {
    chosenId, setChosenId, setListOpen, reopened, showResults,
    reset, startFinding, openFromHistory, confirmChosen,
  };
}
