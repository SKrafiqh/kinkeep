import { POST as createCircleRoute } from '@/app/api/circles/route';
import { resetRateLimits } from '@/server/auth/rateLimit';
import { parseConfig } from '@/server/config';
import { setDeps, type Deps } from '@/server/deps';
import type { EmailMessage } from '@/server/email/sender';
import { createMemoryStore } from '@/server/repos/memoryStore';

export const ORIGIN = 'http://localhost:3000';
export const CRON_SECRET = 'test-cron-secret-0123456789';
export const SCHEDULER = 'scheduler@test.iam.gserviceaccount.com';
/** Mon 16 Nov 2026, 08:30 in Asia/Kolkata. */
export const START = Date.UTC(2026, 10, 16, 3, 0);

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface World {
  deps: Deps;
  /** Set `now` to move time. */
  time: { now: number };
  /** Every email "sent", in order. */
  emails: EmailMessage[];
  /** Flip to make the mail server fail. */
  mail: { failing: boolean };
  /** What the fake Gemini returns; `calls` counts requests. */
  ai: { reply: unknown; failing: boolean; calls: number };
}

/** Fresh in-memory dependencies, installed as the app's dependencies. Call in beforeEach. */
export function createWorld(options: { withAi?: boolean } = {}): World {
  resetRateLimits();
  const time = { now: START };
  const emails: EmailMessage[] = [];
  const mail = { failing: false };
  const ai = { reply: {} as unknown, failing: false, calls: 0 };
  const deps: Deps = {
    config: parseConfig({ NODE_ENV: 'test', APP_URL: ORIGIN, CRON_SECRET, CRON_SERVICE_ACCOUNT: SCHEDULER }),
    store: createMemoryStore(),
    clock: { now: () => time.now },
    email: {
      async send(message) {
        if (mail.failing) throw new Error('mail server unavailable');
        emails.push(message);
      },
    },
    ai:
      options.withAi === false
        ? null
        : {
            async generateJson() {
              ai.calls += 1;
              if (ai.failing) throw new Error('model unavailable');
              return ai.reply;
            },
          },
    oidc: { verify: async (token, audience) => (token === 'good-oidc' && audience === ORIGIN ? { email: SCHEDULER, emailVerified: true } : null) },
  };
  setDeps(deps);
  return { deps, time, emails, mail, ai };
}

export interface CallOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  /** Pass null to send no Origin header. */
  origin?: string | null;
  params?: Record<string, string>;
  query?: string;
  headers?: Record<string, string>;
  ip?: string;
}

export interface CallResult {
  status: number;
  // Test code reads arbitrary response fields; a loose type keeps assertions short.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { code: string; message: string; fields?: Record<string, string> } | undefined;
  /** The session cookie set by the response, ready to pass as `cookie`. */
  cookie: string | undefined;
}

// Each handler gets its own URL path, as it has in the app, so rate limits are counted per route.
const routePaths = new Map<Handler, string>();
function pathOf(handler: Handler): string {
  const path = routePaths.get(handler) ?? `/api/route-${routePaths.size + 1}`;
  routePaths.set(handler, path);
  return path;
}

/** Calls a route handler the way Next.js would and unwraps the response envelope. */
export async function call(handler: Handler, options: CallOptions = {}): Promise<CallResult> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers = new Headers({ host: 'localhost:3000', 'x-forwarded-for': options.ip ?? '203.0.113.7', ...options.headers });
  if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  const request = new Request(`${ORIGIN}${pathOf(handler)}${options.query ?? ''}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
  });
  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const json = (await response.json()) as { data?: unknown; error?: CallResult['error'] };
  return {
    status: response.status,
    data: json.data,
    error: json.error,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

export const CIRCLE_INPUT = {
  elderName: 'Mr Rao',
  timeZone: 'Asia/Kolkata',
  name: 'Mr Rao',
  email: 'rao@example.com',
  role: 'elder',
  passcode: '246810',
};

/** Creates a circle through the API. Returns the creator's session cookie and the circle code. */
export async function createCircle(overrides: Partial<typeof CIRCLE_INPUT> = {}): Promise<{ cookie: string; code: string; data: CallResult['data'] }> {
  const result = await call(createCircleRoute, { body: { ...CIRCLE_INPUT, ...overrides } });
  if (result.status !== 200 || !result.cookie) throw new Error(`createCircle failed: ${JSON.stringify(result.error)}`);
  return { cookie: result.cookie, code: result.data.code, data: result.data };
}

export const MEDICINE_INPUT = {
  name: 'Metformin',
  strength: '500 mg',
  form: 'Tablet',
  instructions: 'After food',
  times: ['09:00', '20:00'],
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-01',
  endDate: null,
  active: true,
};
