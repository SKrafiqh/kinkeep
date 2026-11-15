import { describe, expect, it } from 'vitest';
import { dueAppointmentReminder, nextAppointmentReminderAt } from '@/domain/appointments';
import { HOUR_MS, MINUTE_MS } from '@/lib/constants';

const AT = Date.UTC(2026, 10, 20, 9, 0);
const NONE = { h24: false, h2: false };

describe('nextAppointmentReminderAt', () => {
  it('starts with the 24-hour reminder', () => {
    expect(nextAppointmentReminderAt({ at: AT, remindersSent: NONE }, AT - 72 * HOUR_MS)).toBe(AT - 24 * HOUR_MS);
  });

  it('still sends a day-before reminder for a visit booked inside 24 hours', () => {
    expect(nextAppointmentReminderAt({ at: AT, remindersSent: NONE }, AT - 10 * HOUR_MS)).toBe(AT - 24 * HOUR_MS);
  });

  it('skips to the 2-hour reminder for a visit booked inside 2 hours', () => {
    expect(nextAppointmentReminderAt({ at: AT, remindersSent: NONE }, AT - HOUR_MS)).toBe(AT - 2 * HOUR_MS);
  });

  it('has nothing left once both are sent or the visit has started', () => {
    expect(nextAppointmentReminderAt({ at: AT, remindersSent: { h24: true, h2: true } }, AT - 72 * HOUR_MS)).toBeNull();
    expect(nextAppointmentReminderAt({ at: AT, remindersSent: NONE }, AT)).toBeNull();
  });
});

describe('dueAppointmentReminder', () => {
  it('returns null when nothing is due', () => {
    expect(dueAppointmentReminder({ at: AT, remindersSent: NONE, nextReminderAt: null }, AT)).toBeNull();
    expect(
      dueAppointmentReminder({ at: AT, remindersSent: NONE, nextReminderAt: AT - 24 * HOUR_MS }, AT - 25 * HOUR_MS),
    ).toBeNull();
  });

  it('sends the 24-hour reminder and queues the 2-hour one', () => {
    expect(
      dueAppointmentReminder({ at: AT, remindersSent: NONE, nextReminderAt: AT - 24 * HOUR_MS }, AT - 24 * HOUR_MS),
    ).toEqual({ kind: 'h24', remindersSent: { h24: true, h2: false }, nextReminderAt: AT - 2 * HOUR_MS });
  });

  it('sends the 2-hour reminder last', () => {
    const state = { at: AT, remindersSent: { h24: true, h2: false }, nextReminderAt: AT - 2 * HOUR_MS };
    expect(dueAppointmentReminder(state, AT - 2 * HOUR_MS)).toEqual({
      kind: 'h2',
      remindersSent: { h24: true, h2: true },
      nextReminderAt: null,
    });
  });

  it('sends only the 2-hour reminder when the engine was late for both', () => {
    const state = { at: AT, remindersSent: NONE, nextReminderAt: AT - 24 * HOUR_MS };
    expect(dueAppointmentReminder(state, AT - HOUR_MS)).toEqual({
      kind: 'h2',
      remindersSent: { h24: true, h2: true },
      nextReminderAt: null,
    });
  });

  it('closes out a visit that has already started without sending', () => {
    const state = { at: AT, remindersSent: NONE, nextReminderAt: AT - 2 * HOUR_MS };
    expect(dueAppointmentReminder(state, AT + MINUTE_MS)).toEqual({
      kind: null,
      remindersSent: { h24: true, h2: true },
      nextReminderAt: null,
    });
  });
});
