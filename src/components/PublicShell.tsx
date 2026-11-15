import Link from 'next/link';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';

/** The logo. It is black on white, so multiply blending lets the paper show through. */
export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex min-h-12 items-center" aria-label={`${APP_NAME} home`}>
      {/* A plain img on purpose: next/image adds an inline style attribute, which the strict CSP blocks. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt={APP_NAME} width={690} height={210} className="h-11 w-auto mix-blend-multiply" />
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print mx-auto mt-16 max-w-5xl px-4 pb-10 text-muted">
      <p className="hint border-t border-line pt-6">
        {APP_NAME} helps a family keep track together. It is not a medical device and gives no medical advice. Always check with your doctor or
        pharmacist.
      </p>
    </footer>
  );
}

/** Frame for pages people see before they sign in. */
export function PublicShell({ children, width = 'max-w-xl' }: { children: ReactNode; width?: string }) {
  return (
    <>
      <header className="mx-auto max-w-5xl px-4 pt-4">
        <Logo href="/" />
      </header>
      <main id="main" tabIndex={-1} className={`mx-auto px-4 pt-8 ${width}`}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
