import { z } from 'zod';
import type { Role } from '@/domain/types';
import { HOUR_MS, SESSION_HOURS } from '@/lib/constants';
import type { Config } from '../config';
import { signToken, verifyToken } from './token';

export const SESSION_COOKIE = 'kk_session';

const sessionSchema = z.object({
  typ: z.literal('session'),
  circleId: z.string(),
  memberId: z.string(),
  // A hint for routing only. Every request re-reads the member, so a role change applies at once.
  role: z.enum(['elder', 'caregiver', 'family']),
  exp: z.number(),
});

export type Session = z.infer<typeof sessionSchema>;

function cookie(value: string, maxAgeSeconds: number, config: Config): string {
  const secure = config.APP_URL.startsWith('https://') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

/** Set-Cookie value that signs a member in for 12 hours. */
export function issueSession(config: Config, now: number, who: { circleId: string; memberId: string; role: Role }): string {
  const exp = Math.floor((now + SESSION_HOURS * HOUR_MS) / 1000);
  return cookie(signToken({ typ: 'session', ...who, exp }, config.SESSION_SECRET), SESSION_HOURS * 3600, config);
}

/** Set-Cookie value that signs the browser out. */
export function clearSession(config: Config): string {
  return cookie('', 0, config);
}

/** The session token inside a Cookie header, if present. */
export function sessionTokenFrom(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || null;
  }
  return null;
}

/** The verified, unexpired session for a token, or null. */
export function readSession(token: string | null | undefined, config: Config, now: number): Session | null {
  return token ? verifyToken(token, config.SESSION_SECRET, sessionSchema, now) : null;
}
