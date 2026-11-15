import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PlusIcon } from '@/components/icons';
import { formatDays, formatTimes } from '@/domain/activity';
import { can } from '@/domain/permissions';
import { expandDoses } from '@/domain/schedule';
import { formatWhen } from '@/domain/time';
import type { Medication } from '@/domain/types';
import { DAY_MS } from '@/lib/constants';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { listMedications } from '@/server/repos/queries';

export const metadata = { title: 'Medicines' };

function nextDoseLine(med: Medication, now: number, timeZone: string): string {
  if (!med.active) return 'Paused. No reminders are going out.';
  const [next] = expandDoses(med, timeZone, now, now + 8 * DAY_MS);
  return next ? `Next dose: ${formatWhen(next.dueAt, now, timeZone)}` : 'No more doses are scheduled.';
}

export default async function MedicationsPage() {
  const { circle, member } = await requireMember();
  const deps = getDeps();
  const now = deps.clock.now();
  const medicines = await listMedications(deps.store, circle.id);
  const canWrite = can(member.role, 'medication:write');

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Medicines</h1>
        {canWrite ? (
          <Link href="/medications/new" className="btn btn-primary">
            <PlusIcon aria-hidden weight="bold" size={22} />
            Add medicine
          </Link>
        ) : null}
      </div>
      {medicines.length === 0 ? (
        <EmptyState title="No medicines yet">
          {canWrite
            ? 'Add the first medicine with its times of day. Reminders start from the next dose.'
            : `Medicines that ${circle.elderName} or a caregiver adds will be listed here with their times.`}
        </EmptyState>
      ) : (
        <ul className="grid gap-4">
          {medicines.map((med) => (
            <li key={med.id} className="card grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2>
                  {med.name} <span className="font-normal">{med.strength}</span>
                </h2>
                <p>
                  {med.form}, {formatTimes(med.times)}, {formatDays(med.daysOfWeek)}
                  {med.instructions ? `. ${med.instructions}` : ''}
                </p>
                <p className={med.active ? 'font-bold text-due' : 'font-bold text-muted'}>{nextDoseLine(med, now, circle.timeZone)}</p>
              </div>
              {canWrite ? (
                <Link href={`/medications/${med.id}`} className="btn btn-secondary justify-self-start">
                  Edit<span className="sr-only"> {med.name}</span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
