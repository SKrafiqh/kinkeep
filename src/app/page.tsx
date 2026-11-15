import Link from 'next/link';
import { Canopy } from '@/components/Canopy';
import { DemoButton } from '@/components/DemoButton';
import { DoseSlotCard } from '@/components/DoseSlotCard';
import { Logo, SiteFooter } from '@/components/PublicShell';

const PROMISES = [
  {
    title: 'The elder is in charge',
    body: 'They choose who can change things and who is told about a missed dose. Every change is shown to them in plain words.',
  },
  {
    title: 'One tap, no login',
    body: 'Each reminder email has a Taken button. That is the whole job.',
  },
  {
    title: 'Family hears only when needed',
    body: 'Nobody else is emailed unless a dose stays unconfirmed for an hour.',
  },
  {
    title: 'A brief for every doctor visit',
    body: 'One page with what was taken, what was missed, what changed, and questions worth asking. Print it or show it on a phone.',
  },
];

const LADDER = [
  {
    time: '7:45 am',
    text: 'One email lists the 8:00 medicines, with a Taken button.',
  },
  {
    time: '8:30 am',
    text: 'Still unconfirmed? A gentle nudge, to the same person only.',
  },
  {
    time: '9:00 am',
    text: 'Still unconfirmed? The dose is marked missed and the people the elder chose are told.',
  },
];

/** Two real slot cards, stacked and offset like papers on a table, so the first screen shows the product itself. */
function TodayPreview() {
  return (
    <div className="today relative">
      <p className="sr-only">Example of the Today page: three medicines at 8:00 am marked as taken, and one due at 8:00 pm.</p>
      <div aria-hidden className="grid gap-0">
        <div className="rise rise-2">
          <DoseSlotCard
            slotTime="8:00 am"
            doses={[
              {
                id: 'a',
                medName: 'Metformin',
                strength: '1000 mg',
                view: 'taken',
              },
              {
                id: 'b',
                medName: 'Amlodipine',
                strength: '5 mg',
                view: 'taken',
              },
              { id: 'c', medName: 'Aspirin', strength: '75 mg', view: 'taken' },
            ]}
          />
        </div>
        <div className="rise rise-4 -mt-5 ml-4 sm:ml-12">
          <DoseSlotCard
            slotTime="8:00 pm"
            doses={[
              {
                id: 'd',
                medName: 'Atorvastatin',
                strength: '10 mg',
                view: 'upcoming',
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-4">
        <Logo href="/" />
        <Link href="/join" className="btn btn-quiet no-print relative z-10">
          Join a circle
        </Link>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4">
        <section className="relative grid items-center gap-12 py-12 lg:grid-cols-[1fr_1fr] lg:py-20">
          <Canopy className="pointer-events-none absolute -right-4 -top-24 w-[34rem] max-w-none opacity-90 sm:-top-28 lg:-right-16" />
          <div className="relative grid gap-7">
            <p className="rise font-bold text-primary">For one person, and everyone who looks out for them</p>
            <h1 className="rise rise-1 text-[3rem] leading-[1.02] sm:text-[4.6rem]">
              The care circle the <em className="text-primary">elder</em> runs.
            </h1>
            <p className="rise rise-2 max-w-[33rem] text-[1.25rem]">
              Medicines, appointments and email reminders shared by the family, with the elder deciding who sees and changes what.
            </p>
            <div className="rise rise-3 flex flex-wrap items-center gap-3">
              <Link href="/create" className="btn btn-primary">
                Create a circle
              </Link>
              <Link href="/join" className="btn btn-secondary">
                Join a circle
              </Link>
            </div>
            <div className="rise rise-4">
              <DemoButton />
            </div>
          </div>
          <TodayPreview />
        </section>

        <section className="grid gap-10 py-16 lg:grid-cols-[4fr_7fr] lg:gap-16" aria-labelledby="different">
          <h2 id="different" className="text-[2.3rem] sm:text-[3rem] lg:sticky lg:top-8 lg:self-start">
            Built around the person taking the medicine
          </h2>
          <ol className="glass grid divide-y divide-line rounded-card px-6 sm:px-10">
            {PROMISES.map(({ title, body }, index) => (
              <li key={title} className="grid gap-x-8 gap-y-2 py-8 sm:grid-cols-[4.5rem_1fr]">
                <span aria-hidden className="display text-[2.6rem] text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="grid gap-1">
                  <h3 className="text-[1.4rem]">{title}</h3>
                  <p className="max-w-[36rem]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="py-16" aria-labelledby="ladder">
          <h2 id="ladder" className="max-w-[40rem] text-[2.3rem] sm:text-[3rem]">
            What happens around an 8:00 dose
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {LADDER.map((step) => (
              <li
                key={step.time}
                className="relative grid content-start gap-3 pt-7 before:absolute before:left-0 before:top-0 before:h-1 before:w-full before:rounded-full before:bg-gradient-to-r before:from-accent before:to-accent/10"
              >
                <p className="display text-[2.6rem]">{step.time}</p>
                <p className="max-w-[22rem]">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-10 max-w-prose text-muted">Tap Taken at any point and it stops there. A missed dose can still be marked as taken late.</p>
        </section>

        <section className="glass mb-4 grid gap-5 rounded-card p-8 sm:p-12" aria-labelledby="start">
          <h2 id="start" className="max-w-[34rem] text-[2.3rem] sm:text-[3rem]">
            Start with one medicine and one name.
          </h2>
          <p className="max-w-[34rem]">
            A circle takes about two minutes to set up. The elder picks a passcode, and everyone else joins with the circle’s code.
          </p>
          <div>
            <Link href="/create" className="btn btn-secondary">
              Create a circle
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
