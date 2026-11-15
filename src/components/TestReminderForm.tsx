'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Field, FormError } from './Field';
import { EnvelopeSimpleIcon } from './icons';
import { useAction, useFocusFirstError } from './useAction';

/** Sends one real reminder email to the address typed in, so anyone can try the one-tap button. */
export function TestReminderForm() {
  const form = useRef<HTMLFormElement>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { run, pending, error } = useAction<{ withActions: boolean }>();
  useFocusFirstError(form, error);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    setSentTo(null);
    if (await run('/api/test-reminder', 'POST', { email }, `Sent. Check the inbox for ${email}.`)) setSentTo(email);
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="card grid gap-4">
      <h2>See a reminder email</h2>
      <Field name="email" label="Send a test reminder to" hint="One email, sent now, with a working Taken button." type="email" autoComplete="email" error={error?.fields?.email} />
      <FormError error={error} />
      <button type="submit" className="btn btn-secondary justify-self-start" disabled={pending}>
        <EnvelopeSimpleIcon aria-hidden weight="bold" size={22} />
        {pending ? 'Sending…' : 'Send me a test reminder'}
      </button>
      {sentTo ? <p className="font-bold text-taken">Sent to {sentTo}. It can take a minute to arrive; check spam too.</p> : null}
    </form>
  );
}
