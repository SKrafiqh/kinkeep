'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { FormError } from './Field';
import { useAction } from './useAction';

interface Props {
  /** API path to DELETE. */
  path: string;
  label: string;
  title: string;
  /** What will happen, in a sentence. */
  consequence: string;
  done: string;
  /** Where to go afterwards; stays on the page (refreshed) when omitted. */
  redirectTo?: string;
}

/** A delete that always asks first and says what will be lost. */
export function DeleteButton({ path, label, title, consequence, done, redirectTo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useAction();

  async function confirm(): Promise<void> {
    const result = await run(path, 'DELETE', undefined, done);
    setOpen(false);
    if (result === null) return;
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <button type="button" className="btn btn-danger justify-self-start" onClick={() => setOpen(true)}>
        {label}
      </button>
      <FormError error={error} />
      <ConfirmDialog open={open} title={title} confirmLabel={label} danger pending={pending} onConfirm={confirm} onCancel={() => setOpen(false)}>
        <p>{consequence}</p>
      </ConfirmDialog>
    </div>
  );
}
