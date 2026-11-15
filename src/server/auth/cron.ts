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

/**
 * Lets the reminder tick run only for Cloud Scheduler's service account (signed OIDC token)
 * or a caller holding CRON_SECRET (other schedulers, local development).
 */
export async function authoriseCron(request: Request, config: Config, oidc: OidcVerifier): Promise<void> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? null;
  const offered = request.headers.get('x-cron-secret') ?? bearer;
  if (config.CRON_SECRET && offered && safeEqual(offered, config.CRON_SECRET)) return;
  if (config.CRON_SERVICE_ACCOUNT && bearer) {
    const claims = await oidc.verify(bearer, config.APP_URL);
    if (claims?.emailVerified && claims.email === config.CRON_SERVICE_ACCOUNT) return;
  }
  throw new AppError('UNAUTHENTICATED', 'This endpoint is for the scheduler only.');
}
