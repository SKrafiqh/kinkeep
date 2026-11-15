import { beforeEach, describe, expect, it } from 'vitest';
import { GET as activityRoute } from '@/app/api/activity/route';
import { POST as doseActRoute } from '@/app/api/doses/[id]/act/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { DELETE as deleteMedRoute, PATCH as patchMedRoute } from '@/app/api/medications/[id]/route';
import { GET as listMedsRoute, POST as addMedRoute } from '@/app/api/medications/route';
import { POST as addMemberRoute } from '@/app/api/members/route';
import { POST as passcodeRoute } from '@/app/api/passcode/route';
import { GET as lookupRoute } from '@/app/api/circles/lookup/route';
import { POST as signInRoute } from '@/app/api/session/route';
import { MINUTE_MS } from '@/lib/constants';
import { call, createCircle, createWorld, MEDICINE_INPUT, type World } from './helpers';

let world: World;
let cookie: string;
let code: string;

beforeEach(async () => {
  world = createWorld();
  const created = await createCircle();
  cookie = created.cookie;
  code = created.code;
});

const add = (body: unknown = MEDICINE_INPUT, as: string = cookie) => call(addMedRoute, { cookie: as, body });
const patch = (id: string, body: unknown, as: string = cookie) => call(patchMedRoute, { method: 'PATCH', cookie: as, params: { id }, body });
const remove = (id: string, as: string = cookie) => call(deleteMedRoute, { method: 'DELETE', cookie: as, params: { id } });
const feed = async (): Promise<string[]> => (await call(activityRoute, { cookie })).data.map((a: { summary: string }) => a.summary);
const doses = async () => (await call(dosesRoute, { cookie, query: '?date=2026-11-16' })).data.doses as Array<{ id: string; medId: string; dueAt: number; status: string }>;

async function familyCookie(): Promise<string> {
  const added = await call(addMemberRoute, { cookie, body: { name: 'Arjun', email: 'arjun@example.com', role: 'family' } });
  const found = await call(lookupRoute, { query: `?code=${code}` });
  const memberId = found.data.members.find((m: { name: string }) => m.name === 'Arjun').id;
  const first = await call(signInRoute, { body: { code, memberId, passcode: added.data.setupPasscode } });
  const changed = await call(passcodeRoute, { cookie: first.cookie, body: { current: added.data.setupPasscode, passcode: '135790' } });
  return changed.cookie ?? (first.cookie as string);
}

describe('adding and listing medicines', () => {
  it('creates a medicine with an id and its doses', async () => {
    const result = await add();
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ name: 'Metformin', strength: '500 mg', times: ['09:00', '20:00'], active: true });
    expect(result.data.id).toEqual(expect.any(String));
    const today = await doses();
    expect(today.filter((d) => d.medId === result.data.id)).toHaveLength(2);
  });

  it('lists medicines sorted by name', async () => {
    await add({ ...MEDICINE_INPUT, name: 'Zinc' });
    await add({ ...MEDICINE_INPUT, name: 'Amlodipine' });
    await add({ ...MEDICINE_INPUT, name: 'Metformin' });
    const listed = await call(listMedsRoute, { cookie });
    expect(listed.data.map((m: { name: string }) => m.name)).toEqual(['Amlodipine', 'Metformin', 'Zinc']);
  });

  it('trims text fields', async () => {
    const result = await add({ ...MEDICINE_INPUT, name: '  Metformin  ' });
    expect(result.data.name).toBe('Metformin');
  });
});

describe('validation', () => {
  it('rejects an empty name', async () => {
    const result = await add({ ...MEDICINE_INPUT, name: '   ' });
    expect(result).toMatchObject({ status: 400, error: { code: 'VALIDATION', fields: { name: expect.any(String) } } });
  });

  it('rejects an empty list of times', async () => {
    const result = await add({ ...MEDICINE_INPUT, times: [] });
    expect(result).toMatchObject({ status: 400, error: { fields: { times: 'Add at least one time.' } } });
  });

  it('rejects duplicate times', async () => {
    const result = await add({ ...MEDICINE_INPUT, times: ['09:00', '09:00'] });
    expect(result).toMatchObject({ status: 400, error: { fields: { times: 'Each time can be added once.' } } });
  });

  it('rejects a badly formatted time', async () => {
    for (const bad of ['9:00', '24:00', '09:60', 'noon']) {
      const result = await add({ ...MEDICINE_INPUT, times: [bad] });
      expect(result, bad).toMatchObject({ status: 400, error: { fields: { times: 'Choose a time.' } } });
    }
  });

  it('rejects an end date before the start date but accepts the same day', async () => {
    const before = await add({ ...MEDICINE_INPUT, startDate: '2026-11-10', endDate: '2026-11-09' });
    expect(before).toMatchObject({ status: 400, error: { fields: { endDate: 'The end date must be on or after the start date.' } } });
    const same = await add({ ...MEDICINE_INPUT, startDate: '2026-11-10', endDate: '2026-11-10' });
    expect(same.status).toBe(200);
  });

  it('rejects unknown fields, bad days and a bad form', async () => {
    expect((await add({ ...MEDICINE_INPUT, dose: 5 })).status).toBe(400);
    expect((await add({ ...MEDICINE_INPUT, daysOfWeek: [] })).error?.fields).toHaveProperty('daysOfWeek');
    expect((await add({ ...MEDICINE_INPUT, daysOfWeek: [7] })).status).toBe(400);
    expect((await add({ ...MEDICINE_INPUT, form: 'Sorcery' })).error?.fields).toHaveProperty('form');
  });

  it('rejects the same checks on edit and leaves the medicine alone', async () => {
    const { data } = await add();
    const result = await patch(data.id, { ...MEDICINE_INPUT, times: [] });
    expect(result.status).toBe(400);
    expect((await call(listMedsRoute, { cookie })).data[0].times).toEqual(['09:00', '20:00']);
  });

  it('rejects a body that is not JSON', async () => {
    expect((await add('{oops')).status).toBe(400);
  });
});

