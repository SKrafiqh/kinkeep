import { describe, expect, it } from 'vitest';
import { nextWeeklySummaryAt, weeklySummarySentences } from '@/domain/summary';
import { zonedToInstant } from '@/domain/time';

const KOLKATA = 'Asia/Kolkata';

describe('nextWeeklySummaryAt', () => {
  it('picks this Sunday evening when it is still ahead', () => {
    const sundayMorning = zonedToInstant('2026-11-15', '09:00', KOLKATA);
    expect(nextWeeklySummaryAt(sundayMorning, KOLKATA)).toBe(zonedToInstant('2026-11-15', '18:00', KOLKATA));
  });

  it('moves to next Sunday once this one has passed', () => {
    const sundayEvening = zonedToInstant('2026-11-15', '18:00', KOLKATA);
    expect(nextWeeklySummaryAt(sundayEvening, KOLKATA)).toBe(zonedToInstant('2026-11-22', '18:00', KOLKATA));
  });

  it('finds Sunday from the middle of the week', () => {
    const wednesday = zonedToInstant('2026-11-18', '12:00', KOLKATA);
    expect(nextWeeklySummaryAt(wednesday, KOLKATA)).toBe(zonedToInstant('2026-11-22', '18:00', KOLKATA));
  });
});

describe('weeklySummarySentences', () => {
  it('says so when nothing was recorded', () => {
    expect(weeklySummarySentences('Mr Rao', { taken: 0, total: 0, percent: null }, [])).toEqual([
      'No doses were recorded for Mr Rao this week.',
    ]);
  });

  it('celebrates a full week', () => {
    expect(weeklySummarySentences('Mr Rao', { taken: 21, total: 21, percent: 100 }, [])).toEqual([
      'Mr Rao took 21 of 21 doses this week (100%).',
      'Every dose was taken.',
    ]);
  });

  it('names the dose missed most often', () => {
    const patterns = [{ medName: 'Atorvastatin', time: '20:00', missed: 2, total: 7 }];
    expect(weeklySummarySentences('Mr Rao', { taken: 19, total: 21, percent: 90 }, patterns)).toEqual([
      'Mr Rao took 19 of 21 doses this week (90%).',
      'The dose missed most often was Atorvastatin at 8:00 pm, missed 2 times.',
    ]);
    expect(
      weeklySummarySentences('Mr Rao', { taken: 20, total: 21, percent: 95 }, [{ ...patterns[0], missed: 1 }])[1],
    ).toBe('The dose missed most often was Atorvastatin at 8:00 pm, missed once.');
  });
});
