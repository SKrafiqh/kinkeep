import Link from 'next/link';
import { Canopy } from '@/components/Canopy';
import { DemoButton } from '@/components/DemoButton';

export function Hero() {
  return (
    <section
      className="sky-window mt-6 grid min-h-[min(46rem,88dvh)] place-items-center px-5 py-24 text-center"
      aria-labelledby="hero-title"
    >
      <Canopy id="hero" />
      <div className="relative grid max-w-3xl justify-items-center gap-6">
        <p className="kicker rise">For one person, and everyone who looks out for them</p>
        <h1 id="hero-title" className="rise rise-1 text-[2.9rem] leading-[1.04] sm:text-[4.8rem]">
          The care circle the <em className="text-primary">elder</em> runs.
        </h1>
        <p className="rise rise-2 max-w-[34rem] text-[1.2rem]">
          Medicines, appointments and email reminders shared by the family, with the elder deciding who sees and changes
          what.
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
