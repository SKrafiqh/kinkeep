import { MINUTE_MS } from '@/lib/constants';
import { briefSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { generateBrief, saveBrief } from '@/server/services/brief';

/** Generates the visit brief. Anyone in the circle may; AI use is capped per circle per day. */
export const POST = memberRoute(
  { permission: 'circle:view', rateLimit: { limit: 10, windowMs: 10 * MINUTE_MS } },
  ({ deps, params, circle, member, expiresAt }) => generateBrief(deps, { circle, member, expiresAt }, params.id),
);

/** Saves the brief after a person has edited it. */
export const PUT = memberRoute({ body: briefSchema, permission: 'appointment:write' }, ({ deps, body, params, circle, member, expiresAt }) =>
  saveBrief(deps, { circle, member, expiresAt }, params.id, body),
);
