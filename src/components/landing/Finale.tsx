import Link from 'next/link';

export function Finale() {
  return (
    <section className="aurora py-16 sm:py-24" aria-labelledby="start">
      <div className="glass mx-auto grid max-w-3xl justify-items-center gap-5 rounded-card px-6 py-14 text-center sm:px-14 sm:py-16">
        <h2 id="start" className="section-title">
          Start with one medicine and one name.
        </h2>
        <p className="max-w-[32rem] text-muted">
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
