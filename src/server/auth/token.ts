import { createHmac, timingSafeEqual } from 'node:crypto';
import type { z } from 'zod';

const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const HEADER = encode({ alg: 'HS256', typ: 'JWT' });

const sign = (data: string, secret: string): Buffer => createHmac('sha256', secret).update(data).digest();

/** A compact HS256 JWT. `exp` is in seconds, as the standard says. */
export function signToken(payload: { exp: number } & Record<string, unknown>, secret: string): string {
  const body = `${HEADER}.${encode(payload)}`;
  return `${body}.${sign(body, secret).toString('base64url')}`;
}

/**
 * The payload of a token we signed, or null when it is malformed, forged, the wrong shape
 * or expired. The header must match exactly, so no other algorithm is ever accepted.
 */
export function verifyToken<T extends { exp: number }>(
  token: string,
  secret: string,
  schema: z.ZodType<T>,
  now: number,
): T | null {
  const [header, payload, signature, ...extra] = token.split('.');
  if (header !== HEADER || !payload || !signature || extra.length > 0) return null;
  const expected = sign(`${header}.${payload}`, secret);
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    return parsed.success && parsed.data.exp * 1000 > now ? parsed.data : null;
  } catch {
    return null;
  }
}
