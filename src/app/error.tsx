'use client';

/** Shown when a page fails to load. Says what to do next and never shows technical details. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto grid max-w-xl justify-items-start gap-4 px-4 pt-16">
      <h1>Something went wrong on our side</h1>
      <p>Nothing you entered was lost on purpose. Try again, and if it keeps happening, wait a minute first.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
