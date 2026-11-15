import { applyDoseAction } from '@/domain/escalation';
import { addDays, localDate, zonedToInstant } from '@/domain/time';
import type { Circle, DoseAction, DoseEvent } from '@/domain/types';
import { AppError, notFound } from '@/lib/errors';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { listDoses } from '../repos/queries';

/** One local day of doses for a circle; today when no date is given. */
export async function listDay(
  deps: Deps,
  circle: Circle,
  date?: string,
): Promise<{ date: string; doses: DoseEvent[] }> {
  const day = date ?? localDate(deps.clock.now(), circle.timeZone);
  const from = zonedToInstant(day, '00:00', circle.timeZone);
  const to = zonedToInstant(addDays(day, 1), '00:00', circle.timeZone);
  return { date: day, doses: await listDoses(deps.store, circle.id, from, to) };
}

/** Every dose in one slot of one circle. */
export function slotDoses(deps: Deps, circleId: string, slotKey: string): Promise<DoseEvent[]> {
  return deps.store.list<DoseEvent>(paths.doses(circleId), { where: [{ field: 'slotKey', op: '==', value: slotKey }] });
}

/** Who acts on a dose, and how. */
export interface DoseActor {
  action: DoseAction;
  memberId: string;
}

// In a transaction, so a tap and a reminder tick can never both win the same dose.
function settle(
  deps: Deps,
  circleId: string,
  doseIds: string[],
  { action, memberId }: DoseActor,
): Promise<DoseEvent[]> {
  const now = deps.clock.now();
  return deps.store.transaction(async (tx) => {
    const events = await Promise.all(doseIds.map((id) => tx.get<DoseEvent>(paths.dose(circleId, id))));
    const settled: DoseEvent[] = [];
    for (const event of events) {
      const result = event ? applyDoseAction(event.status, action) : null;
      if (!event || !result) continue;
      const next: DoseEvent = { ...event, ...result, actedBy: memberId, actedAt: now, nextActionAt: null };
      tx.set(paths.dose(circleId, event.id), next);
      settled.push(next);
    }
    return settled;
  });
}

/** Marks every dose in a slot that can still take this action. Returns the doses it changed. */
export async function actOnSlot(deps: Deps, circleId: string, slotKey: string, actor: DoseActor): Promise<DoseEvent[]> {
  const doses = await slotDoses(deps, circleId, slotKey);
  return settle(
    deps,
    circleId,
    doses.map((dose) => dose.id),
    actor,
  );
}

/** Marks one dose, or its whole slot, as taken or skipped. */
export async function actOnDose(
  deps: Deps,
  who: { circle: Circle; member: { id: string } },
  doseId: string,
  input: { action: DoseAction; slot: boolean },
): Promise<DoseEvent[]> {
  const dose = await deps.store.get<DoseEvent>(paths.dose(who.circle.id, doseId));
  if (!dose) throw notFound('dose');
  const actor = { action: input.action, memberId: who.member.id };
  const settled = input.slot
    ? await actOnSlot(deps, who.circle.id, dose.slotKey, actor)
    : await settle(deps, who.circle.id, [doseId], actor);
  if (settled.length === 0) throw new AppError('CONFLICT', 'That dose was already marked. Nothing was changed.');
  return settled;
}
