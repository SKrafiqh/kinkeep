import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { maskEmail } from '@/lib/logger';
import { authoriseCron, safeEqual, type OidcVerifier } from '@/server/auth/cron';
import { allowRequest, clientIp, resetRateLimits } from '@/server/auth/rateLimit';
import { signToken, verifyToken } from '@/server/auth/token';
import { parseConfig } from '@/server/config';
import { escapeHtml, renderEmail } from '@/server/email/layout';
import { appointmentEmail, missedEmail, nudgeEmail, sampleEmail, upcomingEmail, weeklySummaryEmail, type SlotEmail } from '@/server/email/templates';
import { createMemoryStore } from '@/server/repos/memoryStore';

const SECRET = 's'.repeat(32);
const PRODUCTION = { NODE_ENV: 'production', APP_URL: 'https://kinkeep.example', SESSION_SECRET: SECRET, PASSCODE_PEPPER: SECRET, ACTION_TOKEN_SECRET: SECRET, CRON_SECRET: 'c'.repeat(16) };

describe('parseConfig', () => {
  it('uses safe development defaults', () => {
    const config = parseConfig({});
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      DATA_STORE: 'memory',
      EMAIL_PROVIDER: 'console',
      AI_MODEL: 'gemma-4-31b-it',
      AI_BASE_URL: 'https://api.prod.adaptionlabs.ai',
      isProduction: false,
    });
    expect(config.SESSION_SECRET).toContain('dev-only');
    expect(config.SESSION_SECRET).not.toBe(config.PASSCODE_PEPPER);
  });

  it('uses Firestore in production and marks it as production', () => {
    const config = parseConfig(PRODUCTION);
    expect(config).toMatchObject({ DATA_STORE: 'firestore', isProduction: true, SESSION_SECRET: SECRET });
  });

  it('requires the three secrets in production and names them without their values', () => {
    expect(() => parseConfig({ NODE_ENV: 'production', APP_URL: 'https://kinkeep.example', CRON_SECRET: 'c'.repeat(16) })).toThrow(
      'Missing configuration: SESSION_SECRET, PASSCODE_PEPPER, ACTION_TOKEN_SECRET',
    );
  });

  it('requires APP_URL in production, since email links and the Secure cookie depend on it', () => {
    expect(() => parseConfig({ ...PRODUCTION, APP_URL: undefined })).toThrow('Missing configuration: APP_URL');
  });

  it('requires a cron credential in production, either kind', () => {
    const withoutCron = { ...PRODUCTION, CRON_SECRET: undefined };
    expect(() => parseConfig(withoutCron)).toThrow('CRON_SECRET or CRON_SERVICE_ACCOUNT');
    expect(parseConfig({ ...withoutCron, CRON_SERVICE_ACCOUNT: 'scheduler@test.iam.gserviceaccount.com' }).isProduction).toBe(true);
    expect(parseConfig(PRODUCTION).isProduction).toBe(true);
  });

  it('requires a user and password for gmail', () => {
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail' })).toThrow('GMAIL_USER, GMAIL_APP_PASSWORD');
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'me@gmail.com' })).toThrow('GMAIL_APP_PASSWORD');
    expect(parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'me@gmail.com', GMAIL_APP_PASSWORD: 'pw' }).EMAIL_PROVIDER).toBe('gmail');
  });

  it('treats empty strings as unset', () => {
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: '', GMAIL_APP_PASSWORD: '' })).toThrow('GMAIL_USER');
    const config = parseConfig({ APP_URL: '', AI_MODEL: '', SESSION_SECRET: '', DATA_STORE: '' });
    expect(config).toMatchObject({ APP_URL: 'http://localhost:3000', AI_MODEL: 'gemma-4-31b-it', DATA_STORE: 'memory' });
    expect(config.SESSION_SECRET).toContain('dev-only');
  });

  it('strips trailing slashes from APP_URL', () => {
    expect(parseConfig({ APP_URL: 'https://kinkeep.example.com/' }).APP_URL).toBe('https://kinkeep.example.com');
    expect(parseConfig({ APP_URL: 'https://kinkeep.example.com///' }).APP_URL).toBe('https://kinkeep.example.com');
  });

  it('rejects invalid values and short secrets', () => {
    expect(() => parseConfig({ APP_URL: 'not a url' })).toThrow('Invalid configuration');
    expect(() => parseConfig({ NODE_ENV: 'staging' })).toThrow('NODE_ENV');
    expect(() => parseConfig({ SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET');
    expect(() => parseConfig({ CRON_SECRET: 'short' })).toThrow('CRON_SECRET');
  });

  it('never puts a secret value in an error', () => {
    expect(() => parseConfig({ SESSION_SECRET: 'tooshort-but-secret' })).toThrow(/^(?!.*tooshort-but-secret)/s);
  });

  it('returns a frozen object', () => {
    const config = parseConfig({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as { APP_URL: string }).APP_URL = 'https://evil.example';
    }).toThrow(TypeError);
  });
});

