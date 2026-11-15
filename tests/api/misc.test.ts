import { beforeEach, describe, expect, it } from 'vitest';
import { POST as actRoute } from '@/app/api/act/route';
import { GET as activityRoute } from '@/app/api/activity/route';
import { POST as demoRoute } from '@/app/api/circles/demo/route';
import { GET as lookupRoute } from '@/app/api/circles/lookup/route';
import { POST as doseActRoute } from '@/app/api/doses/[id]/act/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { GET as healthRoute } from '@/app/api/health/route';
import { POST as addMedRoute } from '@/app/api/medications/route';
import { POST as addMemberRoute } from '@/app/api/members/route';
import { POST as passcodeRoute } from '@/app/api/passcode/route';
import { POST as signInRoute } from '@/app/api/session/route';
import { POST as testReminderRoute } from '@/app/api/test-reminder/route';
import { MINUTE_MS } from '@/lib/constants';
import { call, createCircle, createWorld, MEDICINE_INPUT, type World } from './helpers';

let world: World;
let cookie: string;
let code: string;

interface Dose {
  id: string;
  medName: string;
  dueAt: number;
  status: string;
}

beforeEach(async () => {
  world = createWorld();
  const created = await createCircle();
  cookie = created.cookie;
  code = created.code;
});

async function familyCookie(): Promise<string> {
  const added = await call(addMemberRoute, {
    cookie,
    body: { name: 'Arjun', email: 'arjun@example.com', role: 'family' },
  });
  const found = await call(lookupRoute, { query: `?code=${code}` });
  const memberId = found.data.members.find((m: { name: string }) => m.name === 'Arjun').id;
  const first = await call(signInRoute, { body: { code, memberId, passcode: added.data.setupPasscode } });
  const changed = await call(passcodeRoute, {
    cookie: first.cookie,
    body: { current: added.data.setupPasscode, passcode: '135790' },
  });
  return changed.cookie ?? (first.cookie as string);
}

const today = async (as: string = cookie): Promise<Dose[]> =>
  (await call(dosesRoute, { cookie: as, query: '?date=2026-11-16' })).data.doses;

describe('GET /api/health', () => {
  it('answers ok without a session', async () => {
    expect(await call(async () => healthRoute(), {})).toMatchObject({ status: 200, data: { status: 'ok' } });
  });
});

describe('GET /api/activity', () => {
  it('answers 401 without a session', async () => {
    expect((await call(activityRoute, {})).status).toBe(401);
  });

  it('lists newest first', async () => {
    world.time.now += MINUTE_MS;
    await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
    world.time.now += MINUTE_MS;
    await call(addMedRoute, { cookie, body: { ...MEDICINE_INPUT, name: 'Aspirin', strength: '75 mg' } });
    const feed = (await call(activityRoute, { cookie })).data as Array<{ at: number; summary: string }>;
    expect(feed.map((item) => item.summary)).toEqual([
      expect.stringContaining('added Aspirin'),
      expect.stringContaining('added Metformin'),
      'Mr Rao created the circle',
    ]);
    expect(feed.map((item) => item.at)).toEqual([...feed.map((item) => item.at)].sort((a, b) => b - a));
  });
});

describe('GET /api/doses', () => {
  it('answers 401 without a session', async () => {
    expect((await call(dosesRoute, {})).status).toBe(401);
  });

  it('rejects a bad date', async () => {
    for (const bad of ['?date=tomorrow', '?date=2026-02-30', '?date=']) {
      expect((await call(dosesRoute, { cookie, query: bad })).status, bad).toBe(400);
    }
    expect((await call(dosesRoute, { cookie, query: '?day=2026-11-16' })).status).toBe(400);
  });

  it('defaults to today in the circle time zone', async () => {
    await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
    const result = await call(dosesRoute, { cookie });
    expect(result.data.date).toBe('2026-11-16');
    expect(result.data.doses).toHaveLength(2);
    const other = await call(dosesRoute, { cookie, query: '?date=2026-11-20' });
    expect(other.data.doses).toEqual([]);
  });
});

