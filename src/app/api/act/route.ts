import { RATE_LIMITS } from '@/lib/constants';
import { actSchema } from '@/lib/schemas';
import { publicRoute } from '@/server/http';
import { performAction } from '@/server/services/actions';

/** One-tap action from an email. The signed token is the authority; no session is needed. */
export const POST = publicRoute({ body: actSchema, rateLimit: RATE_LIMITS.emailAction }, ({ deps, body }) =>
  performAction(deps, body.token, body.action),
);
