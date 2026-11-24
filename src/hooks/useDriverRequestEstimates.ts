import {
  estimateDriverRequest, requestEstimateKey, type CandidateEstimate, type DriverRideState, type Req,
} from '@/lib/rides';
import { useEffect, useMemo, useRef, useState } from 'react';

const BATCH_SIZE = 10;

export function useDriverRequestEstimates(state: DriverRideState | null, enabled: boolean) {
  const basis = state ? JSON.stringify([state.trip.rideId, state.trip.status, state.accepted.map(({ id }) => id)]) : '';
  const [batch, setBatch] = useState({ basis: '', size: BATCH_SIZE });
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<Record<string, CandidateEstimate>>({});
  const completed = useRef(new Map<string, CandidateEstimate>());
  const completedBasis = useRef('');
  const size = batch.basis === basis ? batch.size : BATCH_SIZE;
  const candidates = useMemo(() => state?.requests.filter((r) => r.status !== 'accepted')
    .sort((a, b) => (a.pickupKm + a.dropoffKm) - (b.pickupKm + b.dropoffKm) || a.id.localeCompare(b.id)) ?? [], [state]);
  const batchItems = useMemo(() => state
    ? candidates.slice(0, size).map((request) => ({ request, key: requestEstimateKey(state, request) }))
    : [], [candidates, size, state]);
  const work = useRef({ state, batchItems });
  useEffect(() => {
    work.current = { state, batchItems };
  }, [batchItems, state]);
  const workKey = JSON.stringify(batchItems.map(({ key }) => key));
  const canCheck = enabled && !!state && !state.planError;

  useEffect(() => {
    if (!canCheck) return;
    const input = work.current;
    if (!input.state) return;
    const ride = input.state;
    if (completedBasis.current !== basis) {
      completedBasis.current = basis;
      completed.current.clear();
    }
    let cancelled = false;
    async function check() {
      for (const { request, key } of input.batchItems) {
        if (cancelled) return;
        if (completed.current.has(key)) continue;
        let result: CandidateEstimate;
        try {
          result = await estimateDriverRequest(ride, request);
        } catch {
          result = { kind: 'retry', message: 'Could not check the route. Try again.' };
        }
        if (cancelled) return;
        completed.current.set(key, result);
        setResults(Object.fromEntries(completed.current));
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [basis, canCheck, revision, workKey]);

  function getEstimate(request: Req) {
    return state && !state.planError ? results[requestEstimateKey(state, request)] : undefined;
  }

  function retryChecks() {
    for (const [key, result] of completed.current) {
      if (result.kind === 'retry') completed.current.delete(key);
    }
    setResults(Object.fromEntries(completed.current));
    setRevision((current) => current + 1);
  }

  return {
    getEstimate,
    visibleIds: new Set(batchItems.map(({ request }) => request.id)),
    hasMore: candidates.length > size,
    checking: canCheck && batchItems.some(({ key }) => !results[key]),
    checkMore: () => setBatch({ basis, size: size + BATCH_SIZE }),
    retryChecks,
  };
}
