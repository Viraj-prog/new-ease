// How long after its time a rider's search still counts, and a ride is still offered to riders.
export const SEARCH_GRACE_MS = 60 * 60 * 1000;

// How long after its time a ride that never started is asked about.
export const OVERDUE_MS = 3 * 60 * 60 * 1000;

// The earliest departure that has not expired, in the form the database stores.
export const searchCutoff = () => new Date(Date.now() - SEARCH_GRACE_MS).toISOString();

// The later of two stored times.
export const laterOf = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

// A trip with no time never expires.
export const isExpired = (departAt: string | null | undefined) =>
  !!departAt && Date.parse(departAt) < Date.now() - SEARCH_GRACE_MS;
