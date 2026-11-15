import { beforeEach, describe, expect, it } from 'vitest';
import { POST as actRoute } from '@/app/api/act/route';
import { POST as addAppointmentRoute } from '@/app/api/appointments/route';
import { POST as tickRoute } from '@/app/api/cron/tick/route';
import { POST as doseActRoute } from '@/app/api/doses/[id]/act/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { PATCH as patchMedRoute } from '@/app/api/medications/[id]/route';
import { POST as addMedRoute } from '@/app/api/medications/route';
import { PATCH as patchMemberRoute } from '@/app/api/members/[id]/route';
import { POST as addMemberRoute } from '@/app/api/members/route';
import { nextWeeklySummaryAt } from '@/domain/summary';
import type { Circle, DoseEvent } from '@/domain/types';
import { HOUR_MS, MINUTE_MS } from '@/lib/constants';
import { previewAction } from '@/server/services/actions';
import { listDay } from '@/server/services/doses';
import { call, CRON_SECRET, createCircle, createWorld, MEDICINE_INPUT, START, type World } from './helpers';

// The circle is created at 08:30; the first dose is due at 09:00.
const DUE = START + 30 * MINUTE_MS;
const ALL_ON = { missedDose: true, appointments: true, weeklySummary: true };

let world: World;
let cookie: string;

const tick = () => call(tickRoute, { method: 'POST', origin: null, headers: { 'x-cron-secret': CRON_SECRET } });
const at = (minutesFromDue: number) => {
  world.time.now = DUE + minutesFromDue * MINUTE_MS;
};
const today = async (): Promise<DoseEvent[]> => (await call(dosesRoute, { cookie, query: '?date=2026-11-16' })).data.doses;
const tokenIn = (text: string): string => /\/act\/([\w.-]+)/.exec(text)?.[1] ?? '';

async function addHelper(name: string, role: 'caregiver' | 'family', alerts = ALL_ON): Promise<string> {
  const added = await call(addMemberRoute, { cookie, body: { name, email: `${name.toLowerCase()}@example.com`, role } });
  await call(patchMemberRoute, { method: 'PATCH', cookie, params: { id: added.data.member.id }, body: { alerts } });
  return added.data.member.id;
}

beforeEach(async () => {
  world = createWorld();
  cookie = (await createCircle()).cookie;
  await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
});

describe('cron authentication', () => {
  it('accepts the shared secret or the scheduler OIDC token, and nothing else', async () => {
    expect((await tick()).status).toBe(200);
    expect((await call(tickRoute, { method: 'POST', origin: null, headers: { authorization: 'Bearer good-oidc' } })).status).toBe(200);
    expect((await call(tickRoute, { method: 'POST', origin: null })).status).toBe(401);
    expect((await call(tickRoute, { method: 'POST', origin: null, headers: { 'x-cron-secret': 'wrong' } })).status).toBe(401);
    expect((await call(tickRoute, { method: 'POST', origin: null, headers: { authorization: 'Bearer forged' } })).status).toBe(401);
  });
});

