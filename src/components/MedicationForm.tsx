'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { formatTimes } from '@/domain/activity';
import { formatClock } from '@/domain/time';
import type { Medication } from '@/domain/types';
import { DAY_NAMES, MEDICINE_FORMS } from '@/lib/constants';
import { Field, FieldError, FormError } from './Field';
import { CheckIcon, XIcon } from './icons';
import { useAction, useFocusFirstError } from './useAction';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

interface NewTimeProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onAdd: () => void;
}

function NewTimeRow({ value, error, onChange, onAdd }: NewTimeProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-2">
        <label htmlFor="f-newTime" className="label">
          Time to add
        </label>
        <input
          id="f-newTime"
          type="time"
          className="input w-44"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'f-times-error' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <button type="button" className="btn btn-secondary" onClick={onAdd}>
        Add this time
      </button>
    </div>
  );
}

function TimeChips({
  times,
  onChange,
  error,
}: {
  times: string[];
  onChange: (times: string[]) => void;
  error?: string;
}) {
  const [next, setNext] = useState('08:00');
  const add = (): void => onChange(times.includes(next) || next === '' ? times : [...times, next].sort());
  return (
    <fieldset className="grid gap-3">
      <legend className="label mb-2">Times of day</legend>
      {times.length === 0 ? <p className="hint">No times yet. Add at least one.</p> : null}
      <ul className="flex flex-wrap gap-2">
        {times.map((time) => (
          <li
            key={time}
            className="flex items-center gap-1 rounded-btn border-2 border-primary bg-surface pl-4 font-bold"
          >
            {formatClock(time)}
            <button
              type="button"
              className="btn btn-quiet px-3"
              aria-label={`Remove ${formatClock(time)}`}
              onClick={() => onChange(times.filter((t) => t !== time))}
            >
              <XIcon aria-hidden weight="bold" size={20} />
            </button>
          </li>
        ))}
      </ul>
      <NewTimeRow value={next} error={error} onChange={setNext} onAdd={add} />
      <FieldError id="f-times-error" message={error} />
    </fieldset>
  );
}

function DayChips({ selected, error }: { selected: number[]; error?: string }) {
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? 'f-days-error' : undefined}>
      <legend className="label mb-2">Days</legend>
      <div className="flex flex-wrap gap-2">
        {DAY_NAMES.map((day, index) => (
          <label key={day} className="chip">
            <input
              type="checkbox"
              name="day"
              value={index}
              defaultChecked={selected.includes(index)}
              className="sr-only"
            />
            <CheckIcon aria-hidden weight="bold" size={20} />
            {day}
          </label>
        ))}
      </div>
      <FieldError id="f-days-error" message={error} />
    </fieldset>
  );
}

type Values = Pick<Medication, 'name' | 'strength' | 'form' | 'instructions' | 'daysOfWeek' | 'startDate'> & {
  endDate: string;
};

function initialValues(medication: Medication | undefined, today: string): Values {
  if (!medication) {
    return {
      name: '',
      strength: '',
      form: MEDICINE_FORMS[0],
      instructions: '',
      daysOfWeek: EVERY_DAY,
      startDate: today,
      endDate: '',
    };
  }
  return { ...medication, endDate: medication.endDate ?? '' };
}

/** Turns the submitted form into the request body the medications API expects. */
function toRequestBody(data: FormData, times: string[], active: boolean) {
  const text = (name: string): string => String(data.get(name) ?? '');
  return {
    name: text('name'),
    strength: text('strength'),
    form: text('form'),
    instructions: text('instructions'),
    times,
    daysOfWeek: data.getAll('day').map(Number),
    startDate: text('startDate'),
    endDate: text('endDate') || null,
    active,
  };
}

function savedMessage(name: string, times: string[], active: boolean): string {
  return active
    ? `Saved. Reminders for ${name} are set for ${formatTimes(times)}.`
    : `Paused. No reminders will go out for ${name}.`;
}

interface FieldsProps {
  values: Values;
  fields: Record<string, string>;
  times: string[];
  onTimesChange: (times: string[]) => void;
}

function MedicationFields({ values, fields, times, onTimesChange }: FieldsProps) {
  return (
    <>
      <Field name="name" label="Medicine name" defaultValue={values.name} autoComplete="off" error={fields.name} />
      <Field
        name="strength"
        label="Strength"
        hint="As printed on the pack, for example 500 mg."
        defaultValue={values.strength}
        autoComplete="off"
        error={fields.strength}
      />
      <Field name="form" label="Form" as="select" defaultValue={values.form} error={fields.form}>
        {MEDICINE_FORMS.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </Field>
      <Field
        name="instructions"
        label="Instructions (optional)"
        hint="For example: after food."
        defaultValue={values.instructions}
        autoComplete="off"
        error={fields.instructions}
      />
      <TimeChips times={times} onChange={onTimesChange} error={fields.times} />
      <DayChips selected={values.daysOfWeek} error={fields.daysOfWeek} />
      <Field name="startDate" label="Start date" type="date" defaultValue={values.startDate} error={fields.startDate} />
      <Field
        name="endDate"
        label="End date (optional)"
        hint="Leave empty if this medicine is ongoing."
        type="date"
        defaultValue={values.endDate}
        error={fields.endDate}
      />
    </>
  );
}

function MedicationButtons({
  medication,
  pending,
  onPause,
}: {
  medication?: Medication;
  pending: boolean;
  onPause: () => void;
}) {
  const resumes = medication !== undefined && !medication.active;
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving…' : resumes ? 'Save and resume' : 'Save medicine'}
      </button>
      {medication?.active ? (
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={onPause}>
          Pause this medicine
        </button>
      ) : null}
    </div>
  );
}

/** Add or edit a medicine. Saving an edit rebuilds only future, unconfirmed doses. */
export function MedicationForm({ medication, today }: { medication?: Medication; today: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [times, setTimes] = useState<string[]>(medication?.times ?? []);
  const { run, pending, error } = useAction<Medication>();
  useFocusFirstError(form, error);

  async function save(active: boolean): Promise<void> {
    if (!form.current) return;
    const body = toRequestBody(new FormData(form.current), times, active);
    const path = medication ? `/api/medications/${medication.id}` : '/api/medications';
    const saved = await run(path, medication ? 'PATCH' : 'POST', body, savedMessage(body.name, times, active));
    if (!saved) return;
    router.push('/medications');
    router.refresh();
  }

  return (
    <form
      ref={form}
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(true);
      }}
    >
      <MedicationFields
        values={initialValues(medication, today)}
        fields={error?.fields ?? {}}
        times={times}
        onTimesChange={setTimes}
      />
      <FormError error={error} />
      <MedicationButtons medication={medication} pending={pending} onPause={() => void save(false)} />
    </form>
  );
}