describe('POST /api/doses/[id]/act', () => {
  const act = (id: string, body: unknown, as: string = cookie) =>
    call(doseActRoute, { cookie: as, params: { id }, body });

  async function twoAtNineOneAtEight(): Promise<Dose[]> {
    await call(addMedRoute, { cookie, body: { ...MEDICINE_INPUT, name: 'Metformin', times: ['09:00'] } });
    await call(addMedRoute, {
      cookie,
      body: { ...MEDICINE_INPUT, name: 'Aspirin', strength: '75 mg', times: ['09:00', '20:00'] },
    });
    return today();
  }

  it('marks one dose when slot is not set', async () => {
    const doses = await twoAtNineOneAtEight();
    const metformin = doses.find((d) => d.medName === 'Metformin');
    const result = await act(metformin?.id ?? '', { action: 'taken' });
    expect(result.data.doses).toHaveLength(1);
    const after = await today();
    expect(after.filter((d) => d.status === 'taken').map((d) => d.medName)).toEqual(['Metformin']);
  });

  it('marks every dose due at the same time when slot is true', async () => {
    const doses = await twoAtNineOneAtEight();
    const metformin = doses.find((d) => d.medName === 'Metformin');
    const result = await act(metformin?.id ?? '', { action: 'skipped', slot: true });
    expect(result.data.doses).toHaveLength(2);
    const after = await today();
    expect(
      after
        .filter((d) => d.status === 'skipped')
        .map((d) => d.medName)
        .sort(),
    ).toEqual(['Aspirin', 'Metformin']);
    expect(after.find((d) => d.dueAt === Date.UTC(2026, 10, 16, 14, 30))?.status).not.toBe('skipped');
  });

  it('answers 409 when the dose was already marked', async () => {
    const doses = await twoAtNineOneAtEight();
    const id = doses[0].id;
    await act(id, { action: 'taken' });
    expect((await act(id, { action: 'taken' })).status).toBe(409);
  });

  it('rejects a bad action and unknown fields', async () => {
    const doses = await twoAtNineOneAtEight();
    expect((await act(doses[0].id, { action: 'snore' })).status).toBe(400);
    expect((await act(doses[0].id, { action: 'taken', extra: 1 })).status).toBe(400);
  });

  it('answers 403 to family, 401 to anonymous callers and 404 for an unknown dose', async () => {
    const doses = await twoAtNineOneAtEight();
    expect((await act(doses[0].id, { action: 'taken' }, await familyCookie())).status).toBe(403);
    expect((await call(doseActRoute, { params: { id: doses[0].id }, body: { action: 'taken' } })).status).toBe(401);
    expect((await act('nope', { action: 'taken' })).status).toBe(404);
  });
});

describe('POST /api/circles/demo', () => {
  const demo = (body: unknown = { timeZone: 'Asia/Kolkata' }, ip?: string) => call(demoRoute, { body, ip });

  it('seeds a full circle and signs in as the elder', async () => {
    const result = await demo();
    expect(result).toMatchObject({
      status: 200,
      data: { home: '/today', code: expect.stringMatching(/^[A-Z2-9]{6}$/) },
    });
    expect(result.cookie).toMatch(/^kk_session=/);
    const circles = await world.deps.store.list<{ id: string; demoPasscode: string | null; code: string }>('circles');
    const circle = circles.find((c) => c.code === result.data.code);
    if (!circle) throw new Error('demo circle was not stored');
    expect(circle.demoPasscode).toMatch(/^\d{6}$/);
    const count = async (name: string) => (await world.deps.store.list(`circles/${circle.id}/${name}`)).length;
    expect(await count('members')).toBe(3);
    expect(await count('medications')).toBe(4);
    expect(await count('appointments')).toBe(3);
    expect(await count('activity')).toBe(4);
    expect(await count('doseEvents')).toBeGreaterThan(100);
  });

  it('gives the session cookie access to the demo data', async () => {
    const { cookie: demoCookie } = await demo();
    const feed = (await call(activityRoute, { cookie: demoCookie })).data as Array<{ summary: string }>;
    expect(feed[0].summary).toBe('Priya changed Metformin from 500 mg to 1000 mg');
  });

  it('has a dose due within the next five minutes', async () => {
    const { cookie: demoCookie } = await demo();
    const doses = await today(demoCookie);
    const soon = doses.filter((d) => d.dueAt > world.time.now && d.dueAt <= world.time.now + 5 * MINUTE_MS);
    expect(soon.length).toBeGreaterThanOrEqual(1);
    expect(soon.every((d) => d.status !== 'taken')).toBe(true);
  });

  it('keeps one demo apart from the next', async () => {
    const first = await demo();
    const second = await demo();
    expect(first.data.code).not.toBe(second.data.code);
    expect((await world.deps.store.list('circles')).length).toBe(3);
  });

  it('rejects an invalid or missing time zone and unknown fields', async () => {
    expect(await demo({ timeZone: 'Mars/Olympus' })).toMatchObject({
      status: 400,
      error: { fields: { timeZone: expect.any(String) } },
    });
    expect((await demo({})).status).toBe(400);
    expect((await demo({ timeZone: 'Asia/Kolkata', admin: true })).status).toBe(400);
  });

  it('is rate limited after three from one address, but not for another address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await demo(undefined, '198.51.100.30')).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect((await demo(undefined, '198.51.100.31')).status).toBe(200);
  });
});

