import { HOUR_MS } from '@/lib/constants';
import type { Appointment } from './types';

/** Hours before the visit that each reminder goes out. */
const REMINDER_HOURS = { h24: 24, h2: 2 } as const;

type ReminderState = Pick<Appointment, 'at' | 'remindersSent'>;

/** When the engine should next look at an appointment, or null when no reminder is left. */
export function nextAppointmentReminderAt(appointment: ReminderState, now: number): number | null {
  const { at, remindersSent } = appointment;
  if (!remindersSent.h24 && now < at - REMINDER_HOURS.h2 * HOUR_MS) return at - REMINDER_HOURS.h24 * HOUR_MS;
  if (!remindersSent.h2 && now < at) return at - REMINDER_HOURS.h2 * HOUR_MS;
  return null;
}

export interface AppointmentReminder {
  /** Which reminder to send; null closes out an appointment that has already started. */
  kind: 'h24' | 'h2' | null;
  remindersSent: Appointment['remindersSent'];
  nextReminderAt: number | null;
}

/** The reminder due for an appointment at `now`, or null when nothing is due yet. */
export function dueAppointmentReminder(
  appointment: ReminderState & Pick<Appointment, 'nextReminderAt'>,
  now: number,
): AppointmentReminder | null {
  if (appointment.nextReminderAt === null || appointment.nextReminderAt > now) return null;
  const { at, remindersSent } = appointment;
  if (now >= at) return { kind: null, remindersSent: { h24: true, h2: true }, nextReminderAt: null };
  const kind = !remindersSent.h24 && now < at - REMINDER_HOURS.h2 * HOUR_MS ? 'h24' : 'h2';
  const sent = kind === 'h24' ? { ...remindersSent, h24: true } : { h24: true, h2: true };
  return { kind, remindersSent: sent, nextReminderAt: nextAppointmentReminderAt({ at, remindersSent: sent }, now) };
}
