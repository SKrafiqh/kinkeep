import { describe, expect, it } from 'vitest';
import { formatDays, formatTimes, medicationChangeSummary, type MedicationFields } from '@/domain/activity';

const BASE: MedicationFields = {
  name: 'Metformin',
  strength: '500 mg',
  form: 'Tablet',
  instructions: 'After food',
  times: ['08:00'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-01',
  endDate: null,
  active: true,
};

describe('formatTimes and formatDays', () => {
  it('lists times in order', () => {
    expect(formatTimes(['20:00', '08:00'])).toBe('8:00 am and 8:00 pm');
    expect(formatTimes(['08:00', '14:00', '20:00'])).toBe('8:00 am, 2:00 pm and 8:00 pm');
    expect(formatTimes(['08:00'])).toBe('8:00 am');
  });

  it('says "every day" for all seven days', () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('every day');
    expect(formatDays([5, 1, 3])).toBe('Mon, Wed, Fri');
  });
});

describe('medicationChangeSummary', () => {
  it('describes a strength change the way a person would', () => {
    expect(medicationChangeSummary('Priya', BASE, { ...BASE, strength: '1000 mg' })).toBe(
      'Priya changed Metformin from 500 mg to 1000 mg',
    );
  });

  it('lists every changed field', () => {
    const after = {
      ...BASE,
      times: ['08:00', '20:00'],
      daysOfWeek: [1, 3, 5],
      instructions: 'Before food',
      endDate: '2026-12-01',
    };
    expect(medicationChangeSummary('Priya', BASE, after)).toBe(
      'Priya changed Metformin times from 8:00 am to 8:00 am and 8:00 pm, days from every day to Mon, Wed, Fri, the instructions, end date to Tue 1 Dec',
    );
  });

  it('covers name, form, start date and a removed end date', () => {
    const before = { ...BASE, endDate: '2026-12-01' };
    const after = { ...before, name: 'Glycomet', form: 'Capsule', startDate: '2026-11-16', endDate: null };
    expect(medicationChangeSummary('Priya', before, after)).toBe(
      'Priya changed Metformin name to Glycomet, form to capsule, start date to Mon 16 Nov, end date removed',
    );
  });

  it('describes pausing and resuming', () => {
    expect(medicationChangeSummary('Mr Rao', BASE, { ...BASE, active: false })).toBe('Mr Rao paused Metformin');
    expect(medicationChangeSummary('Mr Rao', { ...BASE, active: false }, BASE)).toBe('Mr Rao resumed Metformin');
    expect(medicationChangeSummary('Mr Rao', { ...BASE, active: false }, { ...BASE, strength: '1000 mg' })).toBe(
      'Mr Rao resumed and changed Metformin from 500 mg to 1000 mg',
    );
  });

  it('says so when nothing changed', () => {
    expect(medicationChangeSummary('Priya', BASE, { ...BASE })).toBe('Priya saved Metformin with no changes');
  });
});
