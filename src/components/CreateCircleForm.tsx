'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { Role } from '@/domain/types';
import { Field, FormError } from './Field';
import { PasscodeInput } from './PasscodeInput';
import { useAction, useFocusFirstError } from './useAction';

interface Created {
  code: string;
  elderName: string;
  elderSetupPasscode: string | null;
  home: string;
}

const ROLES: Array<{ value: Role; label: string }> = [
  { value: 'elder', label: 'I am the person receiving care' },
  { value: 'caregiver', label: 'I look after them day to day' },
  { value: 'family', label: 'I am family and want to stay informed' },
];

const FALLBACK_ZONE = 'Asia/Kolkata';
const subscribeToNothing = (): (() => void) => () => undefined;
const browserZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

function CircleReady({ created }: { created: Created }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="card grid gap-4">
      <h2 ref={heading} tabIndex={-1}>
        Your circle is ready
      </h2>
      <p>Write this down. Everyone needs the circle code to join.</p>
      <p>
        <span className="label">Circle code</span>
        <span className="text-[2rem] font-bold tracking-[0.2em]">{created.code}</span>
      </p>
      {created.elderSetupPasscode ? (
        <p className="margin-rule pl-4">
          <span className="label">One-time passcode for {created.elderName}</span>
          <span className="text-[2rem] font-bold tracking-[0.2em]">{created.elderSetupPasscode}</span>
          <span className="block">
            {created.elderName} uses it to sign in the first time and then chooses their own. It is shown only once.
            Until they sign in, their reminders come to your email.
          </span>
        </p>
      ) : null}
      <Link href={created.home} className="btn btn-primary justify-self-start">
        Continue
      </Link>
    </section>
  );
}

function RoleChoice({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="label mb-2">Who are you?</legend>
      {ROLES.map((option) => (
        <label key={option.value} className="flex min-h-12 items-center gap-3">
          <input
            type="radio"
            name="role"
            className="size-6"
            value={option.value}
            checked={role === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}

function TimeZoneField({ timeZones, error }: { timeZones: string[]; error?: string }) {
  const localZone = useSyncExternalStore(subscribeToNothing, browserZone, () => FALLBACK_ZONE);
  return (
    <Field
      key={localZone}
      name="timeZone"
      label="Time zone"
      hint="Reminder times follow this zone."
      as="select"
      defaultValue={timeZones.includes(localZone) ? localZone : FALLBACK_ZONE}
      error={error}
    >
      {timeZones.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replaceAll('_', ' ')}
        </option>
      ))}
    </Field>
  );
}

function toRequestBody(data: FormData, role: Role) {
  const text = (name: string): string => String(data.get(name) ?? '');
  const elderName = text('elderName');
  return {
    elderName,
    timeZone: text('timeZone'),
    name: role === 'elder' ? elderName : text('name'),
    email: text('email'),
    role,
    passcode: text('passcode'),
  };
}

function CircleFields({
  role,
  fields,
  timeZones,
}: {
  role: Role;
  fields: Record<string, string>;
  timeZones: string[];
}) {
  return (
    <>
      <Field
        name="elderName"
        label={role === 'elder' ? 'Your name' : 'Name of the person receiving care'}
        hint="As the family says it, for example Mr Rao or Grandma Lakshmi."
        autoComplete="off"
        error={fields.elderName}
      />
      {role === 'elder' ? null : <Field name="name" label="Your name" autoComplete="name" error={fields.name} />}
      <Field
        name="email"
        label="Your email"
        hint="Reminders and alerts are sent here."
        type="email"
        autoComplete="email"
        error={fields.email}
      />
      <TimeZoneField timeZones={timeZones} error={fields.timeZone} />
      <PasscodeInput
        name="passcode"
        label="Choose a 6-digit passcode"
        hint="You will use it every time you sign in."
        error={fields.passcode}
      />
    </>
  );
}

/** Creates a circle. A relative can set it up; the elder still gets their own passcode. */
export function CreateCircleForm({ timeZones }: { timeZones: string[] }) {
  const form = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<Role>('caregiver');
  const [created, setCreated] = useState<Created | null>(null);
  const { run, pending, error } = useAction<Created>();
  useFocusFirstError(form, error);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await run(
      '/api/circles',
      'POST',
      toRequestBody(new FormData(event.currentTarget), role),
      'Your circle is ready.',
    );
    if (result) setCreated(result);
  }

  if (created) return <CircleReady created={created} />;

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-6">
      <RoleChoice role={role} onChange={setRole} />
      <CircleFields role={role} fields={error?.fields ?? {}} timeZones={timeZones} />
      <FormError error={error} />
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? 'Creating your circle…' : 'Create the circle'}
      </button>
    </form>
  );
}
