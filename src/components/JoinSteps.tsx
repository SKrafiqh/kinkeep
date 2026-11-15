'use client';

import type { FormEvent, RefObject } from 'react';
import { Field, FormError } from './Field';
import { PasscodeInput } from './PasscodeInput';
import type { ApiFailure } from './useAction';

export interface Person {
  id: string;
  name: string;
}

interface StepProps {
  formRef: RefObject<HTMLFormElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  error: ApiFailure | null;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Step one: type the circle code. */
export function CodeStep({
  formRef,
  headingRef,
  error,
  pending,
  onSubmit,
  initialCode,
}: StepProps & { initialCode: string }) {
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      <h2 ref={headingRef} tabIndex={-1}>
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
        error={error?.fields?.code ?? (error ? error.message : undefined)}
      />
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? 'Looking for your circle…' : 'Continue'}
      </button>
    </form>
  );
}

interface WhoStepProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  elderName: string;
  members: Person[];
  onPick: (person: Person) => void;
  onBack: () => void;
}

/** Step two: pick your own name from the circle. */
export function WhoStep({ headingRef, elderName, members, onPick, onBack }: WhoStepProps) {
  return (
    <div className="grid gap-6">
      <h2 ref={headingRef} tabIndex={-1}>
        {elderName}’s circle. Who are you?
      </h2>
      <ul className="grid gap-3">
        {members.map((member) => (
          <li key={member.id}>
            <button type="button" className="btn btn-secondary w-full justify-start" onClick={() => onPick(member)}>
              {member.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-quiet justify-self-start" onClick={onBack}>
        Use a different code
      </button>
    </div>
  );
}

/** Step three: enter your passcode. */
export function PasscodeStep({
  formRef,
  headingRef,
  error,
  pending,
  onSubmit,
  name,
  onBack,
}: StepProps & { name: string; onBack: () => void }) {
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      <h2 ref={headingRef} tabIndex={-1}>
        Hello {name}. Enter your passcode
      </h2>
      <PasscodeInput name="passcode" label="Your 6-digit passcode" error={error?.fields?.passcode} />
      <FormError error={error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          I am someone else
        </button>
      </div>
    </form>
  );
}
