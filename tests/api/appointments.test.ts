import { beforeEach, describe, expect, it } from 'vitest';
import { GET as activityRoute } from '@/app/api/activity/route';
import { DELETE as deleteAppointmentRoute, PATCH as patchAppointmentRoute } from '@/app/api/appointments/[id]/route';
import { GET as listAppointmentsRoute, POST as addAppointmentRoute } from '@/app/api/appointments/route';
import { GET as lookupRoute } from '@/app/api/circles/lookup/route';
import { POST as addMemberRoute } from '@/app/api/members/route';
import { POST as passcodeRoute } from '@/app/api/passcode/route';
import { POST as signInRoute } from '@/app/api/session/route';
import { first } from '@/lib/arrays';
import { HOUR_MS, MINUTE_MS } from '@/lib/constants';
import { paths } from '@/server/repos/paths';
import { call, createCircle, createWorld, type World } from './helpers';

const APPOINTMENT = {
  doctor: 'Dr Mehta',
  speciality: 'Cardiology',
  place: 'City Clinic',
  date: '2026-11-19',
  time: '10:30',
  notes: 'Bring reports',
};
/** 19 Nov 2026 10:30 in Asia/Kolkata (UTC+5:30). */
const APPOINTMENT_AT = Date.UTC(2026, 10, 19, 5, 0);

let world: World;
let cookie: string;
let code: string;
let circleId: string;

beforeEach(async () => {
  world = createWorld();
  const created = await createCircle();
  cookie = created.cookie;
  code = created.code;
  circleId = first(await world.deps.store.list<{ id: string }>('circles')).id;
});

const add = (body: unknown = APPOINTMENT, as: string = cookie) => call(addAppointmentRoute, { cookie: as, body });
const patch = (id: string, body: unknown, as: string = cookie) =>
  call(patchAppointmentRoute, { method: 'PATCH', cookie: as, params: { id }, body });
const remove = (id: string, as: string = cookie) =>
  call(deleteAppointmentRoute, { method: 'DELETE', cookie: as, params: { id } });
const feed = async (): Promise<string[]> =>
  (await call(activityRoute, { cookie })).data.map((a: { summary: string }) => a.summary);

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

describe('creating and listing appointments', () => {
  it('stores the local date and time as a UTC instant and queues the 24 hour reminder', async () => {
    const result = await add();
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      doctor: 'Dr Mehta',
      at: APPOINTMENT_AT,
      remindersSent: { h24: false, h2: false },
      nextReminderAt: APPOINTMENT_AT - 24 * HOUR_MS,
      brief: null,
    });
    expect(result.data).not.toHaveProperty('date');
    expect(result.data).not.toHaveProperty('time');
  });

  it('lists appointments by time, soonest first', async () => {
    await add({ ...APPOINTMENT, doctor: 'Late', date: '2026-12-01' });
    await add({ ...APPOINTMENT, doctor: 'Early', date: '2026-11-18' });
    await add({ ...APPOINTMENT, doctor: 'Middle', date: '2026-11-25' });
    const listed = await call(listAppointmentsRoute, { cookie });
    expect(listed.data.map((a: { doctor: string }) => a.doctor)).toEqual(['Early', 'Middle', 'Late']);
  });

  it('skips the 24 hour reminder when the visit is less than 2 hours away', async () => {
    const soon = await add({ ...APPOINTMENT, date: '2026-11-16', time: '10:00' });
    expect(soon.data.nextReminderAt).toBe(soon.data.at - 2 * HOUR_MS);
  });
});

describe('validation', () => {
  it('rejects a missing doctor, bad date and bad time field by field', async () => {
    const result = await add({ ...APPOINTMENT, doctor: ' ', date: '2026-13-40', time: '25:00' });
    expect(result.status).toBe(400);
    expect(Object.keys(result.error?.fields ?? {}).sort()).toEqual(['date', 'doctor', 'time']);
  });

  it('rejects unknown fields and over-long notes', async () => {
    expect((await add({ ...APPOINTMENT, at: 1 })).status).toBe(400);
    expect((await add({ ...APPOINTMENT, notes: 'x'.repeat(1001) })).error?.fields).toHaveProperty('notes');
  });

  it('rejects the same on edit and leaves the appointment unchanged', async () => {
    const { data } = await add();
    expect((await patch(data.id, { ...APPOINTMENT, doctor: '' })).status).toBe(400);
    expect((await call(listAppointmentsRoute, { cookie })).data[0].doctor).toBe('Dr Mehta');
  });
});

