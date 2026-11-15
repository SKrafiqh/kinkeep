import { dueAppointmentReminder } from '@/domain/appointments';
import type { Appointment, Circle, Member } from '@/domain/types';
import { errorFields, log } from '@/lib/logger';
import type { Deps } from '../deps';
import { appointmentEmail } from '../email/templates';
import { paths } from '../repos/paths';
import { appointmentWhen } from '../services/appointments';
import { alertRecipients, elderRecipient, uniqueByEmail, whose } from '../services/recipients';

// Marks the reminder as sent before sending, the same claim-then-send rule the dose stages use.
function claim(deps: Deps, circleId: string, appointmentId: string, now: number): Promise<{ appointment: Appointment; kind: 'h24' | 'h2' } | null> {
  const path = paths.appointment(circleId, appointmentId);
  return deps.store.transaction(async (tx) => {
    const appointment = await tx.get<Appointment>(path);
    const reminder = appointment ? dueAppointmentReminder(appointment, now) : null;
    if (!appointment || !reminder) return null;
    tx.update(path, { remindersSent: reminder.remindersSent, nextReminderAt: reminder.nextReminderAt });
    return reminder.kind ? { appointment, kind: reminder.kind } : null;
  });
}

/** Sends the 24-hour or 2-hour reminder to the elder and to members the elder opted in. Returns emails sent. */
export async function processAppointment(deps: Deps, circle: Circle, members: Member[], appointmentId: string, now: number): Promise<number> {
  const claimed = await claim(deps, circle.id, appointmentId, now);
  if (!claimed) return 0;
  const { appointment, kind } = claimed;
  const elder = elderRecipient(circle, members);
  const recipients = uniqueByEmail([...(elder ? [elder] : []), ...alertRecipients(members, 'appointments')]);
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      deps.email.send({
        to: recipient.email,
        ...appointmentEmail({
          kind,
          whose: whose(recipient, circle),
          doctor: appointment.doctor,
          speciality: appointment.speciality,
          place: appointment.place,
          when: appointmentWhen(appointment.at, circle),
          briefUrl: `${deps.config.APP_URL}/appointments/${appointment.id}`,
        }),
      }),
    ),
  );
  for (const result of results) {
    if (result.status === 'rejected') log.warn('tick.appointment_send_failed', { circleId: circle.id, ...errorFields(result.reason) });
  }
  return results.filter((result) => result.status === 'fulfilled').length;
}
