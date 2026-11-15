import type { Circle, Member } from '@/domain/types';
import { HOUR_MS, MATERIALISE_HOURS, MATERIALISE_REFILL_HOURS, TICK_BUDGET_MS, TICK_PAGE_SIZE } from '@/lib/constants';
import { log } from '@/lib/logger';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { circlesDueSummary, dueAppointments, dueDoses, listMembers, medicationsToTopUp } from '../repos/queries';
import { processAppointment } from './appointmentStage';
import { processSlot } from './doseStage';
import { materialiseMedication } from './materialise';
import { processWeeklySummary } from './weeklySummary';

export interface TickResult {
  materialised: number;
  doseEmails: number;
  appointmentEmails: number;
  summaryEmails: number;
  /** False when the time budget ran out; the next tick carries on. */
  complete: boolean;
}

interface CircleContext {
  circle: Circle;
  members: Member[];
}

// Each circle is read at most once per tick, however many of its doses are due.
function circleLoader(deps: Deps): (circleId: string) => Promise<CircleContext | null> {
  const cache = new Map<string, Promise<CircleContext | null>>();
  const load = async (circleId: string): Promise<CircleContext | null> => {
    const circle = await deps.store.get<Circle>(paths.circle(circleId));
    return circle ? { circle, members: await listMembers(deps.store, circleId) } : null;
  };
  return (circleId) => {
    const cached = cache.get(circleId) ?? load(circleId);
    cache.set(circleId, cached);
    return cached;
  };
}

function bySlot<T extends { circleId: string; item: { id: string; slotKey: string } }>(due: T[]): Array<{ circleId: string; doseIds: string[] }> {
  const slots = new Map<string, { circleId: string; doseIds: string[] }>();
  for (const { circleId, item } of due) {
    const slot = slots.get(item.slotKey) ?? { circleId, doseIds: [] };
    slots.set(item.slotKey, { circleId, doseIds: [...slot.doseIds, item.id] });
  }
  return [...slots.values()];
}

/**
 * One run of the reminder engine: top up dose events, advance due doses, send appointment
 * reminders and weekly summaries. Safe to run twice or to overlap with itself: every stage
 * is claimed in a transaction before its email is sent.
 */
export async function runTick(deps: Deps): Promise<TickResult> {
  const now = deps.clock.now();
  const outOfTime = (): boolean => deps.clock.now() - now > TICK_BUDGET_MS;
  const load = circleLoader(deps);
  const result: TickResult = { materialised: 0, doseEmails: 0, appointmentEmails: 0, summaryEmails: 0, complete: true };

  const horizon = now + (MATERIALISE_HOURS - MATERIALISE_REFILL_HOURS) * HOUR_MS;
  for (const { circleId, item } of await medicationsToTopUp(deps.store, horizon, TICK_PAGE_SIZE)) {
    if (outOfTime()) return { ...result, complete: false };
    const context = await load(circleId);
    if (context) result.materialised += await materialiseMedication(deps, context.circle, item, now);
  }
  for (const { circleId, doseIds } of bySlot(await dueDoses(deps.store, now, TICK_PAGE_SIZE))) {
    if (outOfTime()) return { ...result, complete: false };
    const context = await load(circleId);
    if (context) result.doseEmails += await processSlot(deps, context.circle, context.members, doseIds, now);
  }
  for (const { circleId, item } of await dueAppointments(deps.store, now, TICK_PAGE_SIZE)) {
    if (outOfTime()) return { ...result, complete: false };
    const context = await load(circleId);
    if (context) result.appointmentEmails += await processAppointment(deps, context.circle, context.members, item.id, now);
  }
  for (const circle of await circlesDueSummary(deps.store, now, TICK_PAGE_SIZE)) {
    if (outOfTime()) return { ...result, complete: false };
    const context = await load(circle.id);
    if (context) result.summaryEmails += await processWeeklySummary(deps, circle.id, context.members, now);
  }
  log.info('tick.done', { ...result });
  return result;
}
