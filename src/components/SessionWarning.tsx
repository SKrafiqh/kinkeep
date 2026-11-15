'use client';

import { useEffect, useState } from 'react';
import { MINUTE_MS, SESSION_WARNING_MINUTES } from '@/lib/constants';
import { ClockIcon } from './icons';

/**
 * Warns five minutes before the 12-hour session ends. Nothing is navigated away or cleared,
 * so whatever is typed into a form stays there.
 */
export function SessionWarning({ expiresAt }: { expiresAt: number }) {
  const [endsAt, setEndsAt] = useState<string | null>(null);

  useEffect(() => {
    const show = (): void => setEndsAt(new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    const timer = setTimeout(show, Math.max(0, expiresAt - SESSION_WARNING_MINUTES * MINUTE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt]);

  return (
    <div role="status" className="no-print">
      {endsAt ? (
        <p className="card mb-4 flex items-start gap-3 border-2 border-accent">
          <ClockIcon aria-hidden weight="bold" size={26} className="mt-0.5 flex-none text-accent" />
          <span>
            For safety you will be signed out at {endsAt}. Save what you are doing, then sign in again with your passcode to carry on.
          </span>
        </p>
      ) : null}
    </div>
  );
}
