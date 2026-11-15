import { beforeEach, describe, expect, it } from 'vitest';
import { POST as tickRoute } from '@/app/api/cron/tick/route';
import { POST as doseActRoute } from '@/app/api/doses/[id]/act/route';
import { POST as addMedRoute } from '@/app/api/medications/route';
import { MINUTE_MS } from '@/lib/constants';
import { addHelper, ALL_ON, at, cookie, setUpEngine, tick, today, world } from './engineWorld';
import { call, MEDICINE_INPUT } from './helpers';

beforeEach(() => setUpEngine());

describe('cron authentication', () => {
  it('accepts the shared secret or the scheduler OIDC token, and nothing else', async () => {
    expect((await tick()).status).toBe(200);
    expect(
      (await call(tickRoute, { method: 'POST', origin: null, headers: { authorization: 'Bearer good-oidc' } })).status,
    ).toBe(200);
    expect((await call(tickRoute, { method: 'POST', origin: null })).status).toBe(401);
    expect(
      (await call(tickRoute, { method: 'POST', origin: null, headers: { 'x-cron-secret': 'wrong' } })).status,
    ).toBe(401);
    expect(
      (await call(tickRoute, { method: 'POST', origin: null, headers: { authorization: 'Bearer forged' } })).status,
    ).toBe(401);
  });
});

describe('dose reminders', () => {
  it('sends nothing early, then one email for the whole slot', async () => {
    await call(addMedRoute, {
      cookie,
      body: { ...MEDICINE_INPUT, name: 'Amlodipine', strength: '5 mg', times: ['09:00'] },
    });
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
    expect(world.emails[2]).toMatchObject({
      to: 'priya@example.com',
      subject: 'Mr Rao has not confirmed the 9:00 am medicines',
    });
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
    expect((await call(doseActRoute, { cookie, params: { id: dose.id }, body: { action: 'skipped' } })).status).toBe(
      409,
    );
  });

  it('sends reminders to the chosen relative when the elder has no email', async () => {
    await setUpEngine({ name: 'Priya', role: 'caregiver', email: 'priya@example.com' });
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
    expect((await today())[0]).toMatchObject({
      status: 'scheduled',
      attempts: 1,
      nextActionAt: world.time.now + 5 * MINUTE_MS,
    });
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
