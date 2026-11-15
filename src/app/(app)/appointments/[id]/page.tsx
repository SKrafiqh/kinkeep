import { notFound } from 'next/navigation';
import { AppointmentForm } from '@/components/AppointmentForm';
import { BriefPanel } from '@/components/BriefPanel';
import { DeleteButton } from '@/components/DeleteButton';
import { can } from '@/domain/permissions';
import { localDate, localTime } from '@/domain/time';
import type { Appointment } from '@/domain/types';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { paths } from '@/server/repos/paths';
import { appointmentWhen } from '@/server/services/appointments';

export const metadata = { title: 'Visit brief' };

/** One appointment: the printable visit brief first, then the details to edit. */
export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { circle, member } = await requireMember();
  const { id } = await params;
  const visit = await getDeps().store.get<Appointment>(paths.appointment(circle.id, id));
  if (!visit) notFound();
  const canWrite = can(member.role, 'appointment:write');

  return (
    <div className="grid max-w-3xl gap-8">
      <div>
        <h1>Visit brief: {visit.doctor}</h1>
        <p>
          {appointmentWhen(visit.at, circle)}
          {visit.speciality ? `, ${visit.speciality}` : ''}
          {visit.place ? `, ${visit.place}` : ''}
        </p>
        <p>For {circle.elderName}</p>
        {visit.notes ? <p className="margin-rule mt-3 pl-4">Notes for this visit: {visit.notes}</p> : null}
      </div>
      <section className="card" aria-label="Visit brief">
        <BriefPanel appointmentId={visit.id} initial={visit.brief} canEdit={canWrite} />
      </section>
      {canWrite ? (
        <section className="no-print grid gap-6" aria-labelledby="edit-visit">
          <h2 id="edit-visit">Change this appointment</h2>
          <AppointmentForm
            appointment={{
              id: visit.id,
              doctor: visit.doctor,
              speciality: visit.speciality,
              place: visit.place,
              date: localDate(visit.at, circle.timeZone),
              time: localTime(visit.at, circle.timeZone),
              notes: visit.notes,
            }}
          />
          <DeleteButton
            path={`/api/appointments/${visit.id}`}
            label="Cancel this appointment"
            title={`Cancel the appointment with ${visit.doctor}?`}
            consequence="Its reminders stop and its visit brief is removed."
            done="The appointment was cancelled."
            redirectTo="/appointments"
          />
        </section>
      ) : null}
    </div>
  );
}
