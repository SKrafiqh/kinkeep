import { WEEKLY_SUMMARY_TIME } from '@/lib/constants';
import type { AdherenceStat, MissedPattern } from './adherence';
import { addDays, formatClock, localDate, weekdayOf, zonedToInstant } from './time';

/** The next Sunday evening, in the circle's time zone, strictly after `now`. */
export function nextWeeklySummaryAt(now: number, timeZone: string): number {
  const today = localDate(now, timeZone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(today, offset);
    const at = zonedToInstant(date, WEEKLY_SUMMARY_TIME, timeZone);
    if (weekdayOf(date) === 0 && at > now) return at;
  }
  throw new Error('No Sunday found within a week');
}

/** The week in two or three plain sentences. Every number comes from the records. */
export function weeklySummarySentences(elderName: string, week: AdherenceStat, patterns: MissedPattern[]): string[] {
  if (week.total === 0) return [`No doses were recorded for ${elderName} this week.`];
  const sentences = [`${elderName} took ${week.taken} of ${week.total} doses this week (${week.percent}%).`];
  const [worst] = patterns;
  if (week.taken === week.total) sentences.push('Every dose was taken.');
  if (worst) {
    const times = worst.missed === 1 ? 'once' : `${worst.missed} times`;
    sentences.push(`The dose missed most often was ${worst.medName} at ${formatClock(worst.time)}, missed ${times}.`);
  }
  return sentences;
}
