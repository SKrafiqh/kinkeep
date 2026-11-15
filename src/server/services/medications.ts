import { formatDays, formatTimes, medicationChangeSummary } from '@/domain/activity';
import type { Medication } from '@/domain/types';
import { MAX_MEDICINES } from '@/lib/constants';
import { AppError, notFound } from '@/lib/errors';
import type { MedicationInput } from '@/lib/schemas';
import type { Deps } from '../deps';
import { clearFutureDoses, materialiseMedication } from '../reminders/materialise';
import { paths } from '../repos/paths';
import { listMedications } from '../repos/queries';
import { newId } from '../repos/store';
import { recordActivity } from './activity';
import type { MemberContext } from './sessions';

export async function getMedication(deps: Deps, circleId: string, medId: string): Promise<Medication> {
  const med = await deps.store.get<Medication>(paths.medication(circleId, medId));
  if (!med) throw notFound('medicine');
  return med;
}

/** Adds a medicine and creates its doses for the next 36 hours. */
export async function createMedication(deps: Deps, who: MemberContext, input: MedicationInput): Promise<Medication> {
  const now = deps.clock.now();
  if ((await listMedications(deps.store, who.circle.id)).length >= MAX_MEDICINES) {
    throw new AppError('CONFLICT', `A circle can hold ${MAX_MEDICINES} medicines. Delete one that is no longer needed first.`);
  }
  const med: Medication = {
    id: newId(),
    ...input,
    materialisedUntil: null,
    createdBy: who.member.id,
    updatedBy: who.member.id,
    updatedAt: now,
  };
  await deps.store.set(paths.medication(who.circle.id, med.id), med);
  await materialiseMedication(deps, who.circle, med, now);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'medication.create',
    targetType: 'medication',
    targetId: med.id,
    summary: `${who.member.name} added ${med.name} ${med.strength}, ${formatTimes(med.times)}, ${formatDays(med.daysOfWeek)}`,
  });
  return med;
}

/** Saves an edit. Future unconfirmed doses are rebuilt; past doses are never rewritten. */
export async function updateMedication(deps: Deps, who: MemberContext, medId: string, input: MedicationInput): Promise<Medication> {
  const now = deps.clock.now();
  const before = await getMedication(deps, who.circle.id, medId);
  const after: Medication = { ...before, ...input, materialisedUntil: null, updatedBy: who.member.id, updatedAt: now };
  await deps.store.set(paths.medication(who.circle.id, medId), after);
  await clearFutureDoses(deps, who.circle.id, medId, now, !after.active);
  await materialiseMedication(deps, who.circle, after, now);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'medication.update',
    targetType: 'medication',
    targetId: medId,
    summary: medicationChangeSummary(who.member.name, before, after),
  });
  return after;
}

/** Deletes a medicine and its future unconfirmed doses. Its history stays for adherence. */
export async function deleteMedication(deps: Deps, who: MemberContext, medId: string): Promise<void> {
  const med = await getMedication(deps, who.circle.id, medId);
  await deps.store.delete(paths.medication(who.circle.id, medId));
  await clearFutureDoses(deps, who.circle.id, medId, deps.clock.now(), true);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'medication.delete',
    targetType: 'medication',
    targetId: medId,
    summary: `${who.member.name} removed ${med.name} ${med.strength}`,
  });
}
