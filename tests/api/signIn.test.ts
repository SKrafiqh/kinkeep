import { beforeEach, describe, expect, it } from 'vitest';
import { GET as lookupRoute } from '@/app/api/circles/lookup/route';
import { GET as listMedsRoute } from '@/app/api/medications/route';
import { POST as passcodeRoute } from '@/app/api/passcode/route';
import { DELETE as signOutRoute, POST as signInRoute } from '@/app/api/session/route';
import { MINUTE_MS } from '@/lib/constants';
import { hashPasscode, newPasscodeFields, randomPasscode, verifyPasscode } from '@/server/auth/passcode';
import { call, CIRCLE_INPUT, createCircle, createWorld, signIn, type World } from './helpers';

let world: World;
beforeEach(() => {
  world = createWorld();
});

describe('passcode hashing', () => {
  it('is deterministic for one salt and pepper, and different for any other', async () => {
    const salt = 'a1'.repeat(16);
    const hash = await hashPasscode('246810', salt, 'pepper-one');
    expect(await hashPasscode('246810', salt, 'pepper-one')).toBe(hash);
    expect(await hashPasscode('246810', salt, 'pepper-two')).not.toBe(hash);
    expect(await hashPasscode('246810', 'b2'.repeat(16), 'pepper-one')).not.toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies only the right passcode', async () => {
    const { passcodeHash, passcodeSalt } = await newPasscodeFields('246810', 'pepper');
    expect(await verifyPasscode('246810', passcodeSalt, passcodeHash, 'pepper')).toBe(true);
    expect(await verifyPasscode('246811', passcodeSalt, passcodeHash, 'pepper')).toBe(false);
    expect(await verifyPasscode('246810', passcodeSalt, 'not-hex', 'pepper')).toBe(false);
  });

  it('generates six-digit setup passcodes', () => {
    for (let i = 0; i < 50; i += 1) expect(randomPasscode()).toMatch(/^\d{6}$/);
  });
});

describe('signing in', () => {
  it('signs out and back in', async () => {
    const { code, cookie } = await createCircle();
    const out = await call(signOutRoute, { method: 'DELETE', cookie });
    expect(out.cookie).toBe('kk_session=');
    expect((await call(listMedsRoute, {})).status).toBe(401);
    const back = await signIn(code, 'Mr Rao', CIRCLE_INPUT.passcode);
    expect(back).toMatchObject({ status: 200, data: { home: '/today' } });
    expect((await call(listMedsRoute, { cookie: back.cookie })).status).toBe(200);
  });

  it('counts down wrong tries, then locks the member for 15 minutes', async () => {
    const { code } = await createCircle();
    const first = await signIn(code, 'Mr Rao', '000000');
    expect(first).toMatchObject({ status: 401, error: { message: 'That passcode did not match. 4 tries left.' } });
    for (let i = 0; i < 3; i += 1) await signIn(code, 'Mr Rao', '000000');
    const fifth = await signIn(code, 'Mr Rao', '000000');
    expect(fifth).toMatchObject({ status: 423, error: { code: 'LOCKED' } });
    expect(fifth.error?.message).toContain('8:45 am');
    expect((await signIn(code, 'Mr Rao', CIRCLE_INPUT.passcode)).status).toBe(423);
    world.time.now += 15 * MINUTE_MS + 1;
    expect((await signIn(code, 'Mr Rao', CIRCLE_INPUT.passcode)).status).toBe(200);
  });

  it('resets the count after a correct passcode', async () => {
    const { code } = await createCircle();
    for (let i = 0; i < 4; i += 1) await signIn(code, 'Mr Rao', '000000');
    expect((await signIn(code, 'Mr Rao', CIRCLE_INPUT.passcode)).status).toBe(200);
    expect((await signIn(code, 'Mr Rao', '000000')).error?.message).toContain('4 tries left');
  });

  it('cannot be outrun by parallel guesses', async () => {
    const { code } = await createCircle();
    const found = await call(lookupRoute, { query: `?code=${code}` });
    const memberId = found.data.members[0].id;
    const guesses = Array.from({ length: 12 }, (_, i) =>
      call(signInRoute, { body: { code, memberId, passcode: String(100000 + i) } }),
    );
    const results = await Promise.all(guesses);
    expect(results.filter((r) => r.status === 423).length).toBeGreaterThanOrEqual(8);
    expect((await signIn(code, 'Mr Rao', CIRCLE_INPUT.passcode)).status).toBe(423);
  });

  it('shows names only on the join screen and hides unknown circles', async () => {
    const { code } = await createCircle();
    const found = await call(lookupRoute, { query: `?code=${code.toLowerCase()}` });
    expect(found.data).toEqual({ elderName: 'Mr Rao', members: [{ id: expect.any(String), name: 'Mr Rao' }] });
    expect((await call(lookupRoute, { query: '?code=ZZZZZZ' })).status).toBe(404);
    expect((await call(lookupRoute, { query: '?code=x' })).status).toBe(400);
    expect((await call(signInRoute, { body: { code: 'ZZZZZZ', memberId: 'm1', passcode: '123456' } })).status).toBe(
      404,
    );
  });

  it('rejects an expired or tampered session', async () => {
    const { cookie } = await createCircle();
    expect((await call(listMedsRoute, { cookie: `${cookie}x` })).status).toBe(401);
    expect((await call(listMedsRoute, { cookie: 'kk_session=a.b.c' })).status).toBe(401);
    world.time.now += 12 * 60 * MINUTE_MS + 1000;
    expect((await call(listMedsRoute, { cookie })).status).toBe(401);
  });

  it('requires the current passcode to set a new one', async () => {
    const { cookie, code } = await createCircle();
    expect((await call(passcodeRoute, { cookie, body: { current: '000000', passcode: '112233' } })).status).toBe(401);
    expect(
      (await call(passcodeRoute, { cookie, body: { current: CIRCLE_INPUT.passcode, passcode: CIRCLE_INPUT.passcode } }))
        .status,
    ).toBe(400);
    expect(
      (await call(passcodeRoute, { cookie, body: { current: CIRCLE_INPUT.passcode, passcode: '112233' } })).status,
    ).toBe(200);
    expect((await signIn(code, 'Mr Rao', '112233')).status).toBe(200);
  });
});
