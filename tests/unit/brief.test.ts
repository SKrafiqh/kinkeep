import { describe, expect, it } from 'vitest';
import { briefPeriodStart, fallbackBrief, type BriefFacts } from '@/domain/brief';
import { DAY_MS } from '@/lib/constants';

const NOW = Date.UTC(2026, 10, 16, 6, 0);

const FACTS: BriefFacts = {
  elderName: 'Mr Rao',
  doctor: 'Dr Meera Iyer',
  speciality: 'Cardiology',
  visitWhen: 'Thu 19 Nov 10:30 am',
  periodLabel: 'in the last 30 days',
  overall: { taken: 80, total: 100, percent: 80 },
  byMedicine: [],
  patterns: [
    { medName: 'Atorvastatin', time: '20:00', missed: 9, total: 30 },
    { medName: 'Metformin', time: '20:00', missed: 4, total: 30 },
    { medName: 'Amlodipine', time: '08:00', missed: 1, total: 30 },
    { medName: 'Aspirin', time: '08:00', missed: 1, total: 30 },
  ],
  changes: ['Priya changed Metformin from 500 mg to 1000 mg (yesterday 6:10 pm)'],
  notes: 'Ask about ankle swelling',
};

describe('briefPeriodStart', () => {
  it('uses the last 30 days when there is no earlier visit', () => {
    expect(briefPeriodStart([], NOW)).toEqual({ from: NOW - 30 * DAY_MS, sinceVisit: false });
    expect(briefPeriodStart([NOW + DAY_MS], NOW)).toEqual({ from: NOW - 30 * DAY_MS, sinceVisit: false });
  });

  it('starts at the most recent past visit', () => {
    expect(briefPeriodStart([NOW - 50 * DAY_MS, NOW - 20 * DAY_MS, NOW + DAY_MS], NOW)).toEqual({
      from: NOW - 20 * DAY_MS,
      sinceVisit: true,
    });
  });

  it('never looks back more than 90 days', () => {
    expect(briefPeriodStart([NOW - 200 * DAY_MS], NOW)).toEqual({ from: NOW - 90 * DAY_MS, sinceVisit: false });
  });
});

describe('fallbackBrief', () => {
  it('states the numbers in a sentence', () => {
    expect(fallbackBrief(FACTS).summary).toBe('Mr Rao took 80 of 100 doses in the last 30 days (80%).');
  });

  it('lists at most three patterns and five questions', () => {
    const brief = fallbackBrief(FACTS);
    expect(brief.patterns).toEqual([
      'Atorvastatin at 8:00 pm was missed 9 of 30 times.',
      'Metformin at 8:00 pm was missed 4 of 30 times.',
      'Amlodipine at 8:00 am was missed 1 of 30 times.',
    ]);
    expect(brief.questions).toHaveLength(5);
    expect(brief.questions[0]).toBe('Atorvastatin at 8:00 pm is often missed. Is there an easier time of day for it?');
    expect(brief.changes).toEqual(FACTS.changes);
  });

  it('only asks questions and never tells anyone to change a medicine', () => {
    const text = JSON.stringify(fallbackBrief(FACTS)).toLowerCase();
    for (const banned of ['you should', 'stop taking', 'increase', 'reduce', 'double']) {
      expect(text).not.toContain(banned);
    }
    expect(fallbackBrief(FACTS).questions.every((q) => q.endsWith('?'))).toBe(true);
  });

  it('reads sensibly with no data at all', () => {
    const empty = fallbackBrief({ ...FACTS, overall: { taken: 0, total: 0, percent: null }, patterns: [], changes: [], notes: '' });
    expect(empty).toEqual({
      summary: 'No doses were recorded for Mr Rao in the last 30 days.',
      patterns: ['No missed-dose pattern stands out.'],
      changes: ['No medicine changes were recorded.'],
      questions: [
        'Are all of these medicines still needed?',
        'What should I do if a dose is missed?',
        'Are any tests or checks due before the next visit?',
      ],
    });
  });
});
