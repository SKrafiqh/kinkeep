import { BRIEF_DEFAULT_DAYS, BRIEF_MAX_DAYS, DAY_MS } from '@/lib/constants';
import type { AdherenceStat, MedicineAdherence, MissedPattern } from './adherence';
import { formatClock } from './time';
import type { BriefContent } from './types';

/** Everything a visit brief is built from. Numbers come from code, never from the model. */
export interface BriefFacts {
  elderName: string;
  doctor: string;
  speciality: string;
  visitWhen: string;
  /** "since your last visit on Mon 12 Oct" or "in the last 30 days". */
  periodLabel: string;
  overall: AdherenceStat;
  byMedicine: MedicineAdherence[];
  patterns: MissedPattern[];
  changes: string[];
  notes: string;
}

/** Start of the period a brief covers: the last past visit, capped at 90 days, else 30 days. */
export function briefPeriodStart(pastVisits: number[], now: number): { from: number; sinceVisit: boolean } {
  const lastVisit = Math.max(...pastVisits.filter((at) => at < now), -Infinity);
  if (lastVisit === -Infinity) return { from: now - BRIEF_DEFAULT_DAYS * DAY_MS, sinceVisit: false };
  return {
    from: Math.max(lastVisit, now - BRIEF_MAX_DAYS * DAY_MS),
    sinceVisit: lastVisit >= now - BRIEF_MAX_DAYS * DAY_MS,
  };
}

function summaryLine(facts: BriefFacts): string {
  const { overall, elderName, periodLabel } = facts;
  if (overall.total === 0) return `No doses were recorded for ${elderName} ${periodLabel}.`;
  return `${elderName} took ${overall.taken} of ${overall.total} doses ${periodLabel} (${overall.percent}%).`;
}

/** The fallback brief lists this many missed-dose patterns, asks about the worst two, and stops at five questions. */
const MAX_PATTERNS = 3;
const PATTERN_QUESTIONS = 2;
const MAX_QUESTIONS = 5;

const patternLine = (pattern: MissedPattern): string =>
  `${pattern.medName} at ${formatClock(pattern.time)} was missed ${pattern.missed} of ${pattern.total} times.`;

/** The visit brief without AI: the same facts in plain sentences. Asks questions, gives no advice. */
export function fallbackBrief(facts: BriefFacts): BriefContent {
  const top = facts.patterns.slice(0, MAX_PATTERNS);
  const questions = [
    ...top
      .slice(0, PATTERN_QUESTIONS)
      .map((p) => `${p.medName} at ${formatClock(p.time)} is often missed. Is there an easier time of day for it?`),
    'Are all of these medicines still needed?',
    'What should I do if a dose is missed?',
    'Are any tests or checks due before the next visit?',
    ...(facts.notes.trim() === '' ? [] : ['Can we go through the notes I wrote for this visit?']),
  ];
  return {
    summary: summaryLine(facts),
    patterns: top.length === 0 ? ['No missed-dose pattern stands out.'] : top.map(patternLine),
    changes: facts.changes.length === 0 ? ['No medicine changes were recorded.'] : facts.changes,
    questions: questions.slice(0, MAX_QUESTIONS),
  };
}