describe('authorisation and missing medicines', () => {
  it('answers 401 without a session on every method', async () => {
    const { data } = await add();
    expect((await call(listMedsRoute, {})).status).toBe(401);
    expect((await call(addMedRoute, { body: MEDICINE_INPUT })).status).toBe(401);
    expect((await call(patchMedRoute, { method: 'PATCH', params: { id: data.id }, body: MEDICINE_INPUT })).status).toBe(401);
    expect((await call(deleteMedRoute, { method: 'DELETE', params: { id: data.id } })).status).toBe(401);
  });

  it('lets family read but not write', async () => {
    const { data } = await add();
    const family = await familyCookie();
    expect((await call(listMedsRoute, { cookie: family })).status).toBe(200);
    expect((await add(MEDICINE_INPUT, family)).status).toBe(403);
    expect((await patch(data.id, MEDICINE_INPUT, family)).status).toBe(403);
    expect((await remove(data.id, family)).status).toBe(403);
  });

  it('answers 404 for an unknown id', async () => {
    expect((await patch('nope', MEDICINE_INPUT)).status).toBe(404);
    expect((await remove('nope')).status).toBe(404);
  });
});

describe('editing and deleting', () => {
  it('saves an edit and rebuilds future doses', async () => {
    const { data } = await add();
    const edited = await patch(data.id, { ...MEDICINE_INPUT, times: ['10:00'] });
    expect(edited.data.times).toEqual(['10:00']);
    const mine = (await doses()).filter((d) => d.medId === data.id);
    expect(mine).toHaveLength(1);
  });

  it('delete removes future doses but keeps past and taken ones', async () => {
    const { data } = await add({ ...MEDICINE_INPUT, times: ['09:00', '09:05', '20:00'] });
    const nine = (await doses()).find((d) => d.dueAt === Date.UTC(2026, 10, 16, 3, 30));
    expect((await call(doseActRoute, { cookie, params: { id: nine?.id ?? '' }, body: { action: 'taken' } })).status).toBe(200);
    world.time.now = Date.UTC(2026, 10, 16, 3, 40); // 09:10 local: 09:00 and 09:05 are past, 20:00 is ahead
    expect(await remove(data.id)).toMatchObject({ status: 200, data: { deleted: true } });
    const kept = (await doses()).filter((d) => d.medId === data.id);
    expect(kept.map((d) => d.dueAt).sort()).toEqual([Date.UTC(2026, 10, 16, 3, 30), Date.UTC(2026, 10, 16, 3, 35)]);
    expect(kept.find((d) => d.dueAt === Date.UTC(2026, 10, 16, 3, 30))?.status).toBe('taken');
    expect((await call(listMedsRoute, { cookie })).data).toEqual([]);
  });
});

describe('what changed lines', () => {
  it('records add, edit, pause and delete, newest first', async () => {
    world.time.now += MINUTE_MS;
    const { data } = await add();
    world.time.now += MINUTE_MS;
    world.time.now += MINUTE_MS;
    await patch(data.id, { ...MEDICINE_INPUT, strength: '1000 mg' });
    world.time.now += MINUTE_MS;
    await patch(data.id, { ...MEDICINE_INPUT, strength: '1000 mg', active: false });
    world.time.now += MINUTE_MS;
    await remove(data.id);
    expect(await feed()).toEqual([
      'Mr Rao removed Metformin 1000 mg',
      'Mr Rao paused Metformin',
      'Mr Rao changed Metformin from 500 mg to 1000 mg',
      'Mr Rao added Metformin 500 mg, 9:00 am and 8:00 pm, every day',
      'Mr Rao created the circle',
    ]);
  });

  it('says so when nothing changed', async () => {
    const { data } = await add();
    world.time.now += MINUTE_MS;
    await patch(data.id, MEDICINE_INPUT);
    expect((await feed())[0]).toBe('Mr Rao saved Metformin with no changes');
  });
});
