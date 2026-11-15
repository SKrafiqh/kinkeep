import { BellRingingIcon, HandTapIcon, ShieldCheckIcon } from '@/components/icons';
import { ROLES } from './content';

const ROLE_ICONS = [ShieldCheckIcon, HandTapIcon, BellRingingIcon];

export function Roles() {
  return (
    <section id="roles" className="scroll-mt-28 py-20" aria-labelledby="roles-title">
      <h2 id="roles-title" className="max-w-[40rem] text-[2.3rem] sm:text-[3.2rem]">
        One circle, three kinds of people
      </h2>
      <ul className="mt-10 grid gap-5 md:grid-cols-2 md:grid-rows-2">
        {ROLES.map((role, index) => {
          const Icon = ROLE_ICONS[index];
          return (
            <li
              key={role.name}
              className={`card grid content-start gap-4 p-7 sm:p-9 ${index === 0 ? 'md:row-span-2' : ''}`}
            >
              <Icon aria-hidden weight="duotone" size={44} className="text-primary" />
              <h3 className="display text-[2rem]">{role.name}</h3>
              <p className="text-[1.15rem] font-bold">{role.lead}</p>
              <ul className="grid list-disc gap-1 pl-6">
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
