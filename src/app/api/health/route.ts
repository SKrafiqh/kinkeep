import { ok } from '@/server/http';

/** Liveness check for the host and the submission checker. Touches no database. */
export function GET(): Response {
  return ok({ status: 'ok' });
}
