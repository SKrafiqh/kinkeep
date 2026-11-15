'use client';

import { useRouter } from 'next/navigation';
import { useRef, type FormEvent } from 'react';
import { FormError } from './Field';
import { PasscodeInput } from './PasscodeInput';
import { useAction, useFocusFirstError } from './useAction';

/** Swaps a passcode for a new one. Members with a one-time setup passcode land here first. */
export function PasscodeChangeForm({ isSetup }: { isSetup: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { run, pending, error } = useAction<{ home: string }>();
  useFocusFirstError(form, error);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = { current: String(data.get('current') ?? ''), passcode: String(data.get('passcode') ?? '') };
    const result = await run('/api/passcode', 'POST', body, 'Saved. Use your new passcode next time you sign in.');
    if (!result) return;
    router.push(result.home);
    router.refresh();
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-6">
      <PasscodeInput
        name="current"
        label={isSetup ? 'The one-time passcode you were given' : 'Your current passcode'}
        error={error?.fields?.current}
      />
      <PasscodeInput
        name="passcode"
        label="Your new 6-digit passcode"
        hint="Pick one only you know."
        error={error?.fields?.passcode}
      />
      <FormError error={error} />
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? 'Saving…' : 'Save my passcode'}
      </button>
    </form>
  );
}
