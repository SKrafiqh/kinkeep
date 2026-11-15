import { beforeEach, describe, expect, it } from 'vitest';
import { POST as briefRoute } from '@/app/api/appointments/[id]/brief/route';
import { POST as demoRoute } from '@/app/api/circles/demo/route';
import { POST as tickRoute } from '@/app/api/cron/tick/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { PATCH as patchMedRoute } from '@/app/api/medications/[id]/route';
import { POST as addMedRoute } from '@/app/api/medications/route';
import { POST as testReminderRoute } from '@/app/api/test-reminder/route';
import type { Circle, DoseEvent } from '@/domain/types';
import { first } from '@/lib/arrays';
import { DEMO_GLOBAL_CAP, MAX_MEDICINES, MINUTE_MS, TEST_EMAIL_CIRCLE_CAP } from '@/lib/constants';
import { allowRequest, resetRateLimits } from '@/server/auth/rateLimit';
import { circleDashboard } from '@/server/services/dashboard';
import { takeDaily } from '@/server/services/quota';
import { call, CRON_SECRET, createCircle, createWorld, MEDICINE_INPUT, START, type World } from './helpers';

// The circle is created at 08:30; the first dose is due at 09:00.
const DUE = START + 30 * MINUTE_MS;

let world: World;
let cookie: string;

const tick = () => call(tickRoute, { method: 'POST', origin: null, headers: { 'x-cron-secret': CRON_SECRET } });
const today = async (): Promise<DoseEvent[]> =>
  (await call(dosesRoute, { cookie, query: '?date=2026-11-16' })).data.doses;

beforeEach(async () => {
  world = createWorld();
  cookie = (await createCircle()).cookie;
});

describe('daily caps kept in the database', () => {
  it('counts per day and resets the next day', async () => {
    for (let i = 0; i < 3; i += 1) expect(await takeDaily(world.deps, 'quota/x', 3)).toBe(true);
    expect(await takeDaily(world.deps, 'quota/x', 3)).toBe(false);
    world.time.now += 24 * 60 * MINUTE_MS;
    expect(await takeDaily(world.deps, 'quota/x', 3)).toBe(true);
  });

  it('stops test reminders for a circle after the daily cap, whatever the caller address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i <= TEST_EMAIL_CIRCLE_CAP; i += 1) {
      statuses.push(
        (await call(testReminderRoute, { cookie, body: { email: 'someone@example.com' }, ip: `198.51.100.${i}` }))
          .status,
      );
    }
    expect(statuses.slice(0, TEST_EMAIL_CIRCLE_CAP).every((status) => status === 200)).toBe(true);
    expect(statuses[TEST_EMAIL_CIRCLE_CAP]).toBe(429);
    expect(world.emails).toHaveLength(TEST_EMAIL_CIRCLE_CAP);
  });

  it('stops new demo circles once the app-wide daily cap is used', async () => {
    await world.deps.store.set('quota/demo', {
      day: new Date(START).toISOString().slice(0, 10),
      count: DEMO_GLOBAL_CAP,
    });
    const result = await call(demoRoute, { body: { timeZone: 'Asia/Kolkata' } });
    expect(result).toMatchObject({ status: 429, error: { code: 'RATE_LIMITED' } });
  });
});

describe('size limits', () => {
  it('refuses more than the maximum number of medicines', async () => {
    const circle = first(await world.deps.store.list<Circle>('circles'));
    for (let i = 0; i < MAX_MEDICINES; i += 1) {
      await world.deps.store.set(`circles/${circle.id}/medications/m${i}`, { id: `m${i}`, name: `Med ${i}` });
    }
    expect((await call(addMedRoute, { cookie, body: MEDICINE_INPUT })).status).toBe(409);
  });
});

describe('request guards', () => {
  it('treats an id that is not a plain id as not found', async () => {
    const result = await call(patchMedRoute, {
      method: 'PATCH',
      cookie,
      params: { id: 'a/../b' },
      body: MEDICINE_INPUT,
    });
    expect(result.status).toBe(404);
  });

  it('keeps an active caller limited even when new callers flood the limiter', () => {
    resetRateLimits();
    const rule = { limit: 2, windowMs: 60_000 };
    allowRequest('busy', rule, 0);
    allowRequest('busy', rule, 0);
    for (let i = 0; i < 10_500; i += 1) {
      allowRequest(`flood-${i}`, rule, 0);
      if (i % 1000 === 0) expect(allowRequest('busy', rule, 0)).toBe(false);
    }
    expect(allowRequest('busy', rule, 0)).toBe(false);
  });

  it('counts a route once per caller, however many different ids are in the path', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await call(briefRoute, { method: 'POST', cookie, params: { id: `unknown${i}` } })).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('reminder engine resilience', () => {
  beforeEach(async () => {
    await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
  });

  it('skips a failing item and still handles the rest', async () => {
    const { store } = world.deps;
    const original = store.transaction.bind(store);
    let failed = false;
    store.transaction = (run) => {
      if (!failed) {
        failed = true;
        return Promise.reject(new Error('database hiccup'));
      }
      return original(run);
    };
    world.time.now = DUE - 15 * MINUTE_MS;
    const result = await tick();
    expect(result.status).toBe(200);
    expect(result.data.complete).toBe(true);
    store.transaction = original;
    await tick();
    expect(world.emails).toHaveLength(1);
  });

  it('gives each stage its own three attempts', async () => {
    world.mail.failing = true;
    world.time.now = DUE - 15 * MINUTE_MS;
    await tick();
    world.time.now = DUE - 10 * MINUTE_MS;
    await tick();
    world.mail.failing = false;
    world.time.now = DUE - 5 * MINUTE_MS;
    await tick();
    expect((await today())[0]).toMatchObject({ status: 'reminded', attempts: 0, lastError: null });
    world.mail.failing = true;
    world.time.now = DUE + 30 * MINUTE_MS;
    await tick();
    // The nudge failed once: it goes back to "reminded" to be retried, with one attempt counted.
    expect((await today())[0]).toMatchObject({ status: 'reminded', attempts: 1 });
  });

  it('stops reminding about a dose already due when its medicine is paused', async () => {
    world.time.now = DUE - 15 * MINUTE_MS;
    await tick();
    const dose = first(await today());
    world.time.now = DUE + 10 * MINUTE_MS;
    await call(patchMedRoute, {
      method: 'PATCH',
      cookie,
      params: { id: dose.medId },
      body: { ...MEDICINE_INPUT, active: false },
    });
    world.emails.length = 0;
    for (const minutes of [30, 60, 90]) {
      world.time.now = DUE + minutes * MINUTE_MS;
      await tick();
    }
    expect(world.emails).toHaveLength(0);
    expect((await today()).map((d) => d.status)).toEqual(['reminded']);
  });
});

describe('circle dashboard', () => {
  it('reports empty adherence, no next visit, and the change feed', async () => {
    const circle = first(await world.deps.store.list<Circle>('circles'));
    const dashboard = await circleDashboard(world.deps, circle);
    expect(dashboard).toMatchObject({
      week: { percent: null },
      month: { percent: null },
      nextAppointment: null,
      byMedicine: [],
    });
    expect(dashboard.strip).toHaveLength(7);
    expect(first(dashboard.activity).summary).toBe('Mr Rao created the circle');
  });
});