describe('signToken and verifyToken', () => {
  const schema = z.object({ exp: z.number(), sub: z.string() });
  const NOW = Date.UTC(2026, 10, 16);
  const exp = Math.floor(NOW / 1000) + 60;
  const b64 = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const mac = (data: string, secret: string): string => createHmac('sha256', secret).update(data).digest('base64url');

  it('round trips a payload', () => {
    const token = signToken({ exp, sub: 'abc' }, SECRET);
    expect(token.split('.')).toHaveLength(3);
    expect(verifyToken(token, SECRET, schema, NOW)).toEqual({ exp, sub: 'abc' });
  });

  it('rejects the wrong secret', () => {
    expect(verifyToken(signToken({ exp, sub: 'abc' }, SECRET), 'x'.repeat(32), schema, NOW)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const [header, , signature] = signToken({ exp, sub: 'abc' }, SECRET).split('.');
    const forged = `${header}.${b64({ exp, sub: 'admin' })}.${signature}`;
    expect(verifyToken(forged, SECRET, schema, NOW)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signToken({ exp, sub: 'abc' }, SECRET);
    const flipped = `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(verifyToken(flipped, SECRET, schema, NOW)).toBeNull();
  });

  it('rejects an expired token, including at the exact expiry second', () => {
    const token = signToken({ exp, sub: 'abc' }, SECRET);
    expect(verifyToken(token, SECRET, schema, exp * 1000 - 1)).not.toBeNull();
    expect(verifyToken(token, SECRET, schema, exp * 1000)).toBeNull();
    expect(verifyToken(token, SECRET, schema, exp * 1000 + 1)).toBeNull();
  });

  it('rejects a payload of the wrong shape even when correctly signed', () => {
    expect(verifyToken(signToken({ exp, sub: 42 }, SECRET), SECRET, schema, NOW)).toBeNull();
    expect(verifyToken(signToken({ exp }, SECRET), SECRET, schema, NOW)).toBeNull();
  });

  it.each(['', 'garbage', 'a.b', 'a.b.c', 'a.b.c.d', '...', '\u0000.\u0000.\u0000', '🙂.🙂.🙂'])('rejects garbage input %j', (garbage) => {
    expect(verifyToken(garbage, SECRET, schema, NOW)).toBeNull();
  });

  it('rejects a payload that is not JSON even when correctly signed', () => {
    const [header] = signToken({ exp, sub: 'abc' }, SECRET).split('.');
    const payload = Buffer.from('not json').toString('base64url');
    expect(verifyToken(`${header}.${payload}.${mac(`${header}.${payload}`, SECRET)}`, SECRET, schema, NOW)).toBeNull();
  });

  it('rejects any other header, even with a valid signature, such as alg none or HS512', () => {
    const payload = b64({ exp, sub: 'abc' });
    for (const header of [b64({ alg: 'none', typ: 'JWT' }), b64({ alg: 'HS512', typ: 'JWT' }), b64({ typ: 'JWT', alg: 'HS256', kid: '1' })]) {
      expect(verifyToken(`${header}.${payload}.${mac(`${header}.${payload}`, SECRET)}`, SECRET, schema, NOW)).toBeNull();
      expect(verifyToken(`${header}.${payload}.`, SECRET, schema, NOW)).toBeNull();
    }
  });
});

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
    const request = new Request('http://localhost/', { headers: { 'x-forwarded-for': '6.6.6.6, 7.7.7.7 , 203.0.113.9' } });
    expect(clientIp(request)).toBe('203.0.113.9');
    expect(clientIp(new Request('http://localhost/', { headers: { 'x-forwarded-for': '203.0.113.9' } }))).toBe('203.0.113.9');
  });

  it('falls back to unknown without the header or with an empty one', () => {
    expect(clientIp(new Request('http://localhost/'))).toBe('unknown');
    expect(clientIp(new Request('http://localhost/', { headers: { 'x-forwarded-for': '' } }))).toBe('unknown');
  });
});

describe('the memory store', () => {
  const store = () => createMemoryStore();
  interface Doc {
    n?: number | null;
    label?: string;
  }

  it('create returns false and changes nothing when the document exists', async () => {
    const s = store();
    expect(await s.create('c/1', { n: 1 })).toBe(true);
    expect(await s.create('c/1', { n: 2 })).toBe(false);
    expect(await s.get<Doc>('c/1')).toEqual({ n: 1 });
  });

  it('get returns null for a missing document and delete is idempotent', async () => {
    const s = store();
    expect(await s.get('c/missing')).toBeNull();
    await s.set('c/1', { n: 1 });
    await s.delete('c/1');
    await s.delete('c/1');
    expect(await s.get('c/1')).toBeNull();
  });

  it('update merges top-level fields and throws on a missing document', async () => {
    const s = store();
    await expect(s.update('c/missing', { n: 1 })).rejects.toThrow('No document at c/missing');
    await s.set('c/1', { n: 1, label: 'a' });
    await s.update('c/1', { n: 2 });
    expect(await s.get<Doc>('c/1')).toEqual({ n: 2, label: 'a' });
    expect(await s.get('c/missing')).toBeNull();
  });

  it('list filters, orders and limits', async () => {
    const s = store();
    for (const n of [5, 1, 4, 2, 3]) await s.set(`c/${n}`, { n, label: n % 2 ? 'odd' : 'even' });
    expect((await s.list<Doc>('c', { where: [{ field: 'label', op: '==', value: 'even' }], orderBy: { field: 'n', direction: 'asc' } })).map((d) => d.n)).toEqual([2, 4]);
    expect((await s.list<Doc>('c', { orderBy: { field: 'n', direction: 'desc' }, limit: 2 })).map((d) => d.n)).toEqual([5, 4]);
    expect((await s.list<Doc>('c', { where: [{ field: 'n', op: '>', value: 2 }, { field: 'n', op: '<', value: 5 }], orderBy: { field: 'n', direction: 'asc' } })).map((d) => d.n)).toEqual([3, 4]);
    expect((await s.list<Doc>('c', { where: [{ field: 'n', op: '>=', value: 5 }] })).map((d) => d.n)).toEqual([5]);
    expect(await s.list<Doc>('c', { limit: 0 })).toEqual([]);
    expect(await s.list<Doc>('empty')).toEqual([]);
  });

  it('list only returns direct children of the collection', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    await s.set('c/1/sub/2', { n: 2 });
    await s.set('cc/3', { n: 3 });
    expect((await s.list<Doc>('c')).map((d) => d.n)).toEqual([1]);
  });

  it('a <= filter never matches null, missing or differently typed fields', async () => {
    const s = store();
    await s.set('c/null', { n: null });
    await s.set('c/missing', { label: 'x' });
    await s.set('c/text', { n: '0' });
    await s.set('c/zero', { n: 0 });
    await s.set('c/high', { n: 100 });
    const found = await s.list<Doc>('c', { where: [{ field: 'n', op: '<=', value: 50 }] });
    expect(found).toEqual([{ n: 0 }]);
  });

  it('ordering leaves out documents without the field', async () => {
    const s = store();
    await s.set('c/a', { n: 2 });
    await s.set('c/b', { n: null });
    await s.set('c/c', { label: 'x' });
    expect((await s.list<Doc>('c', { orderBy: { field: 'n', direction: 'asc' } })).map((d) => d.n)).toEqual([2]);
  });

  it('listGroup works across parents and returns paths', async () => {
    const s = store();
    await s.set('circles/a/doses/1', { n: 3 });
    await s.set('circles/b/doses/2', { n: 1 });
    await s.set('circles/b/meds/3', { n: 2 });
    const found = await s.listGroup<Doc>('doses', { orderBy: { field: 'n', direction: 'asc' } });
    expect(found).toEqual([
      { path: 'circles/b/doses/2', data: { n: 1 } },
      { path: 'circles/a/doses/1', data: { n: 3 } },
    ]);
    expect(await s.listGroup<Doc>('doses', { where: [{ field: 'n', op: '<=', value: 1 }], limit: 5 })).toHaveLength(1);
  });

  it('a transaction applies all writes together', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    const result = await s.transaction(async (tx) => {
      const current = await tx.get<Doc>('c/1');
      tx.update('c/1', { n: (current?.n ?? 0) + 1 });
      tx.set('c/2', { n: 9 });
      tx.delete('c/1');
      return 'done';
    });
    expect(result).toBe('done');
    expect(await s.get('c/1')).toBeNull();
    expect(await s.get<Doc>('c/2')).toEqual({ n: 9 });
  });

  it('a failed transaction writes nothing and does not block the next one', async () => {
    const s = store();
    await s.set('c/1', { n: 1 });
    await expect(
      s.transaction(async (tx) => {
        tx.set('c/1', { n: 99 });
        tx.set('c/2', { n: 2 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(
      s.transaction(async (tx) => {
        tx.set('c/3', { n: 3 });
        tx.update('c/missing', { n: 1 });
      }),
    ).rejects.toThrow('No document at c/missing');
    expect(await s.get<Doc>('c/1')).toEqual({ n: 1 });
    expect(await s.get('c/2')).toBeNull();
    // All or nothing, like Firestore: the write queued before the failing update is dropped too.
    expect(await s.get('c/3')).toBeNull();
    expect(await s.transaction(async () => 'still works')).toBe('still works');
  });

  it('transactions run one at a time, so concurrent increments are not lost', async () => {
    const s = store();
    await s.set('c/counter', { n: 0 });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        s.transaction(async (tx) => {
          const current = await tx.get<Doc>('c/counter');
          tx.set('c/counter', { n: (current?.n ?? 0) + 1 });
        }),
      ),
    );
    expect(await s.get<Doc>('c/counter')).toEqual({ n: 20 });
  });

  it('reads and writes copy, so callers cannot change stored data by mutating', async () => {
    const s = store();
    const original = { n: 1, nested: { list: [1] } };
    await s.set('c/1', original);
    original.nested.list.push(2);
    const first = await s.get<typeof original>('c/1');
    expect(first?.nested.list).toEqual([1]);
    first?.nested.list.push(3);
    expect((await s.get<typeof original>('c/1'))?.nested.list).toEqual([1]);
    (await s.list<typeof original>('c'))[0].nested.list.push(4);
    (await s.listGroup<typeof original>('c', {}))[0].data.nested.list.push(5);
    expect((await s.get<typeof original>('c/1'))?.nested.list).toEqual([1]);
  });
});

describe('escapeHtml and renderEmail', () => {
  it('escapes the five special characters and leaves other text alone', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('Plain 😀 text, ünïcode')).toBe('Plain 😀 text, ünïcode');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes every field in the html part and keeps the text part readable', () => {
    const rendered = renderEmail({
      heading: '<h1>Head</h1>',
      lines: ['Line <b>one</b>'],
      items: ['<script>alert(1)</script>'],
      primary: { label: 'Go <now>', url: 'https://x.example/?a=1&b="2"' },
      secondary: { label: 'Skip', url: 'https://x.example/?do=skip' },
      footer: 'Foot <i>er</i>',
    });
    expect(rendered.html).not.toMatch(/<script|<b>|<i>|<now>/);
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).toContain('href="https://x.example/?a=1&amp;b=&quot;2&quot;"');
    expect(rendered.text).toContain('- <script>alert(1)</script>');
    expect(rendered.text).toContain('Go <now>: https://x.example/?a=1&b="2"');
    expect(rendered.text).toContain('Skip: https://x.example/?do=skip');
    expect(rendered.text.endsWith('Foot <i>er</i>')).toBe(true);
  });

  it('adds the default footer and omits the empty parts', () => {
    const rendered = renderEmail({ heading: 'Hi', lines: ['Body'] });
    expect(rendered.text).toBe('Hi\n\nBody\n\nYou are getting this because you are part of a KinKeep care circle.');
    expect(rendered.html).not.toContain('<ul');
    expect(rendered.html).not.toContain('<a ');
    expect(renderEmail({ heading: 'Hi', lines: [], items: [] }).html).not.toContain('<ul');
  });
});

describe('email templates', () => {
  const slot: SlotEmail = {
    whose: 'Your',
    slotTime: '9:00 am',
    medicines: [{ name: '<script>alert("x")</script>', strength: '500 mg' }, { name: 'Aspirin', strength: '' }],
    actUrl: 'https://kinkeep.example/act/token',
  };
  const medicines = slot.medicines;

  const all = {
    upcoming: upcomingEmail(slot),
    upcomingWithNote: upcomingEmail(slot, 'A <note>'),
    nudge: nudgeEmail(slot),
    missed: missedEmail({ elderName: 'Mr Rao', slotTime: '9:00 am', medicines, circleUrl: 'https://kinkeep.example/circle' }),
    appointment: appointmentEmail({ kind: 'h24', whose: "Mr Rao's", doctor: 'Dr <Mehta>', speciality: '', place: 'Clinic', when: 'Thu 19 Nov 10:30 am', briefUrl: 'https://kinkeep.example/b' }),
    appointmentSoon: appointmentEmail({ kind: 'h2', whose: 'Your', doctor: 'Dr Mehta', speciality: 'Cardiology', place: '', when: 'today', briefUrl: 'https://kinkeep.example/b' }),
    weekly: weeklySummaryEmail({ elderName: 'Mr Rao', sentences: ['He took <most> doses.'], circleUrl: 'https://kinkeep.example/circle' }),
    sample: sampleEmail('https://kinkeep.example/today'),
  };

  it.each(Object.entries(all))('%s has a subject, a text part and an html part', (_name, email) => {
    expect(email.subject.trim()).not.toBe('');
    expect(email.text.trim()).not.toBe('');
    expect(email.html).toContain('<!doctype html>');
    expect(email.subject).not.toContain('undefined');
    expect(email.text).not.toContain('undefined');
  });

  it('escapes user-entered medicine names in the html part of every medicine email', () => {
    for (const email of [all.upcoming, all.nudge, all.missed]) {
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; 500 mg');
      expect(email.text).toContain('- <script>alert("x")</script> 500 mg');
      expect(email.text).toContain('- Aspirin');
    }
  });

  it('escapes other user-entered text, such as doctor names, notes and sentences', () => {
    expect(all.appointment.html).not.toContain('<Mehta>');
    expect(all.appointment.html).toContain('Dr &lt;Mehta&gt;');
    expect(all.upcomingWithNote.html).toContain('A &lt;note&gt;');
    expect(all.weekly.html).toContain('He took &lt;most&gt; doses.');
  });

  it('puts the confirm and skip links in the dose emails', () => {
    for (const email of [all.upcoming, all.nudge]) {
      expect(email.text).toContain('I took them: https://kinkeep.example/act/token');
      expect(email.text).toContain('Skip this dose: https://kinkeep.example/act/token?do=skip');
    }
    expect(all.missed.text).not.toContain('/act/');
    expect(all.sample.text).not.toContain('/act/');
  });

  it('counts the medicines in the upcoming subject and picks the subject by kind', () => {
    expect(all.upcoming.subject).toBe('Your 9:00 am medicines (2)');
    expect(all.appointment.subject).toBe('Coming up: Dr <Mehta>, Thu 19 Nov 10:30 am');
    expect(all.appointmentSoon.subject).toBe('Soon: Dr Mehta, today');
    expect(all.appointmentSoon.text).toContain('Cardiology');
    expect(all.appointment.text).not.toContain(' · ');
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('priya@example.com')).toBe('p***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });

  it('copes with odd input without throwing', () => {
    expect(maskEmail('')).toBe('***@');
    expect(maskEmail('no-at-sign')).toBe('n***@');
    expect(maskEmail('🙂x@example.com').endsWith('***@example.com')).toBe(true);
  });

  it('never contains the rest of the local part', () => {
    expect(maskEmail('secretname@example.com')).not.toContain('ecret');
  });
});

describe('safeEqual and authoriseCron', () => {
  const CRON = 'cron-secret-0123456789';
  const ACCOUNT = 'scheduler@test.iam.gserviceaccount.com';
  const config = parseConfig({ NODE_ENV: 'test', APP_URL: 'https://kinkeep.example', CRON_SECRET: CRON, CRON_SERVICE_ACCOUNT: ACCOUNT });
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
  const requestWith = (headers: Record<string, string>) => new Request('https://kinkeep.example/api/cron/tick', { method: 'POST', headers });
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
