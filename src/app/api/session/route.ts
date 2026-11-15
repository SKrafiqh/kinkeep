import { homePath } from '@/domain/permissions';
import { MINUTE_MS } from '@/lib/constants';
import { signInSchema } from '@/lib/schemas';
import { clearSession } from '@/server/auth/session';
import { ok, publicRoute } from '@/server/http';
import { signIn } from '@/server/services/sessions';

// The per-member lockout in the database is the real limit; this one slows a single address.
export const POST = publicRoute(
  { body: signInSchema, rateLimit: { limit: 20, windowMs: 10 * MINUTE_MS } },
  async ({ deps, body }) => {
    const { cookie, member } = await signIn(deps, body);
    return ok({ home: member.mustChangePasscode ? '/passcode' : homePath(member.role) }, { 'Set-Cookie': cookie });
  },
);

export const DELETE = publicRoute({}, async ({ deps }) => ok({ signedOut: true }, { 'Set-Cookie': clearSession(deps.config) }));
