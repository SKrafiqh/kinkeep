import { APP_NAME } from '@/lib/constants';
import { FACTS } from './content';

export function Why() {
  return (
    <section className="py-20 sm:py-28" aria-labelledby="why">
      <h2 id="why" className="statement">
        Most reminder apps watch the elder and report to the family. {APP_NAME} hands the elder the keys: who sees what,
        who is told, and every change in plain words.
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
