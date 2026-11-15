import { addDays, localDate, localTime } from './time';
import type { DoseEvent } from './types';

type Dose = Pick<DoseEvent, 'medId' | 'medName' | 'dueAt' | 'status'>;

export interface AdherenceStat {
  taken: number;
  total: number;
  /** Whole percent, or null when no dose has been settled yet. */
  percent: number | null;
}

const isSettled = (dose: Dose): boolean =>
  dose.status === 'taken' || dose.status === 'skipped' || dose.status === 'missed';

/** Doses due in [from, to). */
export function inWindow<T extends Pick<DoseEvent, 'dueAt'>>(doses: T[], from: number, to: number): T[] {
  return doses.filter((dose) => dose.dueAt >= from && dose.dueAt < to);
}

/** Taken doses out of settled doses. Doses still waiting are not counted against anyone. */
export function adherenceOf(doses: Dose[]): AdherenceStat {
  const settled = doses.filter(isSettled);
  const taken = settled.filter((dose) => dose.status === 'taken').length;
  const percent = settled.length === 0 ? null : Math.round((taken / settled.length) * 100);
  return { taken, total: settled.length, percent };
}

export interface MedicineAdherence {
  medId: string;
  medName: string;
  stat: AdherenceStat;
}

/** Adherence per medicine, sorted by name. */
export function adherenceByMedicine(doses: Dose[]): MedicineAdherence[] {
  const groups = new Map<string, Dose[]>();
  for (const dose of doses) groups.set(dose.medId, [...(groups.get(dose.medId) ?? []), dose]);
  return [...groups.entries()]
    .map(([medId, group]) => ({ medId, medName: group[group.length - 1].medName, stat: adherenceOf(group) }))
    .sort((a, b) => a.medName.localeCompare(b.medName));
}

export interface DayMark {
  date: string;
  taken: number;
  total: number;
  state: 'all' | 'some' | 'none' | 'empty';
}

/** One mark per local day, oldest first, ending today. */
export function dayStrip(doses: Dose[], now: number, timeZone: string, days = 7): DayMark[] {
  const today = localDate(now, timeZone);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - (days - 1));
    const { taken, total } = adherenceOf(doses.filter((dose) => localDate(dose.dueAt, timeZone) === date));
    const state = total === 0 ? 'empty' : taken === total ? 'all' : taken === 0 ? 'none' : 'some';
    return { date, taken, total, state };
  });
}

export interface MissedPattern {
  medName: string;
  /** Local time of day, HH:mm. */
  time: string;
  missed: number;
  total: number;
}

/** Medicine-and-time pairs with at least one missed dose, most missed first. */
export function missedPatterns(doses: Dose[], timeZone: string): MissedPattern[] {
  const patterns = new Map<string, MissedPattern>();
  for (const dose of doses.filter(isSettled)) {
    const time = localTime(dose.dueAt, timeZone);
    const key = `${dose.medId}|${time}`;
    const current = patterns.get(key) ?? { medName: dose.medName, time, missed: 0, total: 0 };
    patterns.set(key, {
      ...current,
      missed: current.missed + (dose.status === 'missed' ? 1 : 0),
      total: current.total + 1,
    });
  }
  return [...patterns.values()]
    .filter((pattern) => pattern.missed > 0)
    .sort((a, b) => b.missed - a.missed || a.medName.localeCompare(b.medName));
}
