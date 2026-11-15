import { homePath } from '@/domain/permissions';
import { RATE_LIMITS } from '@/lib/constants';
import { demoSchema } from '@/lib/schemas';
import { ok, publicRoute } from '@/server/http';
import { seedDemoCircle } from '@/server/services/demo';
import { sessionCookieFor } from '@/server/services/sessions';

// Each demo writes about 150 documents, so the limit is tight.
export const POST = publicRoute({ body: demoSchema, rateLimit: RATE_LIMITS.demo }, async ({ deps, body }) => {
  const { circle, member } = await seedDemoCircle(deps, body.timeZone);
  return ok(
    { code: circle.code, home: homePath(member.role) },
    { 'Set-Cookie': sessionCookieFor(deps, circle, member) },
  );
});
