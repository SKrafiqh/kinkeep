import type { ReactNode } from 'react';
import { AppNav } from '@/components/AppNav';
import { Logo, SiteFooter } from '@/components/PublicShell';
import { SessionWarning } from '@/components/SessionWarning';
import { SignOutButton } from '@/components/SignOutButton';
import { homePath } from '@/domain/permissions';
import { ROLE_LABELS } from '@/lib/constants';
import { requireMember } from '@/server/page';

/** Frame for every signed-in page: who you are, the section tabs, and the session warning. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { circle, member, expiresAt } = await requireMember();
  return (
    <>
      <header>
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <Logo href={homePath(member.role)} />
            <div className="no-print flex flex-wrap items-center gap-x-4">
              <p>
                <strong>{member.name}</strong>{' '}
                <span className="hint">
                  {ROLE_LABELS[member.role]} in {circle.elderName}’s circle
                </span>
              </p>
              <SignOutButton />
            </div>
          </div>
          <div className="mt-3 pb-1">
            <AppNav isElder={member.role === 'elder'} />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="rise mx-auto max-w-5xl px-4 pt-8">
        {circle.demoPasscode ? (
          <p className="card no-print mb-6">
            <strong>This is a demo circle.</strong> Its code is <strong>{circle.code}</strong> and everyone’s passcode is{' '}
            <strong>{circle.demoPasscode}</strong>. Sign out and join as Priya to see what a caregiver sees.
          </p>
        ) : null}
        <SessionWarning expiresAt={expiresAt} />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
