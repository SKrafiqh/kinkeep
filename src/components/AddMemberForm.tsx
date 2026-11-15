'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Field, FormError } from './Field';
import { useAction, useFocusFirstError } from './useAction';

interface Added {
  member: { name: string };
  setupPasscode: string;
}

function SetupPasscode({ added, circleCode }: { added: Added; circleCode: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => panel.current?.focus(), [added]);
  return (
    <div ref={panel} tabIndex={-1} className="margin-rule grid gap-1 pl-4">
      <h3>{added.member.name} was added</h3>
      <p>
        Give them the circle code <strong>{circleCode}</strong> and this one-time passcode:
      </p>
      <p className="text-[2rem] font-bold tracking-[0.2em]">{added.setupPasscode}</p>
      <p>They choose their own passcode the first time they sign in. This one is shown only once. All their alerts start switched off.</p>
    </div>
  );
}

/** The elder adds a caregiver or a family member, who gets a one-time passcode. */
export function AddMemberForm({ circleCode }: { circleCode: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const { run, pending, error } = useAction<Added>();
  const fields = error?.fields ?? {};
  useFocusFirstError(form, error);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const body = { name: String(data.get('name') ?? ''), email: email === '' ? null : email, role: String(data.get('role')) };
    const result = await run('/api/members', 'POST', body, `${body.name} was added to the circle.`);
    if (!result) return;
    setAdded(result);
    form.current?.reset();
    router.refresh();
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="card grid gap-6">
      <h2>Add someone</h2>
      <Field name="name" label="Their name" autoComplete="off" error={fields.name} />
      <Field name="email" label="Their email (optional)" hint="Needed only if they should get emails." type="email" autoComplete="off" error={fields.email} />
      <Field name="role" label="Their role" hint="Caregivers can change medicines and appointments. Family can only look." as="select" defaultValue="family" error={fields.role}>
        <option value="caregiver">Caregiver</option>
        <option value="family">Family</option>
      </Field>
      <FormError error={error} />
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? 'Adding…' : 'Add member'}
      </button>
      {added ? <SetupPasscode added={added} circleCode={circleCode} /> : null}
    </form>
  );
}
