import Link from 'next/link';
import { Canopy } from '@/components/Canopy';

export function Finale() {
  return (
    <section
      className="sky-window grid min-h-[30rem] place-items-center px-5 py-24 text-center"
      aria-labelledby="start"
    >
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
