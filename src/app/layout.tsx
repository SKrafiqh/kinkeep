import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Fraunces } from 'next/font/google';
import type { ReactNode } from 'react';
import { Announcer } from '@/components/Announcer';
import { APP_NAME } from '@/lib/constants';
import './globals.css';

// A typeface designed for low-vision readers, self-hosted at build time.
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});

// A soft, high-contrast serif for headings and times. Body text stays in Atkinson.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

// Every page carries a per-request CSP nonce (src/proxy.ts), so nothing is prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: the care circle the elder runs`, template: `%s | ${APP_NAME}` },
  description:
    'A shared care circle for one older person: medicines, appointments and email reminders, with the elder deciding who sees and changes what.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fbf7f0' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${fraunces.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Announcer>{children}</Announcer>
      </body>
    </html>
  );
}
