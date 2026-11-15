import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PlusIcon } from '@/components/icons';
import { can } from '@/domain/permissions';
import type { Appointment, Circle } from '@/domain/types';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { listAppointments } from '@/server/repos/queries';
import { appointmentWhen } from '@/server/services/appointments';

export const metadata = { title: 'Appointments' };

function VisitList({ visits, circle }: { visits: Appointment[]; circle: Circle }) {
  return (
    <ul className="grid gap-4">
      {visits.map((visit) => (
        <li key={visit.id} className="card grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2>{appointmentWhen(visit.at, circle)}</h2>
            <p>
              <strong>{visit.doctor}</strong>
              {visit.speciality ? `, ${visit.speciality}` : ''}
              {visit.place ? `. ${visit.place}` : ''}
            </p>
          </div>
          <Link href={`/appointments/${visit.id}`} className="btn btn-secondary justify-self-start">
            Open<span className="sr-only"> the visit with {visit.doctor}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AppointmentsPage() {
  const { circle, member } = await requireMember();
  const deps = getDeps();
  const now = deps.clock.now();
  const visits = await listAppointments(deps.store, circle.id);
  const upcoming = visits.filter((visit) => visit.at >= now);
  const past = visits.filter((visit) => visit.at < now).reverse();
  const canWrite = can(member.role, 'appointment:write');

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>Appointments</h1>
        {canWrite ? (
          <Link href="/appointments/new" className="btn btn-primary">
            <PlusIcon aria-hidden weight="bold" size={22} />
            Add appointment
          </Link>
        ) : null}
      </div>
      {upcoming.length === 0 ? (
        <EmptyState title="No upcoming appointments">
          Doctor visits added here get an email reminder 24 hours and 2 hours before, and a one-page brief to take
          along.
        </EmptyState>
      ) : (
        <VisitList visits={upcoming} circle={circle} />
      )}
      {past.length > 0 ? (
        <details>
          <summary className="link inline-flex min-h-12 cursor-pointer items-center">
            Past appointments ({past.length})
          </summary>
          <div className="mt-4">
            <VisitList visits={past} circle={circle} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
