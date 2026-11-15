import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from '@/lib/errors';
import type { Config } from '../config';

export interface OidcVerifier {
  /** Claims of a valid Google ID token for this audience, or null. */
  verify(token: string, audience: string): Promise<{ email: string; emailVerified: boolean } | null>;
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Constant-time string comparison that does not leak either length. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

function bearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null;
}

function secretMatches(secret: string | undefined, offered: string | null): boolean {
  if (!secret || !offered) return false;
  return safeEqual(offered, secret);
}

async function isSchedulerAccount(bearer: string | null, config: Config, oidc: OidcVerifier): Promise<boolean> {
  if (!config.CRON_SERVICE_ACCOUNT || !bearer) return false;
  const claims = await oidc.verify(bearer, config.APP_URL);
  return claims?.emailVerified === true && claims.email === config.CRON_SERVICE_ACCOUNT;
}

/**
 * Lets the reminder tick run only for Cloud Scheduler's service account (signed OIDC token)
 * or a caller holding CRON_SECRET (other schedulers, local development).
 */
export async function authoriseCron(request: Request, config: Config, oidc: OidcVerifier): Promise<void> {
  const bearer = bearerToken(request);
  if (secretMatches(config.CRON_SECRET, request.headers.get('x-cron-secret') ?? bearer)) return;
  if (await isSchedulerAccount(bearer, config, oidc)) return;
  throw new AppError('UNAUTHENTICATED', 'This endpoint is for the scheduler only.');
}
