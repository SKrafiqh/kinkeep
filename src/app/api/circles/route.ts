import { homePath } from '@/domain/permissions';
import { MINUTE_MS } from '@/lib/constants';
import { createCircleSchema } from '@/lib/schemas';
import { ok, publicRoute } from '@/server/http';
import { createCircle } from '@/server/services/circles';
import { sessionCookieFor } from '@/server/services/sessions';

export const POST = publicRoute(
  { body: createCircleSchema, rateLimit: { limit: 5, windowMs: 10 * MINUTE_MS } },
  async ({ deps, body }) => {
    const { circle, member, elderSetupPasscode } = await createCircle(deps, body);
    return ok(
      { code: circle.code, elderName: circle.elderName, elderSetupPasscode, home: homePath(member.role) },
      { 'Set-Cookie': sessionCookieFor(deps, circle, member) },
    );
  },
);
