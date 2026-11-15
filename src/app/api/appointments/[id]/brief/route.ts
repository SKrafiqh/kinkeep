import { RATE_LIMITS } from '@/lib/constants';
import { briefSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { generateBrief, saveBrief } from '@/server/services/brief';

/** Generates the visit brief. Anyone in the circle may; AI use is capped per circle per day. */
export const POST = memberRoute({ permission: 'circle:view', rateLimit: RATE_LIMITS.brief }, ({ deps, params, who }) =>
  generateBrief(deps, who, params.id),
);

/** Saves the brief after a person has edited it. */
export const PUT = memberRoute({ body: briefSchema, permission: 'appointment:write' }, ({ deps, body, params, who }) =>
  saveBrief(deps, who, params.id, body),
);
