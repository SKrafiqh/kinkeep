import { describe, expect, it } from 'vitest';
import { adherenceByMedicine, adherenceOf, dayStrip, inWindow, missedPatterns } from '@/domain/adherence';
import { zonedToInstant } from '@/domain/time';
import type { DoseStatus } from '@/domain/types';

const KOLKATA = 'Asia/Kolkata';

function dose(medName: string, date: string, time: string, status: DoseStatus) {
  return { medId: medName.toLowerCase(), medName, dueAt: zonedToInstant(date, time, KOLKATA), status };
}

const DOSES = [
  dose('Metformin', '2026-11-14', '08:00', 'taken'),
  dose('Metformin', '2026-11-14', '20:00', 'missed'),
  dose('Metformin', '2026-11-15', '08:00', 'taken'),
  dose('Metformin', '2026-11-15', '20:00', 'missed'),
  dose('Amlodipine', '2026-11-15', '08:00', 'skipped'),
  dose('Amlodipine', '2026-11-16', '08:00', 'taken'),
  dose('Amlodipine', '2026-11-16', '20:00', 'scheduled'),
];

describe('adherenceOf', () => {
  it('counts taken out of settled doses and ignores doses still waiting', () => {
    expect(adherenceOf(DOSES)).toEqual({ taken: 3, total: 6, percent: 50 });
  });

  it('reports no percentage when nothing is settled', () => {
    expect(adherenceOf([dose('Metformin', '2026-11-16', '20:00', 'reminded')])).toEqual({ taken: 0, total: 0, percent: null });
    expect(adherenceOf([])).toEqual({ taken: 0, total: 0, percent: null });
  });

  it('rounds to a whole percent', () => {
    const three = [dose('A', '2026-11-14', '08:00', 'taken'), dose('A', '2026-11-15', '08:00', 'taken'), dose('A', '2026-11-16', '08:00', 'missed')];
    expect(adherenceOf(three).percent).toBe(67);
  });
});

describe('inWindow', () => {
  it('includes the start and excludes the end', () => {
    const from = zonedToInstant('2026-11-15', '08:00', KOLKATA);
    const to = zonedToInstant('2026-11-16', '08:00', KOLKATA);
    expect(inWindow(DOSES, from, to)).toHaveLength(3);
  });
});

describe('adherenceByMedicine', () => {
  it('groups by medicine and sorts by name', () => {
    expect(adherenceByMedicine(DOSES)).toEqual([
      { medId: 'amlodipine', medName: 'Amlodipine', stat: { taken: 1, total: 2, percent: 50 } },
      { medId: 'metformin', medName: 'Metformin', stat: { taken: 2, total: 4, percent: 50 } },
    ]);
  });
});

describe('dayStrip', () => {
  it('marks each local day, oldest first, ending today', () => {
    const now = zonedToInstant('2026-11-16', '12:00', KOLKATA);
    const strip = dayStrip(DOSES, now, KOLKATA, 4);
    expect(strip.map((d) => `${d.date} ${d.state} ${d.taken}/${d.total}`)).toEqual([
      '2026-11-13 empty 0/0',
      '2026-11-14 some 1/2',
      '2026-11-15 some 1/3',
      '2026-11-16 all 1/1',
    ]);
  });

  it('marks a day with nothing taken as none', () => {
    const now = zonedToInstant('2026-11-14', '23:00', KOLKATA);
    expect(dayStrip([dose('A', '2026-11-14', '08:00', 'missed')], now, KOLKATA, 1)[0].state).toBe('none');
  });
});

describe('missedPatterns', () => {
  it('finds the medicine and time most often missed', () => {
    expect(missedPatterns(DOSES, KOLKATA)).toEqual([{ medName: 'Metformin', time: '20:00', missed: 2, total: 2 }]);
  });

  it('returns nothing when no dose was missed', () => {
    expect(missedPatterns([dose('A', '2026-11-14', '08:00', 'taken')], KOLKATA)).toEqual([]);
  });
});
