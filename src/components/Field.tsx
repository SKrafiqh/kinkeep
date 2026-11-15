import type { ComponentProps, ReactNode } from 'react';
import { WarningCircleIcon } from './icons';
import type { ApiFailure } from './useAction';

type FieldProps = Omit<ComponentProps<'input'>, 'name' | 'id' | 'className'> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Which control to render. Options for a select go in `children`. */
  as?: 'input' | 'textarea' | 'select';
  children?: ReactNode;
};

/** A labelled control with its hint and error wired up for screen readers. */
export function Field({ name, label, hint, error, as = 'input', children, ...rest }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const shared = { id, name, className: 'input', 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined };
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {as === 'textarea' ? <textarea {...shared} {...(rest as ComponentProps<'textarea'>)} /> : null}
      {as === 'select' ? (
        <select {...shared} {...(rest as ComponentProps<'select'>)}>
          {children}
        </select>
      ) : null}
      {as === 'input' ? <input {...shared} {...rest} /> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <WarningCircleIcon aria-hidden weight="bold" size={22} className="mt-0.5 flex-none" />
      {message}
    </p>
  );
}

/** The message for a failed action, shown next to the button that caused it. */
export function FormError({ error }: { error: ApiFailure | null }) {
  if (!error) return null;
  return (
    <p className="field-error" role="alert">
      <WarningCircleIcon aria-hidden weight="bold" size={22} className="mt-0.5 flex-none" />
      {error.message}
    </p>
  );
}
