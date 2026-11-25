import type { usePassengerFlow } from '@/hooks/usePassengerFlow';
import { useReopenedPassengerSearch, type ReopenedSearch } from '@/hooks/useReopenedPassengerSearch';
import { useCallback, useState } from 'react';

type Options = {
  userId: string | undefined;
  driverMode: boolean;
  view: 'home' | 'plan';
  passenger: ReturnType<typeof usePassengerFlow>;
  // A search the driver cancelled on has been reopened on Home.
  onReopened: () => void;
};

// Rider: what is showing of a search (the best match, or the list of drivers), and how the search
// was started. A search is reopened by itself when a driver cancels, or from the History tab.
export function usePassengerResults({ userId, driverMode, view, passenger, onReopened }: Options) {
  // The driver tapped in the "Available drivers" list.
  const [chosenId, setChosenId] = useState<string | null>(null);
  // "See others" has opened the full list; otherwise only the best match is shown.
  const [listOpen, setListOpen] = useState(false);
  // Opened from History.
  const [reopened, setReopened] = useState(false);
  const [manualRecoveryId, setManualRecoveryId] = useState<string | null>(null);
  // Opened by itself after a driver cancelled.
  const [automatic, setAutomatic] = useState<ReopenedSearch | null>(null);

  const remember = useReopenedPassengerSearch(
    userId,
    !driverMode && view === 'home' && !automatic && !reopened && !passenger.loading,
    (search) => {
      setAutomatic(search);
      setChosenId(null);
      setListOpen(false);
      onReopened();
      void passenger.resume(search.requestId);
    },
  );

  const hasResults = !driverMode && passenger.results.length > 0;
  // The list of matching drivers replaces everything else.
  const showResults = !driverMode && (
    (listOpen && (hasResults || reopened)) || (!!automatic && !hasResults)
  );
  // Cancellation recovery starts with the best match. A normal search opens the full list.
  const showMatch = !!automatic && hasResults && !listOpen;
  const best = passenger.results[0];

  const reset = useCallback(() => {
    setAutomatic(null);
    setManualRecoveryId(null);
    setReopened(false);
    setListOpen(false);
    setChosenId(null);
  }, []);

  // "Find driver" was pressed: this search takes over from any reopened one.
  function startFinding() {
    const recoveryId = automatic?.id ?? manualRecoveryId;
    if (recoveryId) remember(recoveryId, 'handled');
    setAutomatic(null);
    setManualRecoveryId(null);
    setChosenId(null);
    setListOpen(true);
  }

  // History sent a cancelled search back to be carried on.
  function openFromHistory(offerId: string | undefined) {
    setAutomatic(null);
    setManualRecoveryId(offerId ?? null);
    setChosenId(null);
    setListOpen(true);
    setReopened(true);
  }

  // The rider has finished with the search that reopened by itself.
  const finishAutomatic = useCallback(() => {
    if (automatic) remember(automatic.id, 'handled');
  }, [automatic, remember]);

  function dismissNotice() {
    if (!automatic) return;
    remember(automatic.id, 'dismissed');
    setAutomatic({ ...automatic, showNotice: false });
  }

  async function sendOffer(ride: (typeof passenger.results)[number]) {
    const sent = await passenger.request(ride);
    const recoveryId = automatic?.id ?? manualRecoveryId;
    if (sent && recoveryId) remember(recoveryId, 'handled');
    if (sent && automatic) {
      setAutomatic((current) => current?.id === automatic.id
        ? { ...current, showNotice: false } : current);
    }
    return sent;
  }

  // Confirm on the best match card.
  async function confirmBest() {
    if (!best || !(await sendOffer(best))) return;
    if (passenger.results.length > 1) {
      setChosenId(null);
      setListOpen(true);
    }
  }

  // Stay in the driver list so the passenger can send more offers for the same request.
  function confirmChosen() {
    const r = passenger.results.find((x) => x.rideId === chosenId);
    if (r) void sendOffer(r);
  }

  return {
    chosenId, setChosenId, setListOpen, reopened, automatic,
    hasResults, showResults, showMatch, best,
    reset, startFinding, openFromHistory, finishAutomatic, dismissNotice, confirmBest, confirmChosen,
  };
}
