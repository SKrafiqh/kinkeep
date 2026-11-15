import { describe, expect, it } from 'vitest';
import { buildDoseEvent, doseEventId, expandDoses, planMaterialisation, slotKey } from '@/domain/schedule';
import { zonedToInstant } from '@/domain/time';
import type { Medication } from '@/domain/types';
import { HOUR_MS, MINUTE_MS, REMINDER_DEFAULTS } from '@/lib/constants';

const KOLKATA = 'Asia/Kolkata';
const NEW_YORK = 'America/New_York';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function medicine(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med1',
    name: 'Metformin',
    strength: '500 mg',
    form: 'Tablet',
    instructions: '',
    times: ['08:00', '20:00'],
    daysOfWeek: EVERY_DAY,
    startDate: '2026-01-01',
    endDate: null,
    active: true,
    materialisedUntil: null,
    createdBy: 'm1',
    updatedBy: 'm1',
    updatedAt: 0,
    ...overrides,
  };
}

describe('expandDoses', () => {
  it('expands across midnight in the circle time zone', () => {
    const med = medicine({ times: ['23:30', '00:30'] });
    const after = zonedToInstant('2026-11-16', '22:00', KOLKATA);
    const until = zonedToInstant('2026-11-17', '02:00', KOLKATA);
    expect(expandDoses(med, KOLKATA, after, until).map((d) => `${d.date} ${d.time}`)).toEqual([
      '2026-11-16 23:30',
      '2026-11-17 00:30',
    ]);
  });

  it('keeps the wall time fixed across a daylight-saving change', () => {
    const med = medicine({ times: ['08:00'] });
    const after = zonedToInstant('2026-03-07', '00:00', NEW_YORK);
    const until = zonedToInstant('2026-03-09', '23:00', NEW_YORK);
    expect(expandDoses(med, NEW_YORK, after, until).map((d) => d.dueAt)).toEqual([
      Date.UTC(2026, 2, 7, 13, 0),
      Date.UTC(2026, 2, 8, 12, 0),
      Date.UTC(2026, 2, 9, 12, 0),
    ]);
  });

  it('excludes the lower bound and includes the upper bound', () => {
    const med = medicine({ times: ['08:00'] });
    const eight = zonedToInstant('2026-11-16', '08:00', KOLKATA);
    expect(expandDoses(med, KOLKATA, eight, eight + HOUR_MS)).toEqual([]);
    expect(expandDoses(med, KOLKATA, eight - HOUR_MS, eight)).toHaveLength(1);
  });

  it('honours days of the week, start date and end date', () => {
    const after = zonedToInstant('2026-11-15', '00:00', KOLKATA);
    const until = zonedToInstant('2026-11-21', '23:59', KOLKATA);
    const mondays = medicine({ times: ['08:00'], daysOfWeek: [1] });
    expect(expandDoses(mondays, KOLKATA, after, until).map((d) => d.date)).toEqual(['2026-11-16']);
    const bounded = medicine({ times: ['08:00'], startDate: '2026-11-17', endDate: '2026-11-18' });
    expect(expandDoses(bounded, KOLKATA, after, until).map((d) => d.date)).toEqual(['2026-11-17', '2026-11-18']);
  });

  it('returns nothing for a paused medicine', () => {
    expect(expandDoses(medicine({ active: false }), KOLKATA, 0, HOUR_MS * 48)).toEqual([]);
  });
});

describe('dose events', () => {
  it('builds deterministic ids and slot keys', () => {
    expect(doseEventId('med1', { date: '2026-11-16', time: '08:00' })).toBe('med1_20261116_0800');
    expect(slotKey('c1', 1234)).toBe('c1_1234');
  });

  it('schedules the first reminder a lead time before the dose', () => {
    const dueAt = zonedToInstant('2026-11-16', '08:00', KOLKATA);
    const event = buildDoseEvent('c1', medicine(), { date: '2026-11-16', time: '08:00', dueAt }, REMINDER_DEFAULTS);
    expect(event).toMatchObject({
      id: 'med1_20261116_0800',
      medName: 'Metformin',
      status: 'scheduled',
      slotKey: `c1_${dueAt}`,
      nextActionAt: dueAt - 15 * MINUTE_MS,
      attempts: 0,
    });
  });
});

describe('planMaterialisation', () => {
  const now = zonedToInstant('2026-11-16', '06:00', KOLKATA);
  const circle = { id: 'c1', timeZone: KOLKATA, settings: REMINDER_DEFAULTS };

  it('plans the next 36 hours', () => {
    const plan = planMaterialisation(circle, medicine(), now);
    expect(plan.events.map((e) => e.id)).toEqual(['med1_20261116_0800', 'med1_20261116_2000', 'med1_20261117_0800']);
    expect(plan.materialisedUntil).toBe(now + 36 * HOUR_MS);
  });

  it('only tops up beyond the existing horizon', () => {
    const med = medicine({ materialisedUntil: now + 36 * HOUR_MS });
    const plan = planMaterialisation(circle, med, now + 6 * HOUR_MS);
    expect(plan.events.map((e) => e.id)).toEqual(['med1_20261117_2000']);
  });

  it('never plans doses in the past, even after a long outage', () => {
    const med = medicine({ materialisedUntil: now - 72 * HOUR_MS });
    const plan = planMaterialisation(circle, med, now);
    expect(plan.events.every((e) => e.dueAt > now)).toBe(true);
  });

  it('stops topping up once the end date is covered', () => {
    const plan = planMaterialisation(circle, medicine({ endDate: '2026-11-16' }), now);
    expect(plan.events).toHaveLength(2);
    expect(plan.materialisedUntil).toBeNull();
  });

  it('plans nothing for a paused medicine', () => {
    const plan = planMaterialisation(circle, medicine({ active: false }), now);
    expect(plan).toEqual({ events: [], materialisedUntil: null });
  });
});
