import { POST as tickRoute } from '@/app/api/cron/tick/route';
import { GET as dosesRoute } from '@/app/api/doses/route';
import { POST as addMedRoute } from '@/app/api/medications/route';
import { PATCH as patchMemberRoute } from '@/app/api/members/[id]/route';
import { POST as addMemberRoute } from '@/app/api/members/route';
import type { DoseEvent } from '@/domain/types';
import { MINUTE_MS } from '@/lib/constants';
import {
  call,
  CIRCLE_INPUT,
  CRON_SECRET,
  createCircle,
  createWorld,
  MEDICINE_INPUT,
  START,
  type World,
} from './helpers';

// The circle is created at 08:30; the first dose is due at 09:00.
export const DUE = START + 30 * MINUTE_MS;
export const ALL_ON = { missedDose: true, appointments: true, weeklySummary: true };

// Exported as live bindings, so every engine test file reads the current test's world.
export let world: World;
export let cookie: string;

/** A fresh world with one circle and one medicine. Call in beforeEach, or again to start over as another creator. */
export async function setUpEngine(creator: Partial<typeof CIRCLE_INPUT> = {}): Promise<void> {
  world = createWorld();
  cookie = (await createCircle(creator)).cookie;
  await call(addMedRoute, { cookie, body: MEDICINE_INPUT });
}

export const tick = () => call(tickRoute, { method: 'POST', origin: null, headers: { 'x-cron-secret': CRON_SECRET } });
export const at = (minutesFromDue: number) => {
  world.time.now = DUE + minutesFromDue * MINUTE_MS;
};
export const today = async (): Promise<DoseEvent[]> =>
  (await call(dosesRoute, { cookie, query: '?date=2026-11-16' })).data.doses;
export const tokenIn = (text: string): string => /\/act\/([\w.-]+)/.exec(text)?.[1] ?? '';

/** Adds a helper with an email and the given alert switches. Returns their member id. */
export async function addHelper(name: string, role: 'caregiver' | 'family', alerts = ALL_ON): Promise<string> {
  const added = await call(addMemberRoute, {
    cookie,
    body: { name, email: `${name.toLowerCase()}@example.com`, role },
  });
  await call(patchMemberRoute, { method: 'PATCH', cookie, params: { id: added.data.member.id }, body: { alerts } });
  return added.data.member.id;
}
