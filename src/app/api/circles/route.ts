import { homePath } from '@/domain/permissions';
import { RATE_LIMITS } from '@/lib/constants';
import { createCircleSchema } from '@/lib/schemas';
import { ok, publicRoute } from '@/server/http';
import { createCircle } from '@/server/services/circles';
import { sessionCookieFor } from '@/server/services/sessions';

export const POST = publicRoute(
  { body: createCircleSchema, rateLimit: RATE_LIMITS.createCircle },
  async ({ deps, body }) => {
    const { circle, member, elderSetupPasscode } = await createCircle(deps, body);
    return ok(
      { code: circle.code, elderName: circle.elderName, elderSetupPasscode, home: homePath(member.role) },
      { 'Set-Cookie': sessionCookieFor(deps, circle, member) },
    );
  },
);
