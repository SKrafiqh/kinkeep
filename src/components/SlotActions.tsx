'use client';

import { useRouter } from 'next/navigation';
import { FormError } from './Field';
import { CheckIcon } from './icons';
import { useAction } from './useAction';

interface Props {
  /** Any dose in the slot; the whole slot is marked together. */
  doseId: string;
  slotTime: string;
  /** A missed slot can only be marked as taken late. */
  missed: boolean;
  /** Only the next slot to deal with gets the primary button. */
  primary: boolean;
}

/** The one large action per slot on Today: Taken, with Skip beside it. */
export function SlotActions({ doseId, slotTime, missed, primary }: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();

  async function mark(action: 'taken' | 'skipped'): Promise<void> {
    const done =
      action === 'taken'
        ? `Marked as taken. Your ${slotTime} medicines are done.`
        : `Skipped. Your ${slotTime} medicines are marked as skipped.`;
    if ((await run(`/api/doses/${doseId}/act`, 'POST', { action, slot: true }, done)) !== null) router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={`btn ${primary ? 'btn-primary' : 'btn-secondary'} min-w-40`}
          disabled={pending}
          aria-label={`${missed ? 'Taken late' : 'Taken'}: ${slotTime} medicines`}
          onClick={() => mark('taken')}
        >
          <CheckIcon aria-hidden weight="bold" size={24} />
          {pending ? 'Saving…' : missed ? 'Taken late' : 'Taken'}
        </button>
        {missed ? null : (
          <button
            type="button"
            className="btn btn-quiet"
            disabled={pending}
            aria-label={`Skip: ${slotTime} medicines`}
            onClick={() => mark('skipped')}
          >
            Skip
          </button>
        )}
      </div>
      <FormError error={error} />
    </div>
  );
}