describe('POST /api/test-reminder', () => {
  const send = (body: unknown = { email: 'me@example.com' }, as: string = cookie, ip?: string) =>
    call(testReminderRoute, { cookie: as, body, ip });

  it('sends one email with a working one-tap link when a dose is open', async () => {
    await call(addMedRoute, { cookie, body: { ...MEDICINE_INPUT, times: ['09:00'] } });
    const result = await send();
    expect(result).toMatchObject({ status: 200, data: { withActions: true } });
    expect(world.emails).toHaveLength(1);
    const [email] = world.emails;
    expect(email.to).toBe('me@example.com');
    expect(email.text).toContain('Metformin');
    const token = /\/act\/([\w.-]+)/.exec(email.text)?.[1];
    expect(token).toBeTruthy();
    expect(email.html).toContain('/act/');
    const acted = await call(actRoute, { body: { token, action: 'taken' }, ip: '198.51.100.40' });
    expect(acted.status).toBe(200);
    expect((await today()).every((d) => d.status === 'taken')).toBe(true);
  });

  it('sends the sample email without an act link when no dose is open', async () => {
    const result = await send();
    expect(result.data).toEqual({ withActions: false });
    expect(world.emails).toHaveLength(1);
    expect(world.emails[0].subject).toBe('Your test reminder');
    expect(world.emails[0].text).not.toContain('/act/');
    expect(world.emails[0].html).not.toContain('/act/');
  });

  it('lowercases the address and rejects an invalid or unknown input', async () => {
    expect((await send({ email: 'ME@Example.COM' })).status).toBe(200);
    expect(world.emails[0].to).toBe('me@example.com');
    expect(await send({ email: 'not-an-email' }, cookie, '198.51.100.50')).toMatchObject({
      status: 400,
      error: { fields: { email: expect.any(String) } },
    });
    expect((await send({ email: 'a@b.co', cc: 'x@y.co' }, cookie, '198.51.100.51')).status).toBe(400);
    expect((await send({}, cookie, '198.51.100.52')).status).toBe(400);
    expect(world.emails).toHaveLength(1);
  });

  it('answers 403 to family and 401 to anonymous callers, and sends nothing', async () => {
    expect((await send(undefined, await familyCookie())).status).toBe(403);
    expect((await send(undefined, '')).status).toBe(401);
    expect(world.emails).toHaveLength(0);
  });

  it('gives a friendly 500 when the mail server fails', async () => {
    world.mail.failing = true;
    const result = await send();
    expect(result.status).toBe(500);
    expect(result.error?.message).toBe('We could not send that email. Check the address and try again in a minute.');
    expect(JSON.stringify(result.error)).not.toContain('mail server unavailable');
  });

  it('is rate limited after three sends', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await send()).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(world.emails).toHaveLength(3);
  });
});
