import { MINUTE_MS } from '@/lib/constants';
import { lookupSchema } from '@/lib/schemas';
import { parse, publicRoute } from '@/server/http';
import { lookupCircle } from '@/server/services/circles';

// Rate limited so circle codes cannot be guessed in bulk.
export const GET = publicRoute({ rateLimit: { limit: 20, windowMs: 10 * MINUTE_MS } }, async ({ deps, request }) => {
  const { code } = parse(lookupSchema, { code: new URL(request.url).searchParams.get('code') ?? '' });
  return lookupCircle(deps, code);
});
