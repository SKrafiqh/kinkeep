'use client';

import { useRouter } from 'next/navigation';
import { useRef, type FormEvent } from 'react';
import { Field, FormError } from './Field';
import { useAction, useFocusFirstError } from './useAction';

export interface AppointmentValues {
  id: string;
  doctor: string;
  speciality: string;
  place: string;
  /** Local to the circle's time zone. */
  date: string;
  time: string;
  notes: string;
}

function AppointmentFields({
  appointment,
  fields,
}: {
  appointment?: AppointmentValues;
  fields: Record<string, string>;
}) {
  return (
    <>
      <Field name="doctor" label="Doctor" defaultValue={appointment?.doctor} autoComplete="off" error={fields.doctor} />
      <Field
        name="speciality"
        label="Speciality (optional)"
        hint="For example: heart, eyes, diabetes."
        defaultValue={appointment?.speciality}
        autoComplete="off"
        error={fields.speciality}
      />
      <Field
        name="place"
        label="Place (optional)"
        defaultValue={appointment?.place}
        autoComplete="off"
        error={fields.place}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field name="date" label="Date" type="date" defaultValue={appointment?.date} error={fields.date} />
        <Field name="time" label="Time" type="time" defaultValue={appointment?.time} error={fields.time} />
      </div>
      <Field
        name="notes"
        label="Notes for this visit (optional)"
        hint="Anything to mention to the doctor."
        as="textarea"
        defaultValue={appointment?.notes}
        error={fields.notes}
      />
    </>
  );
}

/** Add or edit a doctor visit. Reminders go out 24 hours and 2 hours before. */
export function AppointmentForm({ appointment }: { appointment?: AppointmentValues }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { run, pending, error } = useAction();
  useFocusFirstError(form, error);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ['doctor', 'speciality', 'place', 'date', 'time', 'notes'].map((name) => [name, String(data.get(name) ?? '')]),
    );
    const done = 'Saved. Reminders will go out 24 hours and 2 hours before.';
    const saved = appointment
      ? await run(`/api/appointments/${appointment.id}`, 'PATCH', body, done)
      : await run('/api/appointments', 'POST', body, done);
    if (saved === null) return;
    router.push('/appointments');
    router.refresh();
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-6">
      <AppointmentFields appointment={appointment} fields={error?.fields ?? {}} />
      <FormError error={error} />
      <button type="submit" className="btn btn-primary justify-self-start" disabled={pending}>
        {pending ? 'Saving…' : 'Save appointment'}
      </button>
    </form>
  );
}