describe('dose reminders', () => {
  it('sends nothing early, then one email for the whole slot', async () => {
    await call(addMedRoute, { cookie, body: { ...MEDICINE_INPUT, name: 'Amlodipine', strength: '5 mg', times: ['09:00'] } });
    at(-16);
    await tick();
    expect(world.emails).toHaveLength(0);
    at(-15);
    await tick();
    expect(world.emails).toHaveLength(1);
    expect(world.emails[0]).toMatchObject({ to: 'rao@example.com', subject: 'Your 9:00 am medicines (2)' });
    expect(world.emails[0].text).toContain('Metformin 500 mg');
    expect(world.emails[0].text).toContain('Amlodipine 5 mg');
  });

  it('never sends the same stage twice when the tick repeats', async () => {
    at(-15);
    await tick();
    await tick();
    await tick();
    expect(world.emails).toHaveLength(1);
  });

  it('is safe when two ticks overlap', async () => {
    at(-15);
    await Promise.all([tick(), tick(), tick()]);
    expect(world.emails).toHaveLength(1);
  });

  it('nudges the elder, then alerts only the members the elder opted in', async () => {
    await addHelper('Priya', 'caregiver');
    await addHelper('Arjun', 'family', { ...ALL_ON, missedDose: false });
    at(-15);
    await tick();
    at(30);
    await tick();
    expect(world.emails.map((e) => e.to)).toEqual(['rao@example.com', 'rao@example.com']);
    expect(world.emails[1].subject).toBe('Reminder: your 9:00 am medicines are waiting');
    at(60);
    await tick();
    expect(world.emails).toHaveLength(3);
    expect(world.emails[2]).toMatchObject({ to: 'priya@example.com', subject: 'Mr Rao has not confirmed the 9:00 am medicines' });
    expect((await today())[0].status).toBe('missed');
  });

  it('marks the dose missed but emails nobody when every alert is off', async () => {
    await addHelper('Arjun', 'family', { missedDose: false, appointments: false, weeklySummary: false });
    at(60);
    await tick();
    expect(world.emails).toHaveLength(0);
    expect((await today())[0].status).toBe('missed');
  });

  it('goes straight to missed when the engine was down, without a stale reminder', async () => {
    await addHelper('Priya', 'caregiver');
    at(65);
    await tick();
    expect(world.emails.map((e) => e.to)).toEqual(['priya@example.com']);
  });

  it('stops as soon as the dose is confirmed', async () => {
    at(-15);
    await tick();
    const [dose] = await today();
    await call(doseActRoute, { cookie, params: { id: dose.id }, body: { action: 'taken' } });
    at(30);
    await tick();
    at(60);
    await tick();
    expect(world.emails).toHaveLength(1);
    expect((await today())[0]).toMatchObject({ status: 'taken', late: false, nextActionAt: null });
  });

  it('records a dose taken after it was missed as taken late', async () => {
    at(60);
    await tick();
    const [dose] = await today();
    const result = await call(doseActRoute, { cookie, params: { id: dose.id }, body: { action: 'taken' } });
    expect(result.data.doses[0]).toMatchObject({ status: 'taken', late: true });
    expect((await call(doseActRoute, { cookie, params: { id: dose.id }, body: { action: 'skipped' } })).status).toBe(409);
  });

  it('sends reminders to the chosen relative when the elder has no email', async () => {
    world = createWorld();
    cookie = (await createCircle({ name: 'Priya', role: 'caregiver', email: 'priya@example.com' })).cookie;
    await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
    at(-15);
    await tick();
    expect(world.emails[0]).toMatchObject({ to: 'priya@example.com', subject: "Mr Rao's 9:00 am medicines (1)" });
  });
});

describe('failed sends', () => {
  it('retries five minutes later and still sends once', async () => {
    world.mail.failing = true;
    at(-15);
    await tick();
    expect((await today())[0]).toMatchObject({ status: 'scheduled', attempts: 1, nextActionAt: world.time.now + 5 * MINUTE_MS });
    world.mail.failing = false;
    await tick();
    expect(world.emails).toHaveLength(0);
    at(-10);
    await tick();
    await tick();
    expect(world.emails).toHaveLength(1);
    expect((await today())[0].status).toBe('reminded');
  });

  it('gives up after three attempts instead of looping', async () => {
    world.mail.failing = true;
    for (const minute of [-15, -10, -5]) {
      at(minute);
      await tick();
    }
    const [dose] = await today();
    expect(dose).toMatchObject({ status: 'reminded', attempts: 3 });
    // A short code is stored, never the mail server's own words, which can hold an address.
    expect(dose.lastError).toBe('Error');
  });
});

describe('one-tap links', () => {
  async function reminderToken(): Promise<string> {
    at(-15);
    await tick();
    return tokenIn(world.emails[0].text);
  }

  it('shows the confirm page without changing anything', async () => {
    const token = await reminderToken();
    const preview = await previewAction(world.deps, token);
    expect(preview).toMatchObject({ elderName: 'Mr Rao', slotTime: '9:00 am', day: 'Mon 16 Nov', settled: false });
    expect(preview.medicines).toEqual([{ name: 'Metformin', strength: '500 mg' }]);
    expect((await today())[0].status).toBe('reminded');
    expect(await world.deps.store.list('usedTokens')).toEqual([]);
  });

  it('marks the slot on POST, without a session, exactly once', async () => {
    const token = await reminderToken();
    const first = await call(actRoute, { body: { token, action: 'taken' } });
    expect(first).toMatchObject({ status: 200, data: { count: 1 } });
    expect((await today())[0]).toMatchObject({ status: 'taken', actedAt: world.time.now });
    expect((await call(actRoute, { body: { token, action: 'skipped' } })).status).toBe(409);
    expect((await previewAction(world.deps, token)).settled).toBe(true);
  });

  it('rejects forged and expired links', async () => {
    const token = await reminderToken();
    expect((await call(actRoute, { body: { token: `${token.slice(0, -2)}xx`, action: 'taken' } })).status).toBe(401);
    world.time.now = DUE + 24 * HOUR_MS + 1000;
    expect((await call(actRoute, { body: { token, action: 'taken' } })).status).toBe(401);
    expect((await call(actRoute, { body: { token: 'short', action: 'taken' } })).status).toBe(400);
  });

  it('stops working for a member who was removed', async () => {
    world = createWorld();
    const created = await createCircle({ name: 'Priya', role: 'caregiver', email: 'priya@example.com' });
    await call(addMedRoute, { cookie: created.cookie, body: MEDICINE_INPUT });
    at(-15);
    await tick();
    const token = tokenIn(world.emails[0].text);
    const [circle] = await world.deps.store.list<{ id: string; remindersTo: string }>('circles');
    await world.deps.store.update(`circles/${circle.id}/members/${circle.remindersTo}`, { removedAt: world.time.now });
    expect((await call(actRoute, { body: { token, action: 'taken' } })).status).toBe(401);
  });
});

