'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Field, FormError } from './Field';
import { PasscodeInput } from './PasscodeInput';
import { useAction, useFocusFirstError } from './useAction';

interface Person {
  id: string;
  name: string;
}

interface Found {
  code: string;
  elderName: string;
  members: Person[];
}

/** Sign-in in three short steps: the circle code, your name, your passcode. */
export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [circle, setCircle] = useState<Found | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const lookup = useAction<Omit<Found, 'code'>>();
  const signIn = useAction<{ home: string }>();
  const step = circle === null ? 'code' : person === null ? 'who' : 'passcode';
  useFocusFirstError(form, lookup.error ?? signIn.error);

  // Each step replaces the last, so move focus to the new heading for keyboard and screen-reader users.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else heading.current?.focus();
  }, [step]);

  async function findCircle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim().toUpperCase();
    const found = await lookup.run(`/api/circles/lookup?code=${encodeURIComponent(code)}`, 'GET');
    if (found) setCircle({ code, ...found });
  }

  async function enter(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!circle || !person) return;
    const passcode = String(new FormData(event.currentTarget).get('passcode') ?? '');
    const session = await signIn.run('/api/session', 'POST', { code: circle.code, memberId: person.id, passcode });
    if (!session) return;
    router.push(session.home);
    router.refresh();
  }

  if (step === 'code') {
    return (
      <form ref={form} onSubmit={findCircle} noValidate className="grid gap-6">
        <h2 ref={heading} tabIndex={-1}>
          Enter your circle code
        </h2>
        <Field
          name="code"
          label="Circle code"
          hint="Six letters and numbers. The person who set up the circle has it."
          defaultValue={initialCode}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          error={lookup.error?.fields?.code ?? (lookup.error ? lookup.error.message : undefined)}
        />
        <button type="submit" className="btn btn-primary justify-self-start" disabled={lookup.pending}>
          {lookup.pending ? 'Looking for your circle…' : 'Continue'}
        </button>
      </form>
    );
  }

  if (step === 'who' && circle) {
    return (
      <div className="grid gap-6">
        <h2 ref={heading} tabIndex={-1}>
          {circle.elderName}’s circle. Who are you?
        </h2>
        <ul className="grid gap-3">
          {circle.members.map((member) => (
            <li key={member.id}>
              <button type="button" className="btn btn-secondary w-full justify-start" onClick={() => setPerson(member)}>
                {member.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-quiet justify-self-start" onClick={() => setCircle(null)}>
          Use a different code
        </button>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={enter} noValidate className="grid gap-6">
      <h2 ref={heading} tabIndex={-1}>
        Hello {person?.name}. Enter your passcode
      </h2>
      <PasscodeInput name="passcode" label="Your 6-digit passcode" error={signIn.error?.fields?.passcode} />
      <FormError error={signIn.error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={signIn.pending}>
          {signIn.pending ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setPerson(null)}>
          I am someone else
        </button>
      </div>
    </form>
  );
}
