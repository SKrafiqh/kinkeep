'use client';

import { useEffect, useRef, useState } from 'react';
import { FormError } from './Field';
import { CheckCircleIcon, CheckIcon } from './icons';
import { useAction } from './useAction';

type Action = 'taken' | 'skipped';

/**
 * The confirm step for a one-tap email link. Opening the page changes nothing (mail scanners
 * open links too); the dose is only marked when a person presses a button here.
 */
export function ActForm({ token, preferred }: { token: string; preferred: Action }) {
  const [done, setDone] = useState<Action | null>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const { run, pending, error } = useAction();
  useEffect(() => result.current?.focus(), [done]);

  async function mark(action: Action): Promise<void> {
    const message = action === 'taken' ? 'Marked as taken.' : 'Marked as skipped.';
    if ((await run('/api/act', 'POST', { token, action }, message)) !== null) setDone(action);
  }

  if (done) {
    return (
      <p ref={result} tabIndex={-1} className="flex items-start gap-3 font-bold text-taken">
        <CheckCircleIcon aria-hidden weight="bold" size={30} className="flex-none" />
        {done === 'taken' ? 'Done. These are marked as taken.' : 'Done. These are marked as skipped.'} You can close this page.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`btn ${preferred === 'taken' ? 'btn-primary' : 'btn-secondary'} min-w-48`} disabled={pending} onClick={() => mark('taken')}>
          <CheckIcon aria-hidden weight="bold" size={24} />
          I took them
        </button>
        <button type="button" className={`btn ${preferred === 'skipped' ? 'btn-primary' : 'btn-secondary'}`} disabled={pending} onClick={() => mark('skipped')}>
          Skip this dose
        </button>
      </div>
      {pending ? <p>Saving…</p> : null}
      <FormError error={error} />
    </div>
  );
}
