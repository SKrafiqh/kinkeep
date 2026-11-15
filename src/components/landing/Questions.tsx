import { DemoButton } from '@/components/DemoButton';
import { QUESTIONS } from './content';

export function Questions() {
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
          <details key={item.q} className="index-row index-row--question">
            <summary>
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
