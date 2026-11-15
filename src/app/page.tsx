import Link from 'next/link';
import { DemoButton } from '@/components/DemoButton';
import { DoseSlotCard } from '@/components/DoseSlotCard';
import { BellRingingIcon, HandTapIcon, NotebookIcon, ShieldCheckIcon } from '@/components/icons';
import { Logo, SiteFooter } from '@/components/PublicShell';

const DIFFERENCES = [
  {
    Icon: ShieldCheckIcon,
    title: 'The elder is in charge',
    body: 'They choose who can change things and who is told about a missed dose. Every change is shown to them in plain words.',
    span: 'md:col-span-3',
  },
  {
    Icon: HandTapIcon,
    title: 'One tap, no login',
    body: 'Each reminder email has a Taken button. That is the whole job.',
    span: 'md:col-span-2',
  },
  {
    Icon: BellRingingIcon,
    title: 'Family hears only when needed',
    body: 'Nobody else is emailed unless a dose stays unconfirmed for an hour.',
    span: 'md:col-span-2',
  },
  {
    Icon: NotebookIcon,
    title: 'A brief for every doctor visit',
    body: 'One page with what was taken, what was missed, what changed, and questions worth asking. Print it or show it on a phone.',
    span: 'md:col-span-3',
  },
];

const LADDER = [
  { time: '7:45 am', text: 'One email lists the 8:00 medicines, with a Taken button.' },
  { time: '8:30 am', text: 'Still unconfirmed? A gentle nudge, to the same person only.' },
  { time: '9:00 am', text: 'Still unconfirmed? The dose is marked missed and the people the elder chose are told.' },
];

function TodayPreview() {
  return (
    <div className="today rounded-card border border-line bg-wash p-3 shadow-[0_18px_40px_-24px_rgb(22_38_46/0.45)] sm:p-5">
      <p className="sr-only">Example of the Today page: three medicines at 8:00 am marked as taken, and one due at 8:00 pm.</p>
      <div aria-hidden className="grid gap-3">
        <DoseSlotCard
          slotTime="8:00 am"
          doses={[
            { id: 'a', medName: 'Metformin', strength: '1000 mg', view: 'taken' },
            { id: 'b', medName: 'Amlodipine', strength: '5 mg', view: 'taken' },
            { id: 'c', medName: 'Aspirin', strength: '75 mg', view: 'taken' },
          ]}
        />
        <DoseSlotCard slotTime="8:00 pm" doses={[{ id: 'd', medName: 'Atorvastatin', strength: '10 mg', view: 'upcoming' }]} />
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto max-w-6xl px-4 pt-4">
        <Logo href="/" />
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[5fr_6fr] lg:py-16">
          <div className="grid gap-6">
            <h1 className="text-[2.2rem] sm:text-[2.8rem]">The care circle the elder runs.</h1>
            <p className="max-w-[34rem] text-[1.2rem]">
              Medicines, appointments and email reminders shared by the family, with the elder deciding who sees and changes what.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/create" className="btn btn-primary">
                Create a circle
              </Link>
              <Link href="/join" className="btn btn-secondary">
                Join a circle
              </Link>
            </div>
            <DemoButton />
          </div>
          <TodayPreview />
        </section>

        <section className="py-10" aria-labelledby="different">
          <h2 id="different">Built around the person taking the medicine</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-5">
            {DIFFERENCES.map(({ Icon, title, body, span }, index) => (
              <li key={title} className={`card grid content-start gap-2 ${span} ${index % 3 === 0 ? 'bg-wash' : ''}`}>
                <Icon aria-hidden weight="bold" size={34} className="text-primary" />
                <h3 className="text-[1.15rem]">{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="py-10" aria-labelledby="ladder">
          <h2 id="ladder">What happens around an 8:00 dose</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-3">
            {LADDER.map((step) => (
              <li key={step.time} className="margin-rule pl-4">
                <p className="text-[1.5rem] font-bold">{step.time}</p>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-prose text-muted">Tap Taken at any point and it stops there. A missed dose can still be marked as taken late.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
