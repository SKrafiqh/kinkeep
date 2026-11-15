import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { signToken, verifyToken } from '@/server/auth/token';

const SECRET = 's'.repeat(32);

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

  it.each(['', 'garbage', 'a.b', 'a.b.c', 'a.b.c.d', '...', '\u0000.\u0000.\u0000', '🙂.🙂.🙂'])(
    'rejects garbage input %j',
    (garbage) => {
      expect(verifyToken(garbage, SECRET, schema, NOW)).toBeNull();
    },
  );

  it('rejects a payload that is not JSON even when correctly signed', () => {
    const [header] = signToken({ exp, sub: 'abc' }, SECRET).split('.');
    const payload = Buffer.from('not json').toString('base64url');
    expect(verifyToken(`${header}.${payload}.${mac(`${header}.${payload}`, SECRET)}`, SECRET, schema, NOW)).toBeNull();
  });

  it('rejects any other header, even with a valid signature, such as alg none or HS512', () => {
    const payload = b64({ exp, sub: 'abc' });
    for (const header of [
      b64({ alg: 'none', typ: 'JWT' }),
      b64({ alg: 'HS512', typ: 'JWT' }),
      b64({ typ: 'JWT', alg: 'HS256', kid: '1' }),
    ]) {
      expect(
        verifyToken(`${header}.${payload}.${mac(`${header}.${payload}`, SECRET)}`, SECRET, schema, NOW),
      ).toBeNull();
      expect(verifyToken(`${header}.${payload}.`, SECRET, schema, NOW)).toBeNull();
    }
  });
});
