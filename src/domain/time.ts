/** All time-zone conversion lives here. Nothing in this file reads the system clock. */

import { DAY_MS, DAY_NAMES } from '@/lib/constants';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** True when `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock fields of an instant in a time zone. */
export function zonedParts(instant: number, timeZone: string): ZonedParts {
  const fields: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    fields[part.type] = part.value;
  }
  return {
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
    weekday: DAY_NAMES.findIndex((name) => name === fields.weekday),
  };
}

function offsetMs(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Instant for a wall-clock date and time in a zone. A time skipped by a clock change maps
 * to the hour before it; a repeated time maps to its first occurrence.
 */
export function zonedToInstant(date: string, time: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wall - offsetMs(wall, timeZone);
  return wall - offsetMs(firstGuess, timeZone);
}

/** Calendar date (YYYY-MM-DD) of an instant in a zone. */
export function localDate(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Wall-clock time (HH:mm) of an instant in a zone. */
export function localTime(instant: number, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Calendar date `days` after `date`. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Day of the week of a calendar date, 0 = Sunday. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "08:00" becomes "8:00 am". */
export function formatClock(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${pad(minute)} ${hour < 12 ? 'am' : 'pm'}`;
}

/** Time of an instant in a zone, as "8:00 am". */
export function formatTime(instant: number, timeZone: string): string {
  return formatClock(localTime(instant, timeZone));
}

/** A calendar date as "Mon 16 Nov". */
export function formatDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(date)]} ${day} ${MONTHS[month - 1]}`;
}

/** Day of an instant in a zone, as "Mon 16 Nov". */
export function formatDay(instant: number, timeZone: string): string {
  return formatDate(localDate(instant, timeZone));
}

/** "today 8:00 am", "yesterday 6:10 pm", "tomorrow 9:00 am" or "Mon 16 Nov 6:10 pm". */
export function formatWhen(instant: number, now: number, timeZone: string): string {
  const date = localDate(instant, timeZone);
  const today = localDate(now, timeZone);
  const names: Record<string, string> = {
    [today]: 'today',
    [addDays(today, -1)]: 'yesterday',
    [addDays(today, 1)]: 'tomorrow',
  };
  return `${names[date] ?? formatDate(date)} ${formatTime(instant, timeZone)}`;
}
