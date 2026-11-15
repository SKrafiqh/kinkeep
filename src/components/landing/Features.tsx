import { FEATURES } from './content';

export function Features() {
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