describe('authorisation and missing appointments', () => {
  it('answers 401 without a session', async () => {
    const { data } = await add();
    expect((await call(listAppointmentsRoute, {})).status).toBe(401);
    expect((await call(addAppointmentRoute, { body: APPOINTMENT })).status).toBe(401);
    expect(
      (await call(patchAppointmentRoute, { method: 'PATCH', params: { id: data.id }, body: APPOINTMENT })).status,
    ).toBe(401);
    expect((await call(deleteAppointmentRoute, { method: 'DELETE', params: { id: data.id } })).status).toBe(401);
  });

  it('lets family read but answers 403 to every write', async () => {
    const { data } = await add();
    const family = await familyCookie();
    expect((await call(listAppointmentsRoute, { cookie: family })).data).toHaveLength(1);
    expect((await add(APPOINTMENT, family)).status).toBe(403);
    expect((await patch(data.id, APPOINTMENT, family)).status).toBe(403);
    expect((await remove(data.id, family)).status).toBe(403);
  });

  it('answers 404 for an unknown id', async () => {
    expect((await patch('nope', APPOINTMENT)).status).toBe(404);
    expect((await remove('nope')).status).toBe(404);
  });
});

describe('editing and deleting', () => {
  it('moving the time resets the reminders', async () => {
    const { data } = await add();
    await world.deps.store.update(paths.appointment(circleId, data.id), {
      remindersSent: { h24: true, h2: true },
      nextReminderAt: null,
    });
    const moved = await patch(data.id, { ...APPOINTMENT, date: '2026-11-20' });
    expect(moved.data).toMatchObject({
      at: APPOINTMENT_AT + 24 * HOUR_MS,
      remindersSent: { h24: false, h2: false },
      nextReminderAt: APPOINTMENT_AT,
    });
  });

  it('keeps the reminder state when only the notes change', async () => {
    const { data } = await add();
    await world.deps.store.update(paths.appointment(circleId, data.id), {
      remindersSent: { h24: true, h2: false },
      nextReminderAt: APPOINTMENT_AT - 2 * HOUR_MS,
    });
    const edited = await patch(data.id, { ...APPOINTMENT, notes: 'Ask about dizziness' });
    expect(edited.data).toMatchObject({
      notes: 'Ask about dizziness',
      remindersSent: { h24: true, h2: false },
      nextReminderAt: APPOINTMENT_AT - 2 * HOUR_MS,
    });
  });

  it('deletes the appointment', async () => {
    const { data } = await add();
    expect(await remove(data.id)).toMatchObject({ status: 200, data: { deleted: true } });
    expect((await call(listAppointmentsRoute, { cookie })).data).toEqual([]);
  });
});

describe('what changed lines', () => {
  it('records add, update, move and cancel, newest first', async () => {
    world.time.now += MINUTE_MS;
    const { data } = await add();
    world.time.now += MINUTE_MS;
    await patch(data.id, { ...APPOINTMENT, notes: 'New notes' });
    world.time.now += MINUTE_MS;
    await patch(data.id, { ...APPOINTMENT, notes: 'New notes', time: '11:00' });
    world.time.now += MINUTE_MS;
    await remove(data.id);
    expect(await feed()).toEqual([
      'Mr Rao cancelled the appointment with Dr Mehta on Thu 19 Nov 11:00 am',
      'Mr Rao moved the appointment with Dr Mehta to Thu 19 Nov 11:00 am',
      'Mr Rao updated the appointment with Dr Mehta',
      'Mr Rao added an appointment with Dr Mehta on Thu 19 Nov 10:30 am',
      'Mr Rao created the circle',
    ]);
  });
});
