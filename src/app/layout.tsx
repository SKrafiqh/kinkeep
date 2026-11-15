import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import type { ReactNode } from 'react';
import { Announcer } from '@/components/Announcer';
import { APP_NAME } from '@/lib/constants';
import './globals.css';

// One calm family designed for low-vision readers, self-hosted at build time. Headings, times and body share it.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-atkinson',
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
    <html lang="en" className={atkinson.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Announcer>{children}</Announcer>
      </body>
    </html>
  );
}
