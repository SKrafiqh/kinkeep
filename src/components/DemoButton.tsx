'use client';

import { useRouter } from 'next/navigation';
import { FormError } from './Field';
import { useAction } from './useAction';

/** Builds a sample circle with a month of history and signs the visitor in as the elder. */
export function DemoButton() {
  const router = useRouter();
  const { run, pending, error } = useAction<{ home: string }>();

  async function start(): Promise<void> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const demo = await run('/api/circles/demo', 'POST', { timeZone });
    if (demo) router.push(demo.home);
  }

  return (
    <div className="grid gap-2">
      <button type="button" className="btn btn-quiet justify-self-start" disabled={pending} onClick={start}>
        {pending ? 'Setting up the demo…' : 'Try the demo'}
      </button>
      <FormError error={error} />
    </div>
  );
}
