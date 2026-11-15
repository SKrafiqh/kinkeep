import Link from 'next/link';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AdherenceBar } from '@/components/AdherenceBar';
import { DayStrip } from '@/components/DayStrip';
import { PlusIcon } from '@/components/icons';
import { can } from '@/domain/permissions';
import { getDeps } from '@/server/deps';
import { requireMember } from '@/server/page';
import { appointmentWhen } from '@/server/services/appointments';
import { circleDashboard } from '@/server/services/dashboard';

export const metadata = { title: 'Circle' };

/** The shared view for caregivers and family: how doses are going, what is coming up, what changed. */
export default async function CirclePage() {
  const { circle, member } = await requireMember();
  const deps = getDeps();
  const dashboard = await circleDashboard(deps, circle);
  const visit = dashboard.nextAppointment;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{circle.elderName}’s circle</h1>
        {can(member.role, 'medication:write') ? (
          <Link href="/medications/new" className="btn btn-primary no-print">
            <PlusIcon aria-hidden weight="bold" size={22} />
            Add medicine
          </Link>
        ) : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card grid gap-6" aria-labelledby="doses-taken">
          <h2 id="doses-taken">Doses taken</h2>
          <AdherenceBar label="Last 7 days" stat={dashboard.week} />
          <AdherenceBar label="Last 30 days" stat={dashboard.month} />
          <div className="grid gap-2">
            <h3>Day by day</h3>
            <DayStrip days={dashboard.strip} />
          </div>
          {dashboard.byMedicine.length > 0 ? (
            <div className="grid gap-3">
              <h3>By medicine, last 30 days</h3>
              {dashboard.byMedicine.map((medicine) => (
                <AdherenceBar key={medicine.medId} label={medicine.medName} stat={medicine.stat} />
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6">
          <section className="card grid justify-items-start gap-2" aria-labelledby="next-visit">
            <h2 id="next-visit">Next appointment</h2>
            {visit ? (
              <>
                <p>
                  <strong>{visit.doctor}</strong>
                  {visit.speciality ? `, ${visit.speciality}` : ''}
                  <br />
                  {appointmentWhen(visit.at, circle)}
                </p>
                <Link href={`/appointments/${visit.id}`} className="link">
                  Open the visit brief
                </Link>
              </>
            ) : (
              <>
                <p className="text-muted">Nothing booked. Appointments added here get email reminders and a brief to take along.</p>
                <Link href="/appointments" className="link">
                  See appointments
                </Link>
              </>
            )}
          </section>

          <section className="card grid gap-4" aria-labelledby="what-changed">
            <h2 id="what-changed">What changed</h2>
            <ActivityFeed items={dashboard.activity} now={deps.clock.now()} timeZone={circle.timeZone} />
          </section>
        </div>
      </div>
    </div>
  );
}
