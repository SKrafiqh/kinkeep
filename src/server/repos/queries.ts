import type { Activity, Appointment, Circle, DoseEvent, Medication, Member } from '@/domain/types';
import { circleIdOf, groups, paths } from './paths';
import type { DocStore } from './store';

export interface InCircle<T> {
  circleId: string;
  item: T;
}

const due = (field: string, now: number, limit: number) => ({
  where: [{ field, op: '<=' as const, value: now }],
  orderBy: { field, direction: 'asc' as const },
  limit,
});

async function dueInGroup<T>(store: DocStore, group: string, field: string, now: number, limit: number): Promise<InCircle<T>[]> {
  const found = await store.listGroup<T>(group, due(field, now, limit));
  return found.map(({ path, data }) => ({ circleId: circleIdOf(path), item: data }));
}

/** The circle with this join code, if any. */
export async function findCircleByCode(store: DocStore, code: string): Promise<Circle | null> {
  const [circle] = await store.list<Circle>(paths.circles, { where: [{ field: 'code', op: '==', value: code }], limit: 1 });
  return circle ?? null;
}

/** Members who still have access, in the order they joined the list. */
export async function listMembers(store: DocStore, circleId: string): Promise<Member[]> {
  const members = await store.list<Member>(paths.members(circleId));
  return members.filter((member) => member.removedAt === null).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMedications(store: DocStore, circleId: string): Promise<Medication[]> {
  const medications = await store.list<Medication>(paths.medications(circleId));
  return medications.sort((a, b) => a.name.localeCompare(b.name));
}

/** Dose events of one circle due in [from, to), earliest first. */
export function listDoses(store: DocStore, circleId: string, from: number, to: number): Promise<DoseEvent[]> {
  return store.list<DoseEvent>(paths.doses(circleId), {
    where: [
      { field: 'dueAt', op: '>=', value: from },
      { field: 'dueAt', op: '<', value: to },
    ],
    orderBy: { field: 'dueAt', direction: 'asc' },
  });
}

export async function listAppointments(store: DocStore, circleId: string): Promise<Appointment[]> {
  const appointments = await store.list<Appointment>(paths.appointments(circleId));
  return appointments.sort((a, b) => a.at - b.at);
}

/** Newest activity first. */
export function listActivity(store: DocStore, circleId: string, limit: number): Promise<Activity[]> {
  return store.list<Activity>(paths.activity(circleId), { orderBy: { field: 'at', direction: 'desc' }, limit });
}

/** Dose events, in any circle, that the reminder engine must look at now. */
export function dueDoses(store: DocStore, now: number, limit: number): Promise<InCircle<DoseEvent>[]> {
  return dueInGroup(store, groups.doses, 'nextActionAt', now, limit);
}

export function dueAppointments(store: DocStore, now: number, limit: number): Promise<InCircle<Appointment>[]> {
  return dueInGroup(store, groups.appointments, 'nextReminderAt', now, limit);
}

/** Medicines whose materialised horizon ends before `horizon`. */
export function medicationsToTopUp(store: DocStore, horizon: number, limit: number): Promise<InCircle<Medication>[]> {
  return dueInGroup(store, groups.medications, 'materialisedUntil', horizon, limit);
}

export function circlesDueSummary(store: DocStore, now: number, limit: number): Promise<Circle[]> {
  return store.list<Circle>(paths.circles, due('nextSummaryAt', now, limit));
}
