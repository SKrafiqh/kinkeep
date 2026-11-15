import { HOUR_MS, MATERIALISE_HOURS, MINUTE_MS } from '@/lib/constants';
import { addDays, localDate, weekdayOf, zonedToInstant } from './time';
import type { Circle, DoseEvent, Medication, ReminderSettings } from './types';

export interface PlannedDose {
  date: string;
  time: string;
  dueAt: number;
}

type Schedule = Pick<Medication, 'times' | 'daysOfWeek' | 'startDate' | 'endDate' | 'active'>;

/** Dose instants of one medicine that fall in (after, until], in the circle's time zone. */
export function expandDoses(med: Schedule, timeZone: string, after: number, until: number): PlannedDose[] {
  if (!med.active) return [];
  const doses: PlannedDose[] = [];
  const lastDate = localDate(until, timeZone);
  for (let date = localDate(after, timeZone); date <= lastDate; date = addDays(date, 1)) {
    if (date < med.startDate || (med.endDate !== null && date > med.endDate)) continue;
    if (!med.daysOfWeek.includes(weekdayOf(date))) continue;
    for (const time of med.times) {
      const dueAt = zonedToInstant(date, time, timeZone);
      if (dueAt > after && dueAt <= until) doses.push({ date, time, dueAt });
    }
  }
  return doses.sort((a, b) => a.dueAt - b.dueAt);
}

/** Deterministic id, so materialising twice creates nothing new. */
export function doseEventId(medId: string, dose: Pick<PlannedDose, 'date' | 'time'>): string {
  return `${medId}_${dose.date.replaceAll('-', '')}_${dose.time.replace(':', '')}`;
}

/** Every dose of one circle due at the same minute shares a slot. */
export function slotKey(circleId: string, dueAt: number): string {
  return `${circleId}_${dueAt}`;
}

/** A fresh, unconfirmed dose event whose first reminder is `leadMin` before it is due. */
export function buildDoseEvent(
  circleId: string,
  med: Pick<Medication, 'id' | 'name' | 'strength'>,
  dose: PlannedDose,
  settings: ReminderSettings,
): DoseEvent {
  return {
    id: doseEventId(med.id, dose),
    medId: med.id,
    medName: med.name,
    strength: med.strength,
    dueAt: dose.dueAt,
    slotKey: slotKey(circleId, dose.dueAt),
    status: 'scheduled',
    nextActionAt: dose.dueAt - settings.leadMin * MINUTE_MS,
    actedBy: null,
    actedAt: null,
    late: false,
    attempts: 0,
    lastError: null,
  };
}

export interface MaterialisationPlan {
  events: DoseEvent[];
  /** New horizon for the medicine; null when it is paused or its end date is covered. */
  materialisedUntil: number | null;
}

/** Future dose events a medicine still needs, up to 36 hours ahead. Never plans the past. */
export function planMaterialisation(
  circle: Pick<Circle, 'id' | 'timeZone' | 'settings'>,
  med: Medication,
  now: number,
): MaterialisationPlan {
  if (!med.active) return { events: [], materialisedUntil: null };
  const { timeZone } = circle;
  const until = now + MATERIALISE_HOURS * HOUR_MS;
  const after = Math.max(med.materialisedUntil ?? now, now);
  const events = expandDoses(med, timeZone, after, until).map((dose) =>
    buildDoseEvent(circle.id, med, dose, circle.settings),
  );
  const finished = med.endDate !== null && localDate(until, timeZone) > med.endDate;
  return { events, materialisedUntil: finished ? null : until };
}
