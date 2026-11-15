import { STEPS } from './content';

export function HowItWorks() {
  return (
    <section id="how" className="grid scroll-mt-28 gap-12 py-20 lg:grid-cols-[5fr_6fr]" aria-labelledby="how-title">
      <div className="grid content-start gap-4 lg:sticky lg:top-28 lg:self-start">
        <p className="kicker">
          <b>02</b> How it works
        </p>
        <h2 id="how-title" className="text-[2.3rem] sm:text-[3.2rem]">
          What happens around an 8:00 dose
        </h2>
        <p className="max-w-[30rem]">
          Remind the elder first. Bring in others only when a dose stays unconfirmed, and only the people the elder
          chose.
        </p>
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
