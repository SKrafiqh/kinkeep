import { DoseSlotCard, type SlotDose } from '@/components/DoseSlotCard';
import { EmptyState } from '@/components/EmptyState';
import { SlotActions } from '@/components/SlotActions';
import { TestReminderForm } from '@/components/TestReminderForm';
import { doseView } from '@/domain/escalation';
import { can } from '@/domain/permissions';
import { formatDate, formatTime, zonedParts } from '@/domain/time';
import type { DoseEvent } from '@/domain/types';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { listDay } from '@/server/services/doses';

export const metadata = { title: 'Today' };

interface Slot {
  key: string;
  time: string;
  doses: SlotDose[];
  /** A dose to act through, when something in the slot can still be marked. */
  actionId: string | null;
  missed: boolean;
}

function toSlots(doses: DoseEvent[], now: number, timeZone: string): Slot[] {
  const groups = new Map<string, DoseEvent[]>();
  for (const dose of doses) groups.set(dose.slotKey, [...(groups.get(dose.slotKey) ?? []), dose]);
  return [...groups.entries()].map(([key, group]) => {
    const views = group.map((dose) => ({ id: dose.id, medName: dose.medName, strength: dose.strength, view: doseView(dose, now) }));
    const open = views.find((dose) => dose.view === 'upcoming' || dose.view === 'due' || dose.view === 'late');
    const missed = views.find((dose) => dose.view === 'missed');
    return { key, time: formatTime(group[0].dueAt, timeZone), doses: views, actionId: (open ?? missed)?.id ?? null, missed: !open && Boolean(missed) };
  });
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** The elder-first view: today's medicines in time order, one large action per slot. */
export default async function TodayPage() {
  const { circle, member } = await requireMember();
  const deps = getDeps();
  const now = deps.clock.now();
  const { date, doses } = await listDay(deps, circle);
  const slots = toSlots(doses, now, circle.timeZone);
  const canAct = can(member.role, 'dose:act');
  const nextKey = slots.find((slot) => slot.actionId !== null)?.key;
  const taken = doses.filter((dose) => dose.status === 'taken').length;
  const title = member.role === 'elder' ? `${greeting(zonedParts(now, circle.timeZone).hour)}, ${member.name}` : `${circle.elderName}’s medicines today`;

  return (
    <div className="today grid gap-6">
      <div>
        <h1>{title}</h1>
        <p>
          {formatDate(date)}
          {doses.length > 0 ? `. ${taken} of ${doses.length} taken so far.` : ''}
        </p>
      </div>
      {slots.length === 0 ? (
        <EmptyState title="No medicines are due today" action={can(member.role, 'medication:write') ? { href: '/medications/new', label: 'Add a medicine' } : undefined}>
          When a medicine is added, each dose shows here at its time, with one button to confirm it.
        </EmptyState>
      ) : null}
      {slots.map((slot) => (
        <DoseSlotCard
          key={slot.key}
          slotTime={slot.time}
          doses={slot.doses}
          actions={canAct && slot.actionId ? <SlotActions doseId={slot.actionId} slotTime={slot.time} missed={slot.missed} primary={slot.key === nextKey} /> : undefined}
        />
      ))}
      {canAct ? <TestReminderForm /> : null}
    </div>
  );
}
