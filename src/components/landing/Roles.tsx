import { BellRingingIcon, HandTapIcon, ShieldCheckIcon } from '@/components/icons';
import { ROLES } from './content';

const ROLE_ICONS = [ShieldCheckIcon, HandTapIcon, BellRingingIcon];

/** One glass pane, three columns split by hairlines; they stack on a phone. */
export function Roles() {
  return (
    <section id="roles" className="scroll-mt-28 py-20" aria-labelledby="roles-title">
      <h2 id="roles-title" className="section-title max-w-[40rem]">
        One circle, three kinds of people
      </h2>
      <ul className="glass mt-10 grid divide-y divide-ink/10 rounded-card md:grid-cols-3 md:divide-x md:divide-y-0">
        {ROLES.map((role, index) => {
          const Icon = ROLE_ICONS[index];
          return (
            <li key={role.name} className="grid content-start gap-3 p-7 sm:p-9">
              <Icon aria-hidden weight="duotone" size={36} className="text-primary" />
              <h3 className="text-[1.35rem] font-medium tracking-[-0.02em]">{role.name}</h3>
              <p className="font-semibold text-primary-dark">{role.lead}</p>
              <ul className="grid list-disc gap-1 pl-6 text-muted">
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
