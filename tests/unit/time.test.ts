import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatClock,
  formatDate,
  formatDay,
  formatTime,
  formatWhen,
  isValidTimeZone,
  localDate,
  localTime,
  weekdayOf,
  zonedParts,
  zonedToInstant,
} from '@/domain/time';

const KOLKATA = 'Asia/Kolkata';
const NEW_YORK = 'America/New_York';

describe('zonedToInstant', () => {
  it('converts a Kolkata wall time to UTC', () => {
    expect(zonedToInstant('2026-11-16', '08:00', KOLKATA)).toBe(Date.UTC(2026, 10, 16, 2, 30));
  });

  it('follows the offset change when New York clocks go forward and back', () => {
    expect(zonedToInstant('2026-03-07', '08:00', NEW_YORK)).toBe(Date.UTC(2026, 2, 7, 13, 0));
    expect(zonedToInstant('2026-03-08', '08:00', NEW_YORK)).toBe(Date.UTC(2026, 2, 8, 12, 0));
    expect(zonedToInstant('2026-11-01', '08:00', NEW_YORK)).toBe(Date.UTC(2026, 10, 1, 13, 0));
  });

  it('maps a skipped wall time to the hour before the clock change', () => {
    expect(zonedToInstant('2026-03-08', '02:30', NEW_YORK)).toBe(Date.UTC(2026, 2, 8, 6, 30));
  });

  it('maps a repeated wall time to its first occurrence', () => {
    expect(zonedToInstant('2026-11-01', '01:30', NEW_YORK)).toBe(Date.UTC(2026, 10, 1, 5, 30));
  });

  it('round-trips through localDate and localTime', () => {
    const instant = zonedToInstant('2026-07-04', '23:45', NEW_YORK);
    expect(localDate(instant, NEW_YORK)).toBe('2026-07-04');
    expect(localTime(instant, NEW_YORK)).toBe('23:45');
  });
});

describe('zoned fields', () => {
  it('reads the local date across midnight', () => {
    const lateEveningUtc = Date.UTC(2026, 10, 15, 20, 0);
    expect(localDate(lateEveningUtc, KOLKATA)).toBe('2026-11-16');
    expect(localDate(lateEveningUtc, NEW_YORK)).toBe('2026-11-15');
  });

  it('returns the weekday with Sunday as 0', () => {
    expect(zonedParts(Date.UTC(2026, 10, 16, 6, 0), KOLKATA)).toMatchObject({ weekday: 1, hour: 11, minute: 30 });
    expect(weekdayOf('2026-11-15')).toBe(0);
  });

  it('reports midnight as hour 0', () => {
    expect(localTime(zonedToInstant('2026-11-16', '00:00', KOLKATA), KOLKATA)).toBe('00:00');
  });
});

describe('calendar helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('accepts real zones and rejects made-up ones', () => {
    expect(isValidTimeZone(KOLKATA)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});

describe('formatting', () => {
  it('writes 12-hour times with am and pm', () => {
    expect(formatClock('08:00')).toBe('8:00 am');
    expect(formatClock('00:05')).toBe('12:05 am');
    expect(formatClock('12:00')).toBe('12:00 pm');
    expect(formatClock('20:30')).toBe('8:30 pm');
  });

  it('writes dates as "Mon 16 Nov"', () => {
    expect(formatDate('2026-11-16')).toBe('Mon 16 Nov');
    expect(formatDay(Date.UTC(2026, 10, 15, 20, 0), KOLKATA)).toBe('Mon 16 Nov');
    expect(formatTime(Date.UTC(2026, 10, 16, 2, 30), KOLKATA)).toBe('8:00 am');
  });

  it('names today, yesterday and tomorrow, and dates anything further', () => {
    const now = zonedToInstant('2026-11-16', '09:00', KOLKATA);
    expect(formatWhen(zonedToInstant('2026-11-16', '08:00', KOLKATA), now, KOLKATA)).toBe('today 8:00 am');
    expect(formatWhen(zonedToInstant('2026-11-15', '18:10', KOLKATA), now, KOLKATA)).toBe('yesterday 6:10 pm');
    expect(formatWhen(zonedToInstant('2026-11-17', '09:00', KOLKATA), now, KOLKATA)).toBe('tomorrow 9:00 am');
    expect(formatWhen(zonedToInstant('2026-11-10', '09:00', KOLKATA), now, KOLKATA)).toBe('Tue 10 Nov 9:00 am');
  });
});
