import { isOpen } from '@/domain/escalation';
import { planMaterialisation } from '@/domain/schedule';
import type { Circle, DoseEvent, Medication } from '@/domain/types';
import { HOUR_MS, MATERIALISE_HOURS } from '@/lib/constants';

/** A dose stays open for an hour after it is due; two hours back is sure to cover them all. */
const PAST_OPEN_HOURS = 2;
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

/**
 * Deletes a medicine's future unconfirmed doses. With `silencePast` (pause or delete), doses
 * already due stop being reminded about too. Confirmed doses are history and always stay.
 */
export async function clearFutureDoses(deps: Deps, circleId: string, medId: string, now: number, silencePast = false): Promise<void> {
  const nearby = await listDoses(deps.store, circleId, now - PAST_OPEN_HOURS * HOUR_MS, now + (MATERIALISE_HOURS + 1) * HOUR_MS);
  const open = nearby.filter((dose) => dose.medId === medId && isOpen(dose.status));
  await Promise.all(
    open.map((dose) => {
      const path = paths.dose(circleId, dose.id);
      // Re-read in a transaction: a dose confirmed a moment ago must not be deleted.
      return deps.store.transaction(async (tx) => {
        const fresh = await tx.get<DoseEvent>(path);
        if (!fresh || !isOpen(fresh.status)) return;
        if (fresh.dueAt > now) tx.delete(path);
        else if (silencePast) tx.update(path, { nextActionAt: null });
      });
    }),
  );
}
