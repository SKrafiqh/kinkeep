import { MINUTE_MS } from '@/lib/constants';
import { actSchema } from '@/lib/schemas';
import { publicRoute } from '@/server/http';
import { performAction } from '@/server/services/actions';

/** One-tap action from an email. The signed token is the authority; no session is needed. */
export const POST = publicRoute({ body: actSchema, rateLimit: { limit: 30, windowMs: 10 * MINUTE_MS } }, ({ deps, body }) =>
  performAction(deps, body.token, body.action),
);
