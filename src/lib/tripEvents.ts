// Lets a popup outside the Home screen say "the driver's trips changed".
const listeners = new Set<() => void>();

export function emitTripsChanged() {
  listeners.forEach((fn) => fn());
}

export function onTripsChanged(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
