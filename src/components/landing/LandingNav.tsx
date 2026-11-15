import Link from 'next/link';
import { Logo } from '@/components/PublicShell';

const SECTIONS = [
  { href: '#features', label: 'What it does' },
  { href: '#how', label: 'How it works' },
  { href: '#roles', label: 'Who it is for' },
  { href: '#faq', label: 'Questions' },
];

/** The floating glass pill: logo, jump links to each section, and the two ways in. */
export function LandingNav() {
  return (
    <header className="nav-pill glass no-print">
      <Logo href="/" />
      <nav aria-label="Sections" className="nav-links">
        {SECTIONS.map((section) => (
          <a key={section.href} href={section.href}>
            {section.label}
          </a>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 lg:ml-0">
        <Link href="/join" className="btn btn-secondary whitespace-nowrap">
          Join a circle
        </Link>
        <Link href="/create" className="btn btn-primary hidden whitespace-nowrap sm:inline-flex">
          Create a circle
        </Link>
      </div>
    </header>
  );
}
