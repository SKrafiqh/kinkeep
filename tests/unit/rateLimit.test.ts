import { beforeEach, describe, expect, it } from 'vitest';
import { allowRequest, clientIp, resetRateLimits } from '@/server/auth/rateLimit';

describe('allowRequest and clientIp', () => {
  const RULE = { limit: 3, windowMs: 60_000 };
  const NOW = 1_000_000;
  beforeEach(resetRateLimits);

  it('allows a burst up to the limit and then refuses', () => {
    expect([1, 2, 3, 4, 5].map(() => allowRequest('k', RULE, NOW))).toEqual([true, true, true, false, false]);
  });

  it('counts each key on its own', () => {
    for (let i = 0; i < 3; i += 1) allowRequest('a', RULE, NOW);
    expect(allowRequest('a', RULE, NOW)).toBe(false);
    expect(allowRequest('b', RULE, NOW)).toBe(true);
  });

  it('refills over time, one token per window divided by limit', () => {
    for (let i = 0; i < 3; i += 1) allowRequest('k', RULE, NOW);
    expect(allowRequest('k', RULE, NOW + 19_000)).toBe(false);
    expect(allowRequest('k', RULE, NOW + 20_000)).toBe(true);
    expect(allowRequest('k', RULE, NOW + 20_000)).toBe(false);
  });

  it('never refills past the limit', () => {
    allowRequest('k', RULE, NOW);
    const later = NOW + 10 * RULE.windowMs;
    expect([1, 2, 3, 4].map(() => allowRequest('k', RULE, later))).toEqual([true, true, true, false]);
  });

  it('forgets everything on reset', () => {
    for (let i = 0; i < 3; i += 1) allowRequest('k', RULE, NOW);
    resetRateLimits();
    expect(allowRequest('k', RULE, NOW)).toBe(true);
  });

  it('uses the last x-forwarded-for entry, which the proxy added', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '6.6.6.6, 7.7.7.7 , 203.0.113.9' },
    });
    expect(clientIp(request)).toBe('203.0.113.9');
    expect(clientIp(new Request('http://localhost/', { headers: { 'x-forwarded-for': '203.0.113.9' } }))).toBe(
      '203.0.113.9',
    );
  });

  it('falls back to unknown without the header or with an empty one', () => {
    expect(clientIp(new Request('http://localhost/'))).toBe('unknown');
    expect(clientIp(new Request('http://localhost/', { headers: { 'x-forwarded-for': '' } }))).toBe('unknown');
  });
});
