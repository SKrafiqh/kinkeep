import { DAY_NAMES } from '@/lib/constants';
import { formatClock, formatDate } from './time';
import type { Medication } from './types';

export type MedicationFields = Pick<
  Medication,
  'name' | 'strength' | 'form' | 'instructions' | 'times' | 'daysOfWeek' | 'startDate' | 'endDate' | 'active'
>;

/** "8:00 am and 8:00 pm". */
export function formatTimes(times: string[]): string {
  const clocks = [...times].sort().map(formatClock);
  return clocks.length <= 1 ? clocks.join('') : `${clocks.slice(0, -1).join(', ')} and ${clocks[clocks.length - 1]}`;
}

/** "every day" or "Mon, Wed, Fri". */
export function formatDays(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 7) return 'every day';
  return [...daysOfWeek].sort().map((day) => DAY_NAMES[day]).join(', ');
}

function changedParts(before: MedicationFields, after: MedicationFields): string[] {
  const parts: string[] = [];
  if (before.name !== after.name) parts.push(`name to ${after.name}`);
  if (before.strength !== after.strength) parts.push(`from ${before.strength} to ${after.strength}`);
  if (before.form !== after.form) parts.push(`form to ${after.form.toLowerCase()}`);
  if (formatTimes(before.times) !== formatTimes(after.times)) {
    parts.push(`times from ${formatTimes(before.times)} to ${formatTimes(after.times)}`);
  }
  if (formatDays(before.daysOfWeek) !== formatDays(after.daysOfWeek)) {
    parts.push(`days from ${formatDays(before.daysOfWeek)} to ${formatDays(after.daysOfWeek)}`);
  }
  if (before.instructions !== after.instructions) parts.push('the instructions');
  if (before.startDate !== after.startDate) parts.push(`start date to ${formatDate(after.startDate)}`);
  if (before.endDate !== after.endDate) {
    parts.push(after.endDate === null ? 'end date removed' : `end date to ${formatDate(after.endDate)}`);
  }
  return parts;
}

/** Plain-language line for the "what changed" feed, e.g. "Priya changed Metformin from 500 mg to 1000 mg". */
export function medicationChangeSummary(actor: string, before: MedicationFields, after: MedicationFields): string {
  const parts = changedParts(before, after);
  if (before.active !== after.active) {
    const verb = after.active ? 'resumed' : 'paused';
    return parts.length === 0 ? `${actor} ${verb} ${before.name}` : `${actor} ${verb} and changed ${before.name} ${parts.join(', ')}`;
  }
  return parts.length === 0 ? `${actor} saved ${before.name} with no changes` : `${actor} changed ${before.name} ${parts.join(', ')}`;
}
