import { beforeEach, describe, expect, it } from 'vitest';
import { GET as activityRoute } from '@/app/api/activity/route';
import { DELETE as removeMemberRoute, PATCH as patchMemberRoute } from '@/app/api/members/[id]/route';
import { GET as listMembersRoute, POST as addMemberRoute } from '@/app/api/members/route';
import { MINUTE_MS } from '@/lib/constants';
import { call, createCircle, createWorld, type World } from './helpers';

interface MemberView {
  id: string;
  name: string;
  email: string | null;
  role: string;
  alerts: { missedDose: boolean; appointments: boolean; weeklySummary: boolean };
  mustChangePasscode: boolean;
  receivesElderReminders: boolean;
}

let world: World;
let cookie: string;

beforeEach(async () => {
  world = createWorld();
  cookie = (await createCircle()).cookie;
});

// Each change moves the clock on, so the activity feed has a strict newest-first order.
const tick = (): void => {
  world.time.now += MINUTE_MS;
};
const add = (body: unknown) => (tick(), call(addMemberRoute, { cookie, body }));
const patch = (id: string, body: unknown) => (
  tick(),
  call(patchMemberRoute, { method: 'PATCH', cookie, params: { id }, body })
);
const remove = (id: string) => (tick(), call(removeMemberRoute, { method: 'DELETE', cookie, params: { id } }));
const members = async (): Promise<MemberView[]> => (await call(listMembersRoute, { cookie })).data;
const member = async (id: string): Promise<MemberView | undefined> => (await members()).find((m) => m.id === id);
const feed = async (): Promise<string[]> =>
  (await call(activityRoute, { cookie })).data.map((a: { summary: string }) => a.summary);
const addPriya = async (): Promise<string> =>
  (await add({ name: 'Priya', email: 'priya@example.com', role: 'caregiver' })).data.member.id;

describe('adding members', () => {
  it('starts every alert off, requires a passcode change and hands back a six-digit setup passcode', async () => {
    const result = await add({ name: 'Priya', email: 'priya@example.com', role: 'caregiver' });
    expect(result.status).toBe(200);
    expect(result.data.setupPasscode).toMatch(/^\d{6}$/);
    expect(result.data.member).toMatchObject({
      name: 'Priya',
      email: 'priya@example.com',
      role: 'caregiver',
      alerts: { missedDose: false, appointments: false, weeklySummary: false },
      mustChangePasscode: true,
      receivesElderReminders: false,
    });
    expect(JSON.stringify(result.data.member)).not.toMatch(/passcode(Hash|Salt)/);
  });

  it('allows a member without an email and lowercases the email', async () => {
    expect((await add({ name: 'Arjun', email: null, role: 'family' })).data.member.email).toBeNull();
    expect((await add({ name: 'Meena', email: 'MEENA@Example.COM', role: 'family' })).data.member.email).toBe(
      'meena@example.com',
    );
  });

  it('lists members sorted by name, without secrets', async () => {
    await add({ name: 'Zara', email: null, role: 'family' });
    await add({ name: 'Arjun', email: null, role: 'family' });
    const listed = await members();
    expect(listed.map((m) => m.name)).toEqual(['Arjun', 'Mr Rao', 'Zara']);
    expect(JSON.stringify(listed)).not.toMatch(/passcode(Hash|Salt)|setupPasscode/);
  });

  it('rejects bad input field by field, unknown fields and the elder role', async () => {
    const bad = await add({ name: ' ', email: 'nope', role: 'family' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.error?.fields ?? {}).sort()).toEqual(['email', 'name']);
    expect((await add({ name: 'X', email: null, role: 'family', passcode: '123456' })).status).toBe(400);
    expect((await add({ name: 'X', email: null, role: 'elder' })).status).toBe(400);
  });

  it('refuses a duplicate name ignoring case', async () => {
    await addPriya();
    const dup = await add({ name: 'PRIYA', email: null, role: 'family' });
    expect(dup).toMatchObject({ status: 409, error: { code: 'CONFLICT', fields: { name: expect.any(String) } } });
  });
});

describe('changing alert switches', () => {
  it.each([
    ['missedDose', 'turned on missed-dose alerts for Priya'],
    ['appointments', 'turned on appointment reminders for Priya'],
    ['weeklySummary', 'turned on the weekly summary for Priya'],
  ] as const)('turns %s on and off on its own', async (key, line) => {
    const id = await addPriya();
    const off = { missedDose: false, appointments: false, weeklySummary: false };
    const on = await patch(id, { alerts: { ...off, [key]: true } });
    expect(on.data.alerts).toEqual({ ...off, [key]: true });
    expect((await member(id))?.alerts).toEqual({ ...off, [key]: true });
    expect((await feed())[0]).toBe(`Mr Rao ${line}`);
    await patch(id, { alerts: off });
    expect((await feed())[0]).toBe(`Mr Rao ${line.replace('turned on', 'turned off')}`);
  });

  it('rejects a partial or unknown alerts object', async () => {
    const id = await addPriya();
    expect((await patch(id, { alerts: { missedDose: true } })).status).toBe(400);
    expect(
      (await patch(id, { alerts: { missedDose: true, appointments: true, weeklySummary: true, sms: true } })).status,
    ).toBe(400);
  });
});

