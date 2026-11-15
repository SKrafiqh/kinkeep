import { beforeEach, describe, expect, it } from 'vitest';
import { GET as lookupRoute } from '@/app/api/circles/lookup/route';
import { POST as circlesRoute } from '@/app/api/circles/route';
import { DELETE as deleteMedRoute, PATCH as patchMedRoute } from '@/app/api/medications/[id]/route';
import { GET as listMedsRoute, POST as addMedRoute } from '@/app/api/medications/route';
import { DELETE as removeMemberRoute, PATCH as patchMemberRoute } from '@/app/api/members/[id]/route';
import { GET as listMembersRoute, POST as addMemberRoute } from '@/app/api/members/route';
import { POST as passcodeRoute } from '@/app/api/passcode/route';
import { POST as signInRoute } from '@/app/api/session/route';
import { issueSession } from '@/server/auth/session';
import { call, CIRCLE_INPUT, createCircle, createWorld, MEDICINE_INPUT, signIn, type World } from './helpers';

let world: World;
beforeEach(() => {
  world = createWorld();
});

/** The elder adds a helper, who signs in with the setup passcode and chooses their own. */
async function addHelper(elderCookie: string, code: string, name: string, role: 'caregiver' | 'family') {
  const added = await call(addMemberRoute, {
    cookie: elderCookie,
    body: { name, email: `${name.toLowerCase()}@example.com`, role },
  });
  const first = await signIn(code, name, added.data.setupPasscode);
  await call(passcodeRoute, { cookie: first.cookie, body: { current: added.data.setupPasscode, passcode: '135790' } });
  return { cookie: first.cookie as string, id: added.data.member.id as string };
}

describe('creating a circle', () => {
  it('returns a code and signs the creator in with a locked-down cookie', async () => {
    const created = await createCircle();
    expect(created.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.data).toMatchObject({ home: '/today', elderSetupPasscode: null });
    const cookie = issueSession(world.deps.config, world.time.now, { circleId: 'c', memberId: 'm', role: 'elder' });
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=43200');
  });

  it('never stores the passcode itself', async () => {
    const { code } = await createCircle();
    const [circle] = await world.deps.store.list<{ id: string }>('circles');
    const members = await world.deps.store.list<Record<string, unknown>>(`circles/${circle.id}/members`);
    expect(JSON.stringify(members)).not.toContain(CIRCLE_INPUT.passcode);
    expect(code).toBeTruthy();
  });

  it('gives the elder their own member and one-time passcode when a relative sets up', async () => {
    const created = await createCircle({ name: 'Priya', role: 'caregiver', email: 'priya@example.com' });
    expect(created.data.home).toBe('/circle');
    expect(created.data.elderSetupPasscode).toMatch(/^\d{6}$/);
    const elder = await signIn(created.code, 'Mr Rao', created.data.elderSetupPasscode);
    expect(elder.data.home).toBe('/passcode');
    const blocked = await call(listMedsRoute, { cookie: elder.cookie });
    expect(blocked).toMatchObject({ status: 403, error: { code: 'PASSCODE_CHANGE_REQUIRED' } });
    const changed = await call(passcodeRoute, {
      cookie: elder.cookie,
      body: { current: created.data.elderSetupPasscode, passcode: '112233' },
    });
    expect(changed.data.home).toBe('/today');
    expect((await call(listMedsRoute, { cookie: elder.cookie })).status).toBe(200);
  });

  it('rejects bad input field by field and unknown fields', async () => {
    const bad = await call(circlesRoute, {
      body: { ...CIRCLE_INPUT, passcode: '12ab', email: 'nope', timeZone: 'Mars/Olympus' },
    });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.error?.fields ?? {}).sort()).toEqual(['email', 'passcode', 'timeZone']);
    expect((await call(circlesRoute, { body: { ...CIRCLE_INPUT, admin: true } })).status).toBe(400);
    expect((await call(circlesRoute, { body: '{not json' })).status).toBe(400);
  });

  it('refuses a relative whose name matches the elder', async () => {
    const result = await call(circlesRoute, { body: { ...CIRCLE_INPUT, role: 'caregiver', name: 'mr rao' } });
    expect(result).toMatchObject({ status: 400, error: { fields: { name: expect.any(String) } } });
  });
});

