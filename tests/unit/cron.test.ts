import { beforeEach, describe, expect, it } from 'vitest';
import { authoriseCron, safeEqual, type OidcVerifier } from '@/server/auth/cron';
import { parseConfig } from '@/server/config';

describe('safeEqual and authoriseCron', () => {
  const CRON = 'cron-secret-0123456789';
  const ACCOUNT = 'scheduler@test.iam.gserviceaccount.com';
  const config = parseConfig({
    NODE_ENV: 'test',
    APP_URL: 'https://kinkeep.example',
    CRON_SECRET: CRON,
    CRON_SERVICE_ACCOUNT: ACCOUNT,
  });
  const oidcCalls: Array<[string, string]> = [];
  const oidc: OidcVerifier = {
    verify: async (token, audience) => {
      oidcCalls.push([token, audience]);
      if (token === 'good') return { email: ACCOUNT, emailVerified: true };
      if (token === 'unverified') return { email: ACCOUNT, emailVerified: false };
      if (token === 'other') return { email: 'someone@else.example', emailVerified: true };
      return null;
    },
  };
  const requestWith = (headers: Record<string, string>) =>
    new Request('https://kinkeep.example/api/cron/tick', { method: 'POST', headers });
  const allowed = (headers: Record<string, string>, cfg = config) => authoriseCron(requestWith(headers), cfg, oidc);
  beforeEach(() => {
    oidcCalls.length = 0;
  });

  it('safeEqual compares exactly, whatever the lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('', '')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', '')).toBe(false);
    expect(safeEqual('🙂', '🙂')).toBe(true);
  });

  it('accepts the shared secret in x-cron-secret or as a bearer token, without calling OIDC', async () => {
    await expect(allowed({ 'x-cron-secret': CRON })).resolves.toBeUndefined();
    await expect(allowed({ authorization: `Bearer ${CRON}` })).resolves.toBeUndefined();
    expect(oidcCalls).toEqual([]);
  });

  it('accepts a verified token for the scheduler account, checked against APP_URL', async () => {
    await expect(allowed({ authorization: 'Bearer good' })).resolves.toBeUndefined();
    expect(oidcCalls).toEqual([['good', 'https://kinkeep.example']]);
  });

  it.each([
    ['no credentials', {}],
    ['a wrong secret', { 'x-cron-secret': 'wrong' }],
    ['an empty secret', { 'x-cron-secret': '' }],
    ['a wrong bearer', { authorization: 'Bearer forged' }],
    ['an unverified email', { authorization: 'Bearer unverified' }],
    ['another account', { authorization: 'Bearer other' }],
    ['a non-bearer scheme', { authorization: `Basic ${CRON}` }],
    ['an empty bearer', { authorization: 'Bearer ' }],
  ])('refuses %s', async (_label, headers) => {
    await expect(allowed(headers)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses everything when neither credential is configured', async () => {
    const bare = parseConfig({ NODE_ENV: 'test' });
    await expect(allowed({ 'x-cron-secret': CRON }, bare)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(allowed({ authorization: 'Bearer good' }, bare)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
