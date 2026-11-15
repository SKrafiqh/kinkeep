'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { BriefContent, VisitBrief } from '@/domain/types';
import { AI_DISCLAIMER, BRIEF_DISCLAIMER } from '@/lib/constants';
import { Field, FormError } from './Field';
import { PrinterIcon } from './icons';
import { useAction, useFocusFirstError } from './useAction';

const LISTS: Array<{ key: 'patterns' | 'changes' | 'questions'; title: string }> = [
  { key: 'patterns', title: 'Missed-dose patterns' },
  { key: 'changes', title: 'Medicine changes' },
  { key: 'questions', title: 'Questions to ask the doctor or pharmacist' },
];

const toLines = (text: string): string[] => text.split('\n').map((line) => line.trim()).filter((line) => line !== '');

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

interface Props {
  appointmentId: string;
  initial: VisitBrief | null;
  canEdit: boolean;
}

/** The visit brief: prepare it, read it, correct it, print it. A person always has the last word. */
export function BriefPanel({ appointmentId, initial, canEdit }: Props) {
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
    const data = new FormData(event.currentTarget);
    const content: BriefContent = {
      summary: String(data.get('summary') ?? ''),
      patterns: toLines(String(data.get('patterns') ?? '')),
      changes: toLines(String(data.get('changes') ?? '')),
      questions: toLines(String(data.get('questions') ?? '')),
    };
    const next = await run(path, 'PUT', content, 'Saved your changes to the brief.');
    if (!next) return;
    setBrief(next);
    setEditing(false);
  }

  if (brief && editing) {
    return (
      <form ref={form} onSubmit={save} noValidate className="grid gap-6">
        <Field name="summary" label="Summary" as="textarea" defaultValue={brief.content.summary} error={error?.fields?.summary} />
        {LISTS.map(({ key, title }) => (
          <Field key={key} name={key} label={title} hint="One per line." as="textarea" defaultValue={brief.content[key].join('\n')} error={error?.fields?.[key]} />
        ))}
        <FormError error={error} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
            Discard changes
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-6">
      {brief ? (
        <BriefView brief={brief} />
      ) : (
        <p className="text-muted">
          The brief gathers what happened since the last visit: doses taken and missed, medicine changes, and questions worth asking. You can
          correct it before you print it.
        </p>
      )}
      <FormError error={error} />
      <div className="no-print flex flex-wrap gap-3">
        {brief ? (
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <PrinterIcon aria-hidden weight="bold" size={22} />
            Print
          </button>
        ) : null}
        <button type="button" className={`btn ${brief ? 'btn-secondary' : 'btn-primary'}`} disabled={pending} onClick={prepare}>
          {pending ? 'Preparing the brief…' : brief ? 'Prepare it again' : 'Prepare the visit brief'}
        </button>
        {brief && canEdit ? (
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            Edit the brief
          </button>
        ) : null}
      </div>
    </div>
  );
}
