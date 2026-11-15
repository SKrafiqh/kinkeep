'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { CodeStep, PasscodeStep, WhoStep, type Person } from './JoinSteps';
import { useAction, useFocusFirstError } from './useAction';

interface Found {
  code: string;
  elderName: string;
  members: Person[];
}

/** Each step replaces the last, so move focus to the new heading for keyboard and screen-reader users. */
function useFocusOnStepChange(heading: RefObject<HTMLHeadingElement | null>, step: string): void {
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else heading.current?.focus();
  }, [heading, step]);
}

/** The join flow's state and the two calls behind it: find the circle, then sign in. */
function useJoin() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [circle, setCircle] = useState<Found | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const lookup = useAction<Omit<Found, 'code'>>();
  const signIn = useAction<{ home: string }>();
  useFocusFirstError(form, lookup.error ?? signIn.error);
  useFocusOnStepChange(heading, circle === null ? 'code' : person === null ? 'who' : 'passcode');

  async function findCircle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '')
      .trim()
      .toUpperCase();
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

  return { form, heading, circle, setCircle, person, setPerson, lookup, signIn, findCircle, enter };
}

/** Sign-in in three short steps: the circle code, your name, your passcode. */
export function JoinForm({ initialCode }: { initialCode: string }) {
  const { form, heading, circle, setCircle, person, setPerson, lookup, signIn, findCircle, enter } = useJoin();
  const refs = { formRef: form, headingRef: heading };
  if (circle === null) {
    return (
      <CodeStep
        {...refs}
        error={lookup.error}
        pending={lookup.pending}
        onSubmit={findCircle}
        initialCode={initialCode}
      />
    );
  }
  if (person === null) {
    return (
      <WhoStep
        headingRef={heading}
        elderName={circle.elderName}
        members={circle.members}
        onPick={setPerson}
        onBack={() => setCircle(null)}
      />
    );
  }
  return (
    <PasscodeStep
      {...refs}
      error={signIn.error}
      pending={signIn.pending}
      onSubmit={enter}
      name={person.name}
      onBack={() => setPerson(null)}
    />
  );
}