describe('request guards', () => {
  it('refuses mutations from another origin or with no origin', async () => {
    const { cookie } = await createCircle();
    const evil = await call(addMedRoute, { cookie, body: MEDICINE_INPUT, origin: 'https://evil.example' });
    expect(evil).toMatchObject({ status: 403, error: { code: 'FORBIDDEN' } });
    expect((await call(addMedRoute, { cookie, body: MEDICINE_INPUT, origin: null })).status).toBe(403);
    expect((await call(listMedsRoute, { cookie })).data).toEqual([]);
  });

  it('rate limits public routes per address', async () => {
    const { code } = await createCircle();
    const statuses: number[] = [];
    for (let i = 0; i < 22; i += 1)
      statuses.push((await call(lookupRoute, { query: `?code=${code}`, ip: '198.51.100.9' })).status);
    expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
    expect(statuses[21]).toBe(429);
    expect((await call(lookupRoute, { query: `?code=${code}`, ip: '198.51.100.10' })).status).toBe(200);
  });

  it('never leaks internals when something unexpected breaks', async () => {
    const { cookie } = await createCircle();
    world.deps.store.list = async () => {
      throw new Error('secret database detail');
    };
    const result = await call(listMedsRoute, { cookie });
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.error)).not.toContain('secret');
  });
});

describe('roles and isolation', () => {
  it('keeps one circle from reading or changing another', async () => {
    const a = await createCircle();
    const b = await createCircle({ elderName: 'Mrs Das', name: 'Mrs Das', email: 'das@example.com' });
    const med = await call(addMedRoute, { cookie: a.cookie, body: MEDICINE_INPUT });
    expect((await call(listMedsRoute, { cookie: b.cookie })).data).toEqual([]);
    const patch = await call(patchMedRoute, {
      method: 'PATCH',
      cookie: b.cookie,
      params: { id: med.data.id },
      body: { ...MEDICINE_INPUT, strength: '9999 mg' },
    });
    expect(patch.status).toBe(404);
    expect(
      (await call(deleteMedRoute, { method: 'DELETE', cookie: b.cookie, params: { id: med.data.id } })).status,
    ).toBe(404);
    expect((await call(listMedsRoute, { cookie: a.cookie })).data[0].strength).toBe('500 mg');
  });

  it('lets caregivers edit medicines but not members, and family only look', async () => {
    const { cookie, code } = await createCircle();
    const priya = await addHelper(cookie, code, 'Priya', 'caregiver');
    const arjun = await addHelper(cookie, code, 'Arjun', 'family');
    expect((await call(addMedRoute, { cookie: priya.cookie, body: MEDICINE_INPUT })).status).toBe(200);
    expect((await call(listMembersRoute, { cookie: priya.cookie })).status).toBe(403);
    expect((await call(listMedsRoute, { cookie: arjun.cookie })).data).toHaveLength(1);
    const refused = await call(addMedRoute, { cookie: arjun.cookie, body: MEDICINE_INPUT });
    expect(refused).toMatchObject({ status: 403, error: { message: expect.stringContaining('Ask Mr Rao') } });
  });

  it('applies a role change on the very next request', async () => {
    const { cookie, code } = await createCircle();
    const priya = await addHelper(cookie, code, 'Priya', 'caregiver');
    await call(patchMemberRoute, { method: 'PATCH', cookie, params: { id: priya.id }, body: { role: 'family' } });
    expect((await call(addMedRoute, { cookie: priya.cookie, body: MEDICINE_INPUT })).status).toBe(403);
  });

  it('refuses a removed member on the next request and at sign-in', async () => {
    const { cookie, code } = await createCircle();
    const priya = await addHelper(cookie, code, 'Priya', 'caregiver');
    expect((await call(listMedsRoute, { cookie: priya.cookie })).status).toBe(200);
    expect((await call(removeMemberRoute, { method: 'DELETE', cookie, params: { id: priya.id } })).status).toBe(200);
    expect((await call(listMedsRoute, { cookie: priya.cookie })).status).toBe(401);
    const found = await call(lookupRoute, { query: `?code=${code}` });
    expect(found.data.members.map((m: { name: string }) => m.name)).toEqual(['Mr Rao']);
    expect((await call(signInRoute, { body: { code, memberId: priya.id, passcode: '135790' } })).status).toBe(401);
  });

  it('protects the elder role', async () => {
    const { cookie } = await createCircle();
    const members = await call(listMembersRoute, { cookie });
    const elderId = members.data[0].id;
    expect(JSON.stringify(members.data)).not.toContain('passcode');
    expect((await call(removeMemberRoute, { method: 'DELETE', cookie, params: { id: elderId } })).status).toBe(400);
    expect(
      (await call(patchMemberRoute, { method: 'PATCH', cookie, params: { id: elderId }, body: { role: 'family' } }))
        .status,
    ).toBe(400);
    expect((await call(addMemberRoute, { cookie, body: { name: 'Mr Rao', email: null, role: 'family' } })).status).toBe(
      409,
    );
    expect((await call(addMemberRoute, { cookie, body: { name: 'X', email: null, role: 'elder' } })).status).toBe(400);
  });
});
