import type { DoseView } from '@/domain/escalation';
import type { ReactNode } from 'react';
import { StatusBadge } from './StatusBadge';

export interface SlotDose {
  id: string;
  medName: string;
  strength: string;
  instructions?: string;
  view: DoseView;
}

interface Props {
  slotTime: string;
  doses: SlotDose[];
  /** The Taken and Skip buttons, when this member may act on the slot. */
  actions?: ReactNode;
}

/** One time of day, laid out like a line in a notebook: the time in the margin, the medicines beside it. */
export function DoseSlotCard({ slotTime, doses, actions }: Props) {
  return (
    <article className="card grid gap-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
      <h2 className="sm:pt-1">{slotTime}</h2>
      <div className="margin-rule grid gap-4 pl-4 sm:pl-6">
        <ul className="grid gap-3">
          {doses.map((dose) => (
            <li key={dose.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span>
                <strong>{dose.medName}</strong> {dose.strength}
                {dose.instructions ? <span className="block text-muted">{dose.instructions}</span> : null}
              </span>
              <StatusBadge view={dose.view} />
            </li>
          ))}
        </ul>
        {actions}
      </div>
    </article>
  );
}
