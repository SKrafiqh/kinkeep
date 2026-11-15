'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import type { BriefContent, VisitBrief } from '@/domain/types';
import { AI_DISCLAIMER, BRIEF_DISCLAIMER } from '@/lib/constants';
import { Field, FormError } from './Field';
import { PrinterIcon } from './icons';
import { useAction, useFocusFirstError, type ApiFailure } from './useAction';

const LISTS: Array<{ key: 'patterns' | 'changes' | 'questions'; title: string }> = [
  { key: 'patterns', title: 'Missed-dose patterns' },
  { key: 'changes', title: 'Medicine changes' },
  { key: 'questions', title: 'Questions to ask the doctor or pharmacist' },
];

const toLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function BriefView({ brief }: { brief: VisitBrief }) {
  return (
    <div className="grid gap-5">
      <p>{brief.content.summary}</p>
      {LISTS.map(({ key, title }) => (
        <section key={key} className="grid gap-2">
          <h3>{title}</h3>
          <ul className="grid list-disc gap-1 pl-6">
            {brief.content[key].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="margin-rule pl-4 font-bold">
        {brief.source === 'ai' ? AI_DISCLAIMER : BRIEF_DISCLAIMER}
        {brief.editedBy ? ` Edited by ${brief.editedBy}.` : ''}
      </p>
    </div>
  );
}

function toContent(data: FormData): BriefContent {
  return {
    summary: String(data.get('summary') ?? ''),
    patterns: toLines(String(data.get('patterns') ?? '')),
    changes: toLines(String(data.get('changes') ?? '')),
    questions: toLines(String(data.get('questions') ?? '')),
  };
}

interface EditProps {
  formRef: RefObject<HTMLFormElement | null>;
  brief: VisitBrief;
  error: ApiFailure | null;
  pending: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDiscard: () => void;
}

function BriefEditForm({ formRef, brief, error, pending, onSave, onDiscard }: EditProps) {
  return (
    <form ref={formRef} onSubmit={onSave} noValidate className="grid gap-6">
      <Field
        name="summary"
        label="Summary"
        as="textarea"
        defaultValue={brief.content.summary}
        error={error?.fields?.summary}
      />
      {LISTS.map(({ key, title }) => (
        <Field
          key={key}
          name={key}
          label={title}
          hint="One per line."
          as="textarea"
          defaultValue={brief.content[key].join('\n')}
          error={error?.fields?.[key]}
        />
      ))}
      <FormError error={error} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onDiscard}>
          Discard changes
        </button>
      </div>
    </form>
  );
}

interface ActionsProps {
  hasBrief: boolean;
  canEdit: boolean;
  pending: boolean;
  onPrepare: () => void;
  onEdit: () => void;
}

function BriefActions({ hasBrief, canEdit, pending, onPrepare, onEdit }: ActionsProps) {
  const prepareLabel = hasBrief ? 'Prepare it again' : 'Prepare the visit brief';
  return (
    <div className="no-print flex flex-wrap gap-3">
      {hasBrief ? (
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <PrinterIcon aria-hidden weight="bold" size={22} />
          Print
        </button>
      ) : null}
      <button
        type="button"
        className={`btn ${hasBrief ? 'btn-secondary' : 'btn-primary'}`}
        disabled={pending}
        onClick={onPrepare}
      >
        {pending ? 'Preparing the brief…' : prepareLabel}
      </button>
      {hasBrief && canEdit ? (
        <button type="button" className="btn btn-quiet" onClick={onEdit}>
          Edit the brief
        </button>
      ) : null}
    </div>
  );
}

interface Props {
  appointmentId: string;
  initial: VisitBrief | null;
  canEdit: boolean;
}

/** The brief's state and the two calls that change it: prepare a new one, save corrections. */
function useBrief(appointmentId: string, initial: VisitBrief | null) {
  const form = useRef<HTMLFormElement>(null);
  const [brief, setBrief] = useState(initial);
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useAction<VisitBrief>();
  const path = `/api/appointments/${appointmentId}/brief`;
  useFocusFirstError(form, error);

  async function prepare(): Promise<void> {
    const next = await run(path, 'POST', undefined, 'The visit brief is ready.');
    if (next) setBrief(next);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const next = await run(
      path,
      'PUT',
      toContent(new FormData(event.currentTarget)),
      'Saved your changes to the brief.',
    );
    if (!next) return;
    setBrief(next);
    setEditing(false);
  }

  return { form, brief, editing, setEditing, pending, error, prepare, save };
}

/** The visit brief: prepare it, read it, correct it, print it. A person always has the last word. */
export function BriefPanel({ appointmentId, initial, canEdit }: Props) {
  const { form, brief, editing, setEditing, pending, error, prepare, save } = useBrief(appointmentId, initial);

  if (brief && editing) {
    return (
      <BriefEditForm
        formRef={form}
        brief={brief}
        error={error}
        pending={pending}
        onSave={save}
        onDiscard={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid gap-6">
      {brief ? (
        <BriefView brief={brief} />
      ) : (
        <p className="text-muted">
          The brief gathers what happened since the last visit: doses taken and missed, medicine changes, and questions
          worth asking. You can correct it before you print it.
        </p>
      )}
      <FormError error={error} />
      <BriefActions
        hasBrief={brief !== null}
        canEdit={canEdit}
        pending={pending}
        onPrepare={prepare}
        onEdit={() => setEditing(true)}
      />
    </div>
  );
}
