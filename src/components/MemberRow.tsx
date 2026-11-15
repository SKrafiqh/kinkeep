'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { AlertSettings } from '@/domain/types';
import { ROLE_LABELS } from '@/lib/constants';
import { DeleteButton } from './DeleteButton';
import { Field, FormError } from './Field';
import { useAction } from './useAction';

export interface MemberDetails {
  id: string;
  name: string;
  email: string | null;
  role: 'elder' | 'caregiver' | 'family';
  alerts: AlertSettings;
  mustChangePasscode: boolean;
  receivesElderReminders: boolean;
}

const ALERTS: Array<{ key: keyof AlertSettings; label: string }> = [
  { key: 'missedDose', label: 'Missed-dose alerts' },
  { key: 'appointments', label: 'Appointment reminders' },
  { key: 'weeklySummary', label: 'Weekly summary' },
];

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4">
      <span>
        {label} <span className="hint">({checked ? 'on' : 'off'})</span>
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

/** One member: the elder sets their role, their three alert switches, and can remove them. */
export function MemberRow({ member, elderName }: { member: MemberDetails; elderName: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [alerts, setAlerts] = useState(member.alerts);
  const [reminders, setReminders] = useState(member.receivesElderReminders);
  const isElder = member.role === 'elder';
  const path = `/api/members/${member.id}`;

  async function update(body: object, done: string): Promise<boolean> {
    const saved = (await run(path, 'PATCH', body, done)) !== null;
    if (saved) router.refresh();
    return saved;
  }

  async function toggleAlert(key: keyof AlertSettings, label: string, on: boolean): Promise<void> {
    const next = { ...alerts, [key]: on };
    setAlerts(next);
    if (!(await update({ alerts: next }, `${label} turned ${on ? 'on' : 'off'} for ${member.name}.`))) setAlerts(alerts);
  }

  async function toggleReminders(on: boolean): Promise<void> {
    setReminders(on);
    const done = on ? `${member.name} will now get the dose reminders.` : `${member.name} no longer gets the dose reminders.`;
    if (!(await update({ receivesElderReminders: on }, done))) setReminders(!on);
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get(`email-${member.id}`) ?? '').trim();
    await update({ email: email === '' ? null : email }, `Saved the email for ${member.name}.`);
  }

  return (
    <li className="card grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2>{member.name}</h2>
        <p className="hint">
          {ROLE_LABELS[member.role]}
          {member.mustChangePasscode ? ', has not signed in yet' : ''}
        </p>
      </div>
      <form onSubmit={saveEmail} noValidate className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field
            name={`email-${member.id}`}
            label={`Email for ${member.name}`}
            hint={member.email ? undefined : 'No email yet, so nothing can be sent to them.'}
            type="email"
            defaultValue={member.email ?? ''}
            autoComplete="off"
            error={error?.fields?.email}
          />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          Save email
        </button>
      </form>
      {isElder ? null : (
        <>
          <Field
            name={`role-${member.id}`}
            label={`Role for ${member.name}`}
            hint="Caregivers can change medicines and appointments. Family can only look."
            as="select"
            defaultValue={member.role}
            disabled={pending}
            onChange={(event) => void update({ role: event.target.value }, `${member.name} is now ${event.target.value === 'caregiver' ? 'a caregiver' : 'family'}.`)}
          >
            <option value="caregiver">Caregiver</option>
            <option value="family">Family</option>
          </Field>
          <fieldset className="grid">
            <legend className="label">What {member.name} is told by email</legend>
            {ALERTS.map(({ key, label }) => (
              <Switch key={key} label={label} checked={alerts[key]} disabled={pending} onChange={(on) => void toggleAlert(key, label, on)} />
            ))}
            <Switch label={`Gets ${elderName}’s own dose reminders`} checked={reminders} disabled={pending} onChange={(on) => void toggleReminders(on)} />
          </fieldset>
          <DeleteButton
            path={path}
            label={`Remove ${member.name}`}
            title={`Remove ${member.name} from the circle?`}
            consequence={`${member.name} will be signed out straight away and will get no more emails. You can add them again later.`}
            done={`${member.name} was removed from the circle.`}
          />
        </>
      )}
      <FormError error={error} />
    </li>
  );
}
