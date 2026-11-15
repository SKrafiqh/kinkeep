import { nextAppointmentReminderAt } from '@/domain/appointments';
import { formatDay, formatTime, zonedToInstant } from '@/domain/time';
import type { Appointment, Circle } from '@/domain/types';
import { notFound } from '@/lib/errors';
import type { AppointmentInput } from '@/lib/schemas';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { newId } from '../repos/store';
import { recordActivity } from './activity';
import type { MemberContext } from './sessions';

const NOT_SENT = { h24: false, h2: false };

/** "Thu 19 Nov 10:30 am" in the circle's time zone. */
export function appointmentWhen(at: number, circle: Circle): string {
  return `${formatDay(at, circle.timeZone)} ${formatTime(at, circle.timeZone)}`;
}

export async function getAppointment(deps: Deps, circleId: string, appointmentId: string): Promise<Appointment> {
  const appointment = await deps.store.get<Appointment>(paths.appointment(circleId, appointmentId));
  if (!appointment) throw notFound('appointment');
  return appointment;
}

function fields(input: AppointmentInput, circle: Circle) {
  const { date, time, ...rest } = input;
  return { ...rest, at: zonedToInstant(date, time, circle.timeZone) };
}

/** Adds an appointment and queues its 24-hour and 2-hour reminders. */
export async function createAppointment(deps: Deps, who: MemberContext, input: AppointmentInput): Promise<Appointment> {
  const details = fields(input, who.circle);
  const appointment: Appointment = {
    id: newId(),
    ...details,
    remindersSent: NOT_SENT,
    nextReminderAt: nextAppointmentReminderAt({ at: details.at, remindersSent: NOT_SENT }, deps.clock.now()),
    brief: null,
  };
  await deps.store.set(paths.appointment(who.circle.id, appointment.id), appointment);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'appointment.create',
    targetType: 'appointment',
    targetId: appointment.id,
    summary: `${who.member.name} added an appointment with ${appointment.doctor} on ${appointmentWhen(appointment.at, who.circle)}`,
  });
  return appointment;
}

/** Saves an edit. Moving the time starts the reminders again. */
export async function updateAppointment(deps: Deps, who: MemberContext, appointmentId: string, input: AppointmentInput): Promise<Appointment> {
  const before = await getAppointment(deps, who.circle.id, appointmentId);
  const details = fields(input, who.circle);
  const moved = details.at !== before.at;
  const remindersSent = moved ? NOT_SENT : before.remindersSent;
  const after: Appointment = {
    ...before,
    ...details,
    remindersSent,
    nextReminderAt: nextAppointmentReminderAt({ at: details.at, remindersSent }, deps.clock.now()),
  };
  await deps.store.set(paths.appointment(who.circle.id, appointmentId), after);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'appointment.update',
    targetType: 'appointment',
    targetId: appointmentId,
    summary: `${who.member.name} ${moved ? `moved the appointment with ${after.doctor} to ${appointmentWhen(after.at, who.circle)}` : `updated the appointment with ${after.doctor}`}`,
  });
  return after;
}

export async function deleteAppointment(deps: Deps, who: MemberContext, appointmentId: string): Promise<void> {
  const appointment = await getAppointment(deps, who.circle.id, appointmentId);
  await deps.store.delete(paths.appointment(who.circle.id, appointmentId));
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'appointment.delete',
    targetType: 'appointment',
    targetId: appointmentId,
    summary: `${who.member.name} cancelled the appointment with ${appointment.doctor} on ${appointmentWhen(appointment.at, who.circle)}`,
  });
}
