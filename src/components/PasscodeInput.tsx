'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { PASSCODE_LENGTH } from '@/lib/constants';
import { FieldError } from './Field';

interface Props {
  name: string;
  label: string;
  hint?: string;
  error?: string;
}

const EMPTY = Array.from({ length: PASSCODE_LENGTH }, () => '');

/** Six boxes for a six-digit passcode: numeric keypad, paste and backspace all work as people expect. */
export function PasscodeInput({ name, label, hint, error }: Props) {
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [visible, setVisible] = useState(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

  function fill(from: number, text: string): void {
    const typed = text.replace(/\D/g, '').slice(0, PASSCODE_LENGTH - from);
    if (typed === '') return;
    setDigits(digits.map((digit, index) => typed[index - from] ?? digit));
    boxes.current[Math.min(from + typed.length, PASSCODE_LENGTH - 1)]?.focus();
  }

  function onChange(index: number, value: string): void {
    if (value === '') setDigits(digits.map((digit, i) => (i === index ? '' : digit)));
    else fill(index, value.slice(-1));
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      setDigits(digits.map((digit, i) => (i === index - 1 ? '' : digit)));
      boxes.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft') boxes.current[index - 1]?.focus();
    if (event.key === 'ArrowRight') boxes.current[index + 1]?.focus();
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    fill(index, event.clipboardData.getData('text'));
  }

  return (
    <fieldset className="grid gap-2" aria-describedby={describedBy}>
      <legend className="label mb-2">{label}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      <div className="flex max-w-sm gap-1.5">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            className="passcode-box"
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label={`${label}, digit ${index + 1} of ${PASSCODE_LENGTH}`}
            aria-invalid={error ? true : undefined}
            value={digit}
            onChange={(event) => onChange(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={digits.join('')} />
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="size-6" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
        Show the digits
      </label>
      <FieldError id={`${id}-error`} message={error} />
    </fieldset>
  );
}
