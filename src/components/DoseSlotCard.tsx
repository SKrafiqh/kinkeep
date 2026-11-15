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

/** One time of day on a glass pane: the time set large, the medicines on a thread beside it. */
export function DoseSlotCard({ slotTime, doses, actions }: Props) {
  return (
    <article className="card rise grid gap-5 sm:grid-cols-[10rem_1fr] sm:gap-8">
      <h2 className="display text-[1.9rem] sm:pt-1 sm:text-[2.1rem]">{slotTime}</h2>
      <div className="margin-rule grid gap-5 pl-5 sm:pl-7">
        <ul className="grid gap-4">
          {doses.map((dose) => (
            <li key={dose.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span>
                <strong className="text-[1.15em]">{dose.medName}</strong> {dose.strength}
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
