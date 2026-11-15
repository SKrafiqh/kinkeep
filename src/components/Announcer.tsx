'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const TOAST_MS = 6000;
const AnnounceContext = createContext<(message: string) => void>(() => undefined);

/** Tell screen-reader users and sighted users alike that something just happened. */
export function useAnnounce(): (message: string) => void {
  return useContext(AnnounceContext);
}

/** One polite live region for the whole app. Screens also show results inline; this is never the only sign. */
export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((next: string) => setMessage(next), []);

  useEffect(() => {
    if (message === '') return;
    const timer = setTimeout(() => setMessage(''), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" className="toast no-print">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}