describe('changing name, email and role', () => {
  it('renames and records it', async () => {
    const id = await addPriya();
    const result = await patch(id, { name: 'Priya Sharma' });
    expect(result.data.name).toBe('Priya Sharma');
    expect((await feed())[0]).toBe('Mr Rao renamed Priya to Priya Sharma');
  });

  it('refuses a rename to another member name with 409, but allows keeping your own', async () => {
    const id = await addPriya();
    await add({ name: 'Arjun', email: null, role: 'family' });
    expect(await patch(id, { name: 'arjun' })).toMatchObject({
      status: 409,
      error: { fields: { name: expect.any(String) } },
    });
    expect((await patch(id, { name: 'Priya' })).status).toBe(200);
    expect((await member(id))?.name).toBe('Priya');
  });

  it('changes and clears the email', async () => {
    const id = await addPriya();
    expect((await patch(id, { email: 'new@example.com' })).data.email).toBe('new@example.com');
    expect((await feed())[0]).toBe("Mr Rao updated Priya's email");
    expect((await patch(id, { email: null })).data.email).toBeNull();
  });

  it('changes the role between caregiver and family and records it', async () => {
    const id = await addPriya();
    expect((await patch(id, { role: 'family' })).data.role).toBe('family');
    expect((await feed())[0]).toBe("Mr Rao changed Priya's role from caregiver to family");
    expect((await patch(id, { role: 'elder' })).status).toBe(400);
  });

  it('rejects unknown fields and a bad email', async () => {
    const id = await addPriya();
    expect((await patch(id, { passcode: '123456' })).status).toBe(400);
    expect((await patch(id, { mustChangePasscode: false })).status).toBe(400);
    expect((await patch(id, { email: 'nope' })).error?.fields).toHaveProperty('email');
  });

  it('answers 404 for an unknown or removed member', async () => {
    const id = await addPriya();
    await remove(id);
    expect((await patch('nope', { name: 'X' })).status).toBe(404);
    expect((await patch(id, { name: 'X' })).status).toBe(404);
    expect((await remove(id)).status).toBe(404);
  });
});

describe('who receives the elder reminders', () => {
  it('needs an email address', async () => {
    const id = (await add({ name: 'Arjun', email: null, role: 'family' })).data.member.id;
    const result = await patch(id, { receivesElderReminders: true });
    expect(result).toMatchObject({ status: 400, error: { fields: { email: expect.any(String) } } });
    expect((await member(id))?.receivesElderReminders).toBe(false);
  });

  it('accepts the email in the same request', async () => {
    const id = (await add({ name: 'Arjun', email: null, role: 'family' })).data.member.id;
    const result = await patch(id, { email: 'arjun@example.com', receivesElderReminders: true });
    expect(result.data.receivesElderReminders).toBe(true);
  });

  it('moves reminders to the member, then to another member, then back', async () => {
    const priya = await addPriya();
    const arjun = (await add({ name: 'Arjun', email: 'arjun@example.com', role: 'family' })).data.member.id;
    expect((await patch(priya, { receivesElderReminders: true })).data.receivesElderReminders).toBe(true);
    expect((await feed())[0]).toBe('Mr Rao chose Priya to receive the dose reminders');
    await patch(arjun, { receivesElderReminders: true });
    expect((await member(priya))?.receivesElderReminders).toBe(false);
    expect((await member(arjun))?.receivesElderReminders).toBe(true);
    expect((await patch(arjun, { receivesElderReminders: false })).data.receivesElderReminders).toBe(false);
    expect((await feed())[0]).toBe('Arjun no longer receives the dose reminders');
    expect((await members()).some((m) => m.receivesElderReminders)).toBe(false);
  });

  it('is cleared when the receiver loses their email', async () => {
    const id = await addPriya();
    await patch(id, { receivesElderReminders: true });
    expect((await patch(id, { email: null })).data.receivesElderReminders).toBe(false);
  });

  it('is cleared when the receiver is removed', async () => {
    const id = await addPriya();
    await patch(id, { receivesElderReminders: true });
    expect((await remove(id)).data).toEqual({ removed: true });
    const [circle] = await world.deps.store.list<{ remindersTo: string | null }>('circles');
    expect(circle.remindersTo).toBeNull();
  });
});

describe('removing members and activity', () => {
  it('records the removal and drops the member from the list', async () => {
    const id = await addPriya();
    await remove(id);
    expect((await members()).map((m) => m.name)).toEqual(['Mr Rao']);
    expect((await feed())[0]).toBe('Mr Rao removed Priya from the circle');
  });

  it('records the add', async () => {
    await add({ name: 'Priya', email: null, role: 'caregiver' });
    await add({ name: 'Arjun', email: null, role: 'family' });
    const lines = await feed();
    expect(lines).toContain('Mr Rao added Priya as a caregiver');
    expect(lines).toContain('Mr Rao added Arjun as family');
  });

  it('records nothing when a save changes nothing', async () => {
    const id = await addPriya();
    const before = (await feed()).length;
    await patch(id, { name: 'Priya' });
    expect(await feed()).toHaveLength(before);
  });

  it('answers 401 without a session', async () => {
    const id = await addPriya();
    expect((await call(listMembersRoute, {})).status).toBe(401);
    expect((await call(addMemberRoute, { body: { name: 'X', email: null, role: 'family' } })).status).toBe(401);
    expect((await call(patchMemberRoute, { method: 'PATCH', params: { id }, body: { name: 'X' } })).status).toBe(401);
    expect((await call(removeMemberRoute, { method: 'DELETE', params: { id } })).status).toBe(401);
  });
});
