import type { Circle } from '@/domain/types';
import { HOUR_MS, MATERIALISE_HOURS, MATERIALISE_REFILL_HOURS, TICK_BUDGET_MS, TICK_PAGE_SIZE } from '@/lib/constants';
import { errorFields, log } from '@/lib/logger';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { circlesDueSummary, dueAppointments, dueDoses, listMembers, medicationsToTopUp } from '../repos/queries';
import { processAppointment } from './appointmentStage';
import type { CircleContext } from './context';
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

interface StepOutcome {
  count: number;
  complete: boolean;
}

/** Materialise, doses, appointments and summaries, in run order. */
type TickSteps = [StepOutcome, StepOutcome, StepOutcome, StepOutcome];

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

function bySlot<T extends { circleId: string; item: { id: string; slotKey: string } }>(
  due: T[],
): Array<{ circleId: string; doseIds: string[] }> {
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
  const inCircle = async (circleId: string, work: (context: CircleContext) => Promise<number>): Promise<number> => {
    const context = await load(circleId);
    return context ? work(context) : 0;
  };

  const horizon = now + (MATERIALISE_HOURS - MATERIALISE_REFILL_HOURS) * HOUR_MS;
  const steps: TickSteps = [
    await eachDue(
      'materialise',
      await medicationsToTopUp(deps.store, horizon, TICK_PAGE_SIZE),
      outOfTime,
      ({ circleId, item }) => inCircle(circleId, ({ circle }) => materialiseMedication(deps, circle, item, now)),
    ),
    await eachDue(
      'doses',
      bySlot(await dueDoses(deps.store, now, TICK_PAGE_SIZE)),
      outOfTime,
      ({ circleId, doseIds }) => inCircle(circleId, (context) => processSlot(deps, context, doseIds, now)),
    ),
    await eachDue(
      'appointments',
      await dueAppointments(deps.store, now, TICK_PAGE_SIZE),
      outOfTime,
      ({ circleId, item }) => inCircle(circleId, (context) => processAppointment(deps, context, item.id, now)),
    ),
    await eachDue('summaries', await circlesDueSummary(deps.store, now, TICK_PAGE_SIZE), outOfTime, (circle) =>
      inCircle(circle.id, ({ members }) => processWeeklySummary(deps, circle.id, members, now)),
    ),
  ];
  const result = toTickResult(steps);
  log.info('tick.done', { ...result });
  return result;
}

/** Folds the four stage outcomes, in run order, into the tick's result. */
function toTickResult(steps: TickSteps): TickResult {
  const [materialised, doseEmails, appointmentEmails, summaryEmails] = steps;
  return {
    materialised: materialised.count,
    doseEmails: doseEmails.count,
    appointmentEmails: appointmentEmails.count,
    summaryEmails: summaryEmails.count,
    complete: steps.every((step) => step.complete),
  };
}

// One failing item is logged and skipped, so it can never stop the reminders behind it.
async function eachDue<T>(
  step: string,
  items: T[],
  outOfTime: () => boolean,
  work: (item: T) => Promise<number>,
): Promise<StepOutcome> {
  let count = 0;
  for (const item of items) {
    if (outOfTime()) return { count, complete: false };
    try {
      count += await work(item);
    } catch (error) {
      log.error('tick.item_failed', { step, ...errorFields(error) });
    }
  }
  return { count, complete: true };
}
