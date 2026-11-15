import type { z } from 'zod';
import { can, type Permission } from '@/domain/permissions';
import { AppError } from '@/lib/errors';
import { errorFields, log } from '@/lib/logger';
import { allowRequest, clientIp, type RateLimit } from './auth/rateLimit';
import { sessionTokenFrom } from './auth/session';
import type { Config } from './config';
import { getDeps, type Deps } from './deps';
import { memberForSession, type MemberContext } from './services/sessions';

type Params = Record<string, string>;
type RouteHandler = (request: Request, context: { params: Promise<Params> }) => Promise<Response>;

export interface RouteContext<Body> {
  deps: Deps;
  request: Request;
  body: Body;
  params: Params;
  now: number;
}

interface RouteOptions<Body> {
  /** Schema for the JSON body. Unknown fields are rejected by the schemas themselves. */
  body?: z.ZodType<Body>;
  rateLimit?: RateLimit;
  /** Only for server-to-server callers that authenticate another way (the scheduler). */
  skipOriginCheck?: boolean;
}

interface MemberRouteOptions<Body> extends RouteOptions<Body> {
  permission: Permission;
  /** Lets a member who still has a setup passcode through, so they can change it. */
  allowPendingPasscode?: boolean;
}

/** The one response envelope: `{ ok: true, data }`. */
export function ok(data: unknown, headers: Record<string, string> = {}): Response {
  return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store', ...headers } });
}

// The one place errors become responses. Unexpected errors are logged, never shown.
function failure(error: unknown): Response {
  const known = error instanceof AppError ? error : null;
  if (!known) log.error('request.unhandled', errorFields(error));
  const body = known
    ? { code: known.code, message: known.message, ...(known.fields ? { fields: known.fields } : {}) }
    : { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' };
  return Response.json({ ok: false, error: body }, { status: known?.status ?? 500, headers: { 'Cache-Control': 'no-store' } });
}

/** First message per field, keyed by field name, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message;
  return fields;
}

/** Validates data against a schema or throws a VALIDATION error with per-field messages. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError('VALIDATION', 'Please check the highlighted fields.', fieldErrors(result.error));
  return result.data;
}

// CSRF defence with the SameSite cookie: a browser always sends Origin on these requests.
function assertSameOrigin(request: Request, config: Config): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  const sameHost = origin !== null && URL.canParse(origin) && new URL(origin).host === request.headers.get('host');
  if (origin !== config.APP_URL && !sameHost) throw new AppError('FORBIDDEN', 'This request did not come from the app.');
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

// One bucket per route and caller. Ids in the path are replaced, so every appointment's
// brief shares one bucket and a caller cannot mint fresh buckets by varying the id.
function limitKey(request: Request, params: Params): string {
  const ids = Object.values(params);
  const route = new URL(request.url).pathname.split('/').map((segment) => (ids.includes(segment) ? ':id' : segment)).join('/');
  return `${request.method} ${route} ${clientIp(request)}`;
}

async function readBody<Body>(request: Request, schema: z.ZodType<Body>): Promise<Body> {
  const json: unknown = await request.json().catch(() => {
    throw new AppError('VALIDATION', 'The request was not valid JSON.');
  });
  return parse(schema, json);
}

function createRoute<Body>(options: RouteOptions<Body>, handle: (context: RouteContext<Body>) => Promise<unknown>): RouteHandler {
  return async (request, context) => {
    try {
      const deps = getDeps();
      const now = deps.clock.now();
      if (!options.skipOriginCheck) assertSameOrigin(request, deps.config);
      // Next.js passes no params object at all to a route without dynamic segments.
      const params = (await context.params) ?? {};
      if (Object.values(params).some((value) => !ID_PATTERN.test(value))) throw new AppError('NOT_FOUND', 'We could not find that.');
      if (options.rateLimit && !allowRequest(limitKey(request, params), options.rateLimit, now)) {
        throw new AppError('RATE_LIMITED', 'That was a lot of tries. Please wait a minute and try again.');
      }
      const body = options.body ? await readBody(request, options.body) : (undefined as Body);
      const result = await handle({ deps, request, body, params, now });
      return result instanceof Response ? result : ok(result);
    } catch (error) {
      return failure(error);
    }
  };
}

/** A route anyone may call. Give every one a rate limit. */
export function publicRoute<Body = undefined>(options: RouteOptions<Body>, handle: (context: RouteContext<Body>) => Promise<unknown>): RouteHandler {
  return createRoute(options, handle);
}

/** A route for signed-in members. Membership and role are re-read from the database on every call. */
export function memberRoute<Body = undefined>(
  options: MemberRouteOptions<Body>,
  handle: (context: RouteContext<Body> & MemberContext) => Promise<unknown>,
): RouteHandler {
  return createRoute(options, async (context) => {
    const token = sessionTokenFrom(context.request.headers.get('cookie'));
    const who = await memberForSession(context.deps, token, context.now);
    if (!who) throw new AppError('UNAUTHENTICATED', 'Please sign in to continue.');
    if (who.member.mustChangePasscode && !options.allowPendingPasscode) {
      throw new AppError('PASSCODE_CHANGE_REQUIRED', 'Choose your own passcode before you continue.');
    }
    if (!can(who.member.role, options.permission)) {
      throw new AppError('FORBIDDEN', `Your role cannot do that. Ask ${who.circle.elderName} if you need this changed.`);
    }
    return handle({ ...context, ...who });
  });
}
