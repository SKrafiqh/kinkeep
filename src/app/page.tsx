import Link from 'next/link';
import { Canopy } from '@/components/Canopy';
import { DemoButton } from '@/components/DemoButton';
import { DoseSlotCard } from '@/components/DoseSlotCard';
import { BellRingingIcon, HandTapIcon, ShieldCheckIcon } from '@/components/icons';
import { FACTS, FEATURES, QUESTIONS, ROLES, STEPS } from '@/components/landing/content';
import { Logo } from '@/components/PublicShell';
import { APP_NAME } from '@/lib/constants';

const ROLE_ICONS = [ShieldCheckIcon, HandTapIcon, BellRingingIcon];
const SECTIONS = [
  { href: '#features', label: 'What it does' },
  { href: '#how', label: 'How it works' },
  { href: '#roles', label: 'Who it is for' },
  { href: '#faq', label: 'Questions' },
];

/** Two real slot cards, offset like papers on a table, so the first screen shows the product itself. */
function TodayPreview() {
  return (
    <div className="today relative mx-auto max-w-3xl">
      <p className="sr-only">Example of the Today page: three medicines at 8:00 am marked as taken, and one due at 8:00 pm.</p>
      <div aria-hidden>
        <div className="rise rise-3">
          <DoseSlotCard
            slotTime="8:00 am"
            doses={[
              { id: 'a', medName: 'Metformin', strength: '1000 mg', view: 'taken' },
              { id: 'b', medName: 'Amlodipine', strength: '5 mg', view: 'taken' },
              { id: 'c', medName: 'Aspirin', strength: '75 mg', view: 'taken' },
            ]}
          />
        </div>
        <div className="rise rise-4 -mt-4 ml-6 sm:ml-16">
          <DoseSlotCard slotTime="8:00 pm" doses={[{ id: 'd', medName: 'Atorvastatin', strength: '10 mg', view: 'upcoming' }]} />
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="sky-window mt-6 grid min-h-[min(46rem,88dvh)] place-items-center px-5 py-24 text-center" aria-labelledby="hero-title">
      <Canopy id="hero" />
      <div className="relative grid max-w-3xl justify-items-center gap-6">
        <p className="kicker rise">For one person, and everyone who looks out for them</p>
        <h1 id="hero-title" className="rise rise-1 text-[2.9rem] leading-[1.04] sm:text-[4.8rem]">
          The care circle the <em className="text-primary">elder</em> runs.
        </h1>
        <p className="rise rise-2 max-w-[34rem] text-[1.2rem]">
          Medicines, appointments and email reminders shared by the family, with the elder deciding who sees and changes what.
        </p>
        <div className="rise rise-3 flex flex-wrap justify-center gap-3">
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
    </section>
  );
}

