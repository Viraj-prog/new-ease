import Banner from '@/components/Banner';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type Notification = {
  kind: 'success' | 'alert';
  title: string;
  subtitle?: string;
};

const NotifyContext = createContext<(n: Notification) => void>(() => {});

// Show a notification at the top of the screen from anywhere in the app.
export const useNotify = () => useContext(NotifyContext);

// Holds the one notification on screen. Errors use kind 'alert' (red exclamation mark).
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<Notification | null>(null);
  const notify = useCallback((n: Notification) => setNote(n), []);
  const close = useCallback(() => setNote(null), []);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Banner
        visible={!!note}
        kind={note?.kind ?? 'alert'}
        title={note?.title ?? ''}
        subtitle={note?.subtitle}
        onClose={close}
      />
    </NotifyContext.Provider>
  );
}
