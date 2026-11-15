/** Structured JSON on stdout; Cloud Logging reads `severity` and `message`. Server-side only. */

type Fields = Record<string, string | number | boolean | null | undefined>;
type Severity = 'INFO' | 'WARNING' | 'ERROR';

function write(severity: Severity, message: string, fields: Fields = {}): void {
  if (process.env.LOG_LEVEL === 'silent') return;
  process.stdout.write(`${JSON.stringify({ severity, message, time: new Date().toISOString(), ...fields })}\n`);
}

// Rule: ids only. Never pass passcodes, tokens, full emails or medicine names as fields.
export const log = {
  info: (message: string, fields?: Fields): void => write('INFO', message, fields),
  warn: (message: string, fields?: Fields): void => write('WARNING', message, fields),
  error: (message: string, fields?: Fields): void => write('ERROR', message, fields),
};

/** "priya@example.com" becomes "p***@example.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain ?? ''}`;
}

/** Name and message of a thrown value, for logs only. */
export function errorFields(error: unknown): Fields {
  return error instanceof Error ? { errorName: error.name, errorMessage: error.message } : { errorMessage: String(error) };
}
