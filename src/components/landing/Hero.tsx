import Link from 'next/link';
import { DemoButton } from '@/components/DemoButton';
import { TodayPreview } from './TodayPreview';

/** Words on the left, the product itself floating on the right, over a soft morning aurora. */
export function Hero() {
  return (
    <section
      className="aurora grid items-center gap-12 pt-14 pb-4 sm:pt-20 sm:pb-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:pb-24"
      aria-labelledby="hero-title"
    >
      <div className="grid justify-items-start gap-6">
        <p className="kicker rise">For one person, and everyone who looks out for them</p>
        <h1 id="hero-title" className="hero-title rise rise-1">
          The care circle the <em>elder</em> runs.
        </h1>
        <p className="rise rise-2 max-w-[32rem] text-[1.1rem] text-muted">
          Medicines, appointments and email reminders shared by the family, with the elder deciding who sees and changes
          what.
        </p>
        <div className="rise rise-3 flex flex-wrap gap-3">
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
  );
}
