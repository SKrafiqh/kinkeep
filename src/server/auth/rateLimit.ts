interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimit {
  /** Requests allowed per window; also the burst size. */
  limit: number;
  windowMs: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

/**
 * Token bucket per key, held in this instance's memory. With several instances each keeps
 * its own count, so this is best effort; member lockout in the database is the hard limit.
 */
export function allowRequest(key: string, rule: RateLimit, now: number): boolean {
  const bucket = buckets.get(key) ?? { tokens: rule.limit, updatedAt: now };
  const refilled = Math.min(rule.limit, bucket.tokens + ((now - bucket.updatedAt) / rule.windowMs) * rule.limit);
  const allowed = refilled >= 1;
  // Re-inserting keeps the map in least-recently-used order, so eviction drops idle callers
  // first and a flood of new keys can never wipe an active caller's count.
  buckets.delete(key);
  buckets.set(key, { tokens: allowed ? refilled - 1 : refilled, updatedAt: now });
  if (buckets.size > MAX_BUCKETS) {
    for (const oldest of buckets.keys()) {
      buckets.delete(oldest);
      if (buckets.size <= MAX_BUCKETS * 0.9) break;
    }
  }
  return allowed;
}

/** Caller address. Proxies append the real client last, so earlier entries cannot be trusted. */
export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
}

/** Forget all counts. For tests. */
export function resetRateLimits(): void {
  buckets.clear();
}
