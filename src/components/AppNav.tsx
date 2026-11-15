'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarBlankIcon, NotebookIcon, PillIcon, SunIcon, UsersThreeIcon } from './icons';

const LINKS = [
  { href: '/today', label: 'Today', Icon: SunIcon, elderOnly: false },
  { href: '/circle', label: 'Circle', Icon: NotebookIcon, elderOnly: false },
  { href: '/medications', label: 'Medicines', Icon: PillIcon, elderOnly: false },
  { href: '/appointments', label: 'Appointments', Icon: CalendarBlankIcon, elderOnly: false },
  { href: '/members', label: 'Members', Icon: UsersThreeIcon, elderOnly: true },
];

/** The main sections as notebook index tabs. The current one is marked for screen readers too. */
export function AppNav({ isElder }: { isElder: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="no-print">
      <ul className="flex flex-wrap gap-x-1 gap-y-2">
        {LINKS.filter((link) => isElder || !link.elderOnly).map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} className="tab" aria-current={pathname.startsWith(href) ? 'page' : undefined}>
              <Icon aria-hidden weight="bold" size={22} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