function Why() {
  return (
    <section className="py-20 sm:py-28" aria-labelledby="why">
      <h2 id="why" className="statement">
        Most reminder apps watch the elder and report to the family. {APP_NAME} hands the elder the keys: who sees what, who is told, and every
        change in plain words.
      </h2>
      <dl className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.value} className="fact">
            <dd>{fact.value}</dd>
            <dt className="max-w-[16rem]">{fact.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-28 py-16" aria-labelledby="features-title">
      <p className="kicker">
        <b>01</b> What it does
      </p>
      <h2 id="features-title" className="mt-3 max-w-[40rem] text-[2.3rem] sm:text-[3.2rem]">
        Six things, each done plainly
      </h2>
      <div className="mt-10">
        {FEATURES.map((feature, index) => (
          <details key={feature.title} className="index-row" open={index === 0}>
            <summary>
              <span className="display text-[1.4rem] text-accent" aria-hidden>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="index-title">{feature.title}</span>
              <span className="plus" aria-hidden />
            </summary>
            <div className="index-body">
              <p>{feature.text}</p>
              <ul className="flex flex-wrap gap-2" aria-label="Notes">
                {feature.tags.map((tag) => (
                  <li key={tag} className="tag">
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="grid scroll-mt-28 gap-12 py-20 lg:grid-cols-[5fr_6fr]" aria-labelledby="how-title">
      <div className="grid content-start gap-4 lg:sticky lg:top-28 lg:self-start">
        <p className="kicker">
          <b>02</b> How it works
        </p>
        <h2 id="how-title" className="text-[2.3rem] sm:text-[3.2rem]">
          What happens around an 8:00 dose
        </h2>
        <p className="max-w-[30rem]">Remind the elder first. Bring in others only when a dose stays unconfirmed, and only the people the elder chose.</p>
      </div>
      <ol className="stem glass rounded-card p-7 pl-16 sm:p-10 sm:pl-20">
        {STEPS.map((step) => (
          <li key={step.time}>
            <p className="display text-[2.2rem] sm:text-[2.6rem]">{step.time}</p>
            <h3 className="text-[1.25rem]">{step.title}</h3>
            <p className="max-w-[32rem]">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Roles() {
  return (
    <section id="roles" className="scroll-mt-28 py-20" aria-labelledby="roles-title">
      <h2 id="roles-title" className="max-w-[40rem] text-[2.3rem] sm:text-[3.2rem]">
        One circle, three kinds of people
      </h2>
      <ul className="mt-10 grid gap-5 md:grid-cols-2 md:grid-rows-2">
        {ROLES.map((role, index) => {
          const Icon = ROLE_ICONS[index];
          return (
            <li key={role.name} className={`card grid content-start gap-4 p-7 sm:p-9 ${index === 0 ? 'md:row-span-2' : ''}`}>
              <Icon aria-hidden weight="duotone" size={44} className="text-primary" />
              <h3 className="display text-[2rem]">{role.name}</h3>
              <p className="text-[1.15rem] font-bold">{role.lead}</p>
              <ul className="grid list-disc gap-1 pl-6">
                {role.can.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Questions() {
  return (
    <section id="faq" className="grid scroll-mt-28 gap-12 py-20 lg:grid-cols-[4fr_6fr]" aria-labelledby="faq-title">
      <div className="grid content-start gap-4">
        <p className="kicker">
          <b>03</b> Questions
        </p>
        <h2 id="faq-title" className="text-[2.3rem] sm:text-[3.2rem]">
          What families ask first
        </h2>
        <div className="card mt-4 grid justify-items-start gap-3 p-7">
          <p className="text-[1.15rem] font-bold">See it working in a minute.</p>
          <p>The demo is a sample circle with a month of history and a dose due in a few minutes.</p>
          <DemoButton />
        </div>
      </div>
      <div>
        {QUESTIONS.map((item) => (
          <details key={item.q} className="index-row">
            <summary className="!grid-cols-[1fr_3rem]">
              <span className="text-[1.25rem] font-bold">{item.q}</span>
              <span className="plus" aria-hidden />
            </summary>
            <p className="max-w-[40rem] px-2 pb-7">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section className="sky-window grid min-h-[30rem] place-items-center px-5 py-24 text-center" aria-labelledby="start">
      <Canopy id="finale" />
      <div className="relative grid max-w-2xl justify-items-center gap-5">
        <h2 id="start" className="text-[2.4rem] sm:text-[3.6rem]">
          Start with one medicine and one name.
        </h2>
        <p className="max-w-[32rem] text-[1.15rem]">
          A circle takes about two minutes. The elder picks a passcode, and everyone else joins with the circle’s code.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn btn-primary">
            Create a circle
          </Link>
          <Link href="/join" className="btn btn-secondary">
            Join a circle
          </Link>
        </div>
      </div>
    </section>
  );
}

function ForestFooter() {
  return (
    <footer className="forest mt-24 overflow-hidden pt-16">
      <div className="wrap grid gap-8 sm:grid-cols-[2fr_1fr]">
        <p className="muted-on-dark max-w-[36rem]">
          {APP_NAME} helps a family keep track together. It is not a medical device and gives no medical advice. Always check with your doctor or
          pharmacist.
        </p>
        <ul className="grid content-start gap-1">
          <li>
            <Link href="/create" className="link inline-flex min-h-12 items-center !text-[#eef5f1]">
              Create a circle
            </Link>
          </li>
          <li>
            <Link href="/join" className="link inline-flex min-h-12 items-center !text-[#eef5f1]">
              Join a circle
            </Link>
          </li>
          <li>
            <a href="https://github.com/SKrafiqh/kinkeep" className="link inline-flex min-h-12 items-center !text-[#eef5f1]">
              Source code
            </a>
          </li>
        </ul>
      </div>
      <p className="wordmark mt-14 pb-4" aria-hidden>
        {APP_NAME}
      </p>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <>
      <div className="wrap pt-3">
        <header className="nav-pill glass no-print">
          <Logo href="/" />
          <nav aria-label="Sections" className="nav-links">
            {SECTIONS.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link href="/join" className="btn btn-secondary whitespace-nowrap">
              Join a circle
            </Link>
            <Link href="/create" className="btn btn-primary hidden whitespace-nowrap sm:inline-flex">
              Create a circle
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Hero />
          <div className="-mt-16 px-2 sm:-mt-24">
            <TodayPreview />
          </div>
          <Why />
          <Features />
          <HowItWorks />
          <Roles />
          <Questions />
          <Finale />
        </main>
      </div>
      <ForestFooter />
    </>
  );
}
