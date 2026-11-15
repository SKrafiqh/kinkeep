import { isOpen } from '@/domain/escalation';
import { planMaterialisation } from '@/domain/schedule';
import type { Circle, Medication } from '@/domain/types';
import { HOUR_MS, MATERIALISE_HOURS } from '@/lib/constants';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { listDoses } from '../repos/queries';

/**
 * Creates the dose events a medicine still needs for the next 36 hours. Ids are
 * deterministic and existing events are left alone, so running it again changes nothing.
 */
export async function materialiseMedication(deps: Deps, circle: Circle, med: Medication, now: number): Promise<number> {
  const plan = planMaterialisation(circle.id, med, circle.timeZone, circle.settings, now);
  const created = await Promise.all(plan.events.map((event) => deps.store.create(paths.dose(circle.id, event.id), event)));
  if (plan.materialisedUntil !== med.materialisedUntil) {
    await deps.store.update(paths.medication(circle.id, med.id), { materialisedUntil: plan.materialisedUntil });
  }
  return created.filter(Boolean).length;
}

/** Deletes a medicine's future unconfirmed doses. Past and confirmed doses are history and stay. */
export async function clearFutureDoses(deps: Deps, circleId: string, medId: string, now: number): Promise<void> {
  const ahead = await listDoses(deps.store, circleId, now, now + (MATERIALISE_HOURS + 1) * HOUR_MS);
  const stale = ahead.filter((dose) => dose.medId === medId && dose.dueAt > now && isOpen(dose.status));
  await Promise.all(stale.map((dose) => deps.store.delete(paths.dose(circleId, dose.id))));
}
