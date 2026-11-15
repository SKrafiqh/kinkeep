'use client';

import { useRouter } from 'next/navigation';
import { SignOutIcon } from './icons';
import { useAction } from './useAction';

export function SignOutButton() {
  const router = useRouter();
  const { run, pending } = useAction();

  async function signOut(): Promise<void> {
    if ((await run('/api/session', 'DELETE', undefined, 'You are signed out.')) === null) return;
    router.push('/');
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-quiet" disabled={pending} onClick={signOut}>
      <SignOutIcon aria-hidden weight="bold" size={22} />
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
