import { MINUTE_MS } from '@/lib/constants';
import type { DoseAction, DoseEvent, DoseStatus, ReminderSettings } from './types';

type OpenStatus = 'scheduled' | 'reminded' | 'nudged';
const RANK: Record<OpenStatus | 'missed', number> = { scheduled: 0, reminded: 1, nudged: 2, missed: 3 };

/** A dose nobody has confirmed yet and the engine may still remind about. */
export function isOpen(status: DoseStatus): status is OpenStatus {
  return status === 'scheduled' || status === 'reminded' || status === 'nudged';
}

export interface StageChange {
  status: OpenStatus | 'missed';
  nextActionAt: number | null;
  /** False when the stage did not move and no email is due. */
  notify: boolean;
}

/**
 * The stage a dose belongs in at `now`, or null when nothing is due. A late tick jumps
 * straight to the right stage, so a stale reminder is never sent for a dose already missed.
 */
export function advanceDose(
  event: Pick<DoseEvent, 'status' | 'dueAt' | 'nextActionAt'>,
  now: number,
  settings: ReminderSettings,
): StageChange | null {
  if (!isOpen(event.status) || event.nextActionAt === null || event.nextActionAt > now) return null;
  const nudgeAt = event.dueAt + settings.nudgeMin * MINUTE_MS;
  const missAt = event.dueAt + settings.escalateMin * MINUTE_MS;
  const target = now >= missAt ? 'missed' : now >= nudgeAt ? 'nudged' : 'reminded';
  const status = RANK[target] > RANK[event.status] ? target : event.status;
  const nextActionAt = status === 'missed' ? null : status === 'nudged' ? missAt : nudgeAt;
  return { status, nextActionAt, notify: status !== event.status };
}

export interface ActionResult {
  status: DoseAction;
  late: boolean;
}

/** Result of a person confirming a dose, or null when the dose is already settled. */
export function applyDoseAction(status: DoseStatus, action: DoseAction): ActionResult | null {
  if (isOpen(status)) return { status: action, late: false };
  if (status === 'missed' && action === 'taken') return { status: 'taken', late: true };
  return null;
}

export type DoseView = 'upcoming' | 'due' | 'late' | 'missed' | 'taken' | 'taken-late' | 'skipped';

/** How a dose should read on screen at `now`. */
export function doseView(event: Pick<DoseEvent, 'status' | 'dueAt' | 'late'>, now: number): DoseView {
  if (event.status === 'taken') return event.late ? 'taken-late' : 'taken';
  if (event.status === 'skipped' || event.status === 'missed') return event.status;
  if (now < event.dueAt) return event.status === 'scheduled' ? 'upcoming' : 'due';
  return now - event.dueAt < 5 * MINUTE_MS ? 'due' : 'late';
}
