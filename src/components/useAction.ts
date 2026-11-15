'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { APP_NAME } from '@/lib/constants';
import { useAnnounce } from './Announcer';

export interface ApiFailure {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: ApiFailure;
}

const OFFLINE: ApiFailure = {
  code: 'NETWORK',
  message: `We could not reach ${APP_NAME}. Check your connection and try again.`,
};

async function callApi<T>(path: string, method: string, body?: unknown): Promise<Envelope<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as Envelope<T>;
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/**
 * Calls the JSON API and tracks the loading and error state every async control needs.
 * `run` resolves to the data, or null after announcing the error.
 */
export function useAction<T = unknown>() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const announce = useAnnounce();

  const run = useCallback(
    async (path: string, method: string, body?: unknown, success?: string): Promise<T | null> => {
      setPending(true);
      setError(null);
      const result = await callApi<T>(path, method, body);
      setPending(false);
      if (!result.ok) {
        const failure = result.error ?? OFFLINE;
        setError(failure);
        announce(failure.message);
        return null;
      }
      if (success) announce(success);
      return result.data as T;
    },
    [announce],
  );

  return { run, pending, error };
}

/** After a failed submit, move focus to the first field that needs fixing. */
export function useFocusFirstError(form: RefObject<HTMLFormElement | null>, error: ApiFailure | null): void {
  useEffect(() => {
    if (error) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form, error]);
}