describe('schedules', () => {
  it('creates doses for the next 36 hours when a medicine is added', async () => {
    const day1 = await today();
    const day2 = (await call(dosesRoute, { cookie, query: '?date=2026-11-17' })).data.doses as DoseEvent[];
    expect(day1.map((d) => d.id.slice(-13))).toEqual(['20261116_0900', '20261116_2000']);
    expect(day2).toHaveLength(2);
  });

  it('rebuilds only future unconfirmed doses when a medicine is edited', async () => {
    const [morning] = await today();
    await call(doseActRoute, { cookie, params: { id: morning.id }, body: { action: 'taken' } });
    at(5);
    const edited = await call(patchMedRoute, { method: 'PATCH', cookie, params: { id: morning.medId }, body: { ...MEDICINE_INPUT, strength: '1000 mg', times: ['21:00'] } });
    expect(edited.status).toBe(200);
    const doses = await today();
    expect(doses.map((d) => `${d.id.slice(-4)} ${d.strength} ${d.status}`)).toEqual(['0900 500 mg taken', '2100 1000 mg scheduled']);
  });

  it('removes future doses when a medicine is paused', async () => {
    const [morning] = await today();
    await call(patchMedRoute, { method: 'PATCH', cookie, params: { id: morning.medId }, body: { ...MEDICINE_INPUT, active: false } });
    expect(await today()).toEqual([]);
  });

  it('tops up the horizon from the tick, once', async () => {
    world.time.now = START + 20 * HOUR_MS;
    const first = await tick();
    expect(first.data.materialised).toBeGreaterThan(0);
    expect((await tick()).data.materialised).toBe(0);
    // The 12-hour session has expired by now, so read the day through the service.
    const [circle] = await world.deps.store.list<Circle>('circles');
    expect((await listDay(world.deps, circle, '2026-11-18')).doses.length).toBeGreaterThan(0);
  });
});

describe('appointment reminders and the weekly summary', () => {
  it('reminds 24 hours and 2 hours before, once each', async () => {
    await addHelper('Priya', 'caregiver');
    await addHelper('Arjun', 'family', { ...ALL_ON, appointments: false });
    const visit = await call(addAppointmentRoute, {
      cookie,
      body: { doctor: 'Dr Meera Iyer', speciality: 'Cardiology', place: 'Sunrise Clinic', date: '2026-11-19', time: '10:30', notes: '' },
    });
    const visitAt = visit.data.at as number;
    world.emails.length = 0;
    world.time.now = visitAt - 24 * HOUR_MS;
    await tick();
    await tick();
    const dayBefore = world.emails.filter((e) => e.subject.startsWith('Coming up'));
    expect(dayBefore.map((e) => e.to).sort()).toEqual(['priya@example.com', 'rao@example.com']);
    expect(dayBefore[0].subject).toBe('Coming up: Dr Meera Iyer, Thu 19 Nov 10:30 am');
    world.time.now = visitAt - 2 * HOUR_MS;
    await tick();
    await tick();
    expect(world.emails.filter((e) => e.subject.startsWith('Soon'))).toHaveLength(2);
  });

  it('sends the Sunday summary once to the elder and opted-in members', async () => {
    await addHelper('Priya', 'caregiver');
    await addHelper('Arjun', 'family', { ...ALL_ON, weeklySummary: false });
    world.time.now = nextWeeklySummaryAt(START, 'Asia/Kolkata');
    await tick();
    await tick();
    const summaries = world.emails.filter((e) => e.subject === "Mr Rao's week in medicines");
    expect(summaries.map((e) => e.to).sort()).toEqual(['priya@example.com', 'rao@example.com']);
    expect(summaries[0].text).toContain('doses this week');
  });
});
