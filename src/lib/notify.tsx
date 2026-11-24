import Banner from '@/components/Banner';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type Notification = {
  kind: 'success' | 'alert';
  title: string;
  subtitle?: string;
  // Stays on screen until tapped, instead of hiding itself.
  sticky?: boolean;
  // Called when the user taps it away.
  onDismiss?: () => void;
};

const NotifyContext = createContext<(n: Notification) => void>(() => {});

// Show a notification at the top of the screen from anywhere in the app.
export const useNotify = () => useContext(NotifyContext);

// Holds the one notification on screen. Errors use kind 'alert' (red exclamation mark).
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<Notification | null>(null);
  // The notification on screen, for `close` to read without changing identity.
  const current = useRef<Notification | null>(null);
  // A sticky notice pushed aside by a short one, to bring back afterwards.
  const held = useRef<Notification | null>(null);
  const notify = useCallback((n: Notification) => {
    if (current.current?.sticky && !n.sticky) held.current = current.current;
    current.current = n;
    setNote(n);
  }, []);
  const close = useCallback(() => {
    current.current?.onDismiss?.();
    const next = held.current;
    held.current = null;
    current.current = next;
    setNote(next);
  }, []);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Banner
        visible={!!note}
        kind={note?.kind ?? 'alert'}
        title={note?.title ?? ''}
        subtitle={note?.subtitle}
        sticky={note?.sticky}
        onClose={close}
      />
    </NotifyContext.Provider>
  );
}
