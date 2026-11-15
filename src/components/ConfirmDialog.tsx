'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * One question, two answers. Built on the native <dialog>, which traps focus, closes on
 * Escape and hands focus back to the button that opened it.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, pending, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId} onClose={onCancel}>
      <h2 id={titleId}>{title}</h2>
      <div className="mt-3">{children}</div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={pending} onClick={onConfirm}>
          {pending ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Keep it
        </button>
      </div>
    </dialog>
  );
}
