import { beforeEach, describe, expect, it } from 'vitest';
import { POST as actRoute } from '@/app/api/act/route';
import { POST as addAppointmentRoute } from '@/app/api/appointments/route';
import { POST as doseActRoute } from '@/app/api/doses/[id]/act/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { PATCH as patchMedRoute } from '@/app/api/medications/[id]/route';
import { nextWeeklySummaryAt } from '@/domain/summary';
import type { Circle, DoseEvent } from '@/domain/types';
import { first } from '@/lib/arrays';
import { HOUR_MS } from '@/lib/constants';
import { previewAction } from '@/server/services/actions';
import { listDay } from '@/server/services/doses';
import { addHelper, ALL_ON, at, cookie, DUE, setUpEngine, tick, today, tokenIn, world } from './engineWorld';
import { call, MEDICINE_INPUT, START } from './helpers';

beforeEach(() => setUpEngine());

describe('one-tap links', () => {
  async function reminderToken(): Promise<string> {
    at(-15);
    await tick();
    return tokenIn(first(world.emails).text);
  }

  it('shows the confirm page without changing anything', async () => {
    const token = await reminderToken();
    const preview = await previewAction(world.deps, token);
    expect(preview).toMatchObject({ elderName: 'Mr Rao', slotTime: '9:00 am', day: 'Mon 16 Nov', settled: false });
    expect(preview.medicines).toEqual([{ name: 'Metformin', strength: '500 mg' }]);
    expect(first(await today()).status).toBe('reminded');
    expect(await world.deps.store.list('usedTokens')).toEqual([]);
  });

  it('marks the slot on POST, without a session, exactly once', async () => {
    const token = await reminderToken();
    const firstTap = await call(actRoute, { body: { token, action: 'taken' } });
    expect(firstTap).toMatchObject({ status: 200, data: { count: 1 } });
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
    await setUpEngine({ name: 'Priya', role: 'caregiver', email: 'priya@example.com' });
    at(-15);
    await tick();
    const token = tokenIn(first(world.emails).text);
    const circle = first(await world.deps.store.list<{ id: string; remindersTo: string }>('circles'));
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
    const morning = first(await today());
    await call(doseActRoute, { cookie, params: { id: morning.id }, body: { action: 'taken' } });
    at(5);
    const edited = await call(patchMedRoute, {
      method: 'PATCH',
      cookie,
      params: { id: morning.medId },
      body: { ...MEDICINE_INPUT, strength: '1000 mg', times: ['21:00'] },
    });
    expect(edited.status).toBe(200);
    const doses = await today();
    expect(doses.map((d) => `${d.id.slice(-4)} ${d.strength} ${d.status}`)).toEqual([
      '0900 500 mg taken',
      '2100 1000 mg scheduled',
    ]);
  });

  it('removes future doses when a medicine is paused', async () => {
    const morning = first(await today());
    await call(patchMedRoute, {
      method: 'PATCH',
      cookie,
      params: { id: morning.medId },
      body: { ...MEDICINE_INPUT, active: false },
    });
    expect(await today()).toEqual([]);
  });

  it('tops up the horizon from the tick, once', async () => {
    world.time.now = START + 20 * HOUR_MS;
    const firstTick = await tick();
    expect(firstTick.data.materialised).toBeGreaterThan(0);
    expect((await tick()).data.materialised).toBe(0);
    // The 12-hour session has expired by now, so read the day through the service.
    const circle = first(await world.deps.store.list<Circle>('circles'));
    expect((await listDay(world.deps, circle, '2026-11-18')).doses.length).toBeGreaterThan(0);
  });
});

describe('appointment reminders and the weekly summary', () => {
  it('reminds 24 hours and 2 hours before, once each', async () => {
    await addHelper('Priya', 'caregiver');
    await addHelper('Arjun', 'family', { ...ALL_ON, appointments: false });
    const visit = await call(addAppointmentRoute, {
      cookie,
      body: {
        doctor: 'Dr Meera Iyer',
        speciality: 'Cardiology',
        place: 'Sunrise Clinic',
        date: '2026-11-19',
        time: '10:30',
        notes: '',
      },
    });
    const visitAt = visit.data.at as number;
    world.emails.length = 0;
    world.time.now = visitAt - 24 * HOUR_MS;
    await tick();
    await tick();
    const dayBefore = world.emails.filter((e) => e.subject.startsWith('Coming up'));
    expect(dayBefore.map((e) => e.to).sort()).toEqual(['priya@example.com', 'rao@example.com']);
    expect(first(dayBefore).subject).toBe('Coming up: Dr Meera Iyer, Thu 19 Nov 10:30 am');
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
    expect(first(summaries).text).toContain('doses this week');
  });
});
