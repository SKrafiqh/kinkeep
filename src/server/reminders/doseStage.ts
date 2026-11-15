import { advanceDose } from '@/domain/escalation';
import { formatTime } from '@/domain/time';
import type { Circle, DoseEvent, DoseStatus, Member } from '@/domain/types';
import { MAX_SEND_ATTEMPTS, MINUTE_MS, SEND_RETRY_MINUTES } from '@/lib/constants';
import { errorFields, log } from '@/lib/logger';
import { issueActionToken } from '../auth/actionToken';
import type { Deps } from '../deps';
import type { EmailMessage } from '../email/sender';
import { missedEmail, nudgeEmail, upcomingEmail } from '../email/templates';
import { paths } from '../repos/paths';
import { alertRecipients, elderRecipient, whose } from '../services/recipients';

interface Claimed {
  event: DoseEvent;
  /** Stage before the claim, restored if no email could be sent. */
  previous: DoseStatus;
}

/**
 * Moves every due dose of a slot to its next stage in one transaction. The stage is
 * written before any email goes out, so two overlapping ticks cannot both send it.
 */
function claimSlot(deps: Deps, circle: Circle, doseIds: string[], now: number): Promise<Claimed[]> {
  return deps.store.transaction(async (tx) => {
    const events = await Promise.all(doseIds.map((id) => tx.get<DoseEvent>(paths.dose(circle.id, id))));
    const claimed: Claimed[] = [];
    for (const event of events) {
      const change = event ? advanceDose(event, now, circle.settings) : null;
      if (!event || !change) continue;
      tx.update(paths.dose(circle.id, event.id), { status: change.status, nextActionAt: change.nextActionAt });
      if (change.notify) claimed.push({ event: { ...event, ...change }, previous: event.status });
    }
    return claimed;
  });
}

function messagesFor(deps: Deps, circle: Circle, members: Member[], stage: DoseStatus, doses: DoseEvent[]): EmailMessage[] {
  const slotTime = formatTime(doses[0].dueAt, circle.timeZone);
  const medicines = doses.map((dose) => ({ name: dose.medName, strength: dose.strength }));
  if (stage === 'missed') {
    const content = missedEmail({ elderName: circle.elderName, slotTime, medicines, circleUrl: `${deps.config.APP_URL}/circle` });
    return alertRecipients(members, 'missedDose').map((member) => ({ to: member.email, ...content }));
  }
  const recipient = elderRecipient(circle, members);
  if (!recipient) return [];
  const { slotKey, dueAt } = doses[0];
  const token = issueActionToken(deps.config, { circleId: circle.id, slotKey, memberId: recipient.id, dueAt });
  const input = { whose: whose(recipient, circle), slotTime, medicines, actUrl: `${deps.config.APP_URL}/act/${token}` };
  return [{ to: recipient.email, ...(stage === 'nudged' ? nudgeEmail(input) : upcomingEmail(input)) }];
}

async function sendAll(deps: Deps, messages: EmailMessage[]): Promise<{ sent: number; error: unknown }> {
  const results = await Promise.allSettled(messages.map((message) => deps.email.send(message)));
  const failure = results.find((result) => result.status === 'rejected');
  return { sent: results.filter((result) => result.status === 'fulfilled').length, error: failure?.reason };
}

// A short code only: a mail server's own message can contain a member's email address.
function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string') return code;
  return error instanceof Error ? error.name : 'UNKNOWN';
}

// Retried only when nothing went out, so nobody ever gets the same stage twice.
function recordFailure(deps: Deps, circle: Circle, claimed: Claimed[], error: unknown, now: number): Promise<void> {
  const lastError = errorCode(error);
  return deps.store.transaction(async (tx) => {
    const fresh = await Promise.all(claimed.map(({ event }) => tx.get<DoseEvent>(paths.dose(circle.id, event.id))));
    fresh.forEach((current, index) => {
      if (!current) return;
      const attempts = current.attempts + 1;
      const retry = current.status === claimed[index].event.status && attempts < MAX_SEND_ATTEMPTS;
      const back = { status: claimed[index].previous, nextActionAt: now + SEND_RETRY_MINUTES * MINUTE_MS };
      tx.update(paths.dose(circle.id, current.id), { attempts, lastError, ...(retry ? back : {}) });
    });
  });
}

/** Advances one slot and sends one email per recipient for each stage reached. Returns emails sent. */
export async function processSlot(deps: Deps, circle: Circle, members: Member[], doseIds: string[], now: number): Promise<number> {
  const claimed = await claimSlot(deps, circle, doseIds, now);
  let sent = 0;
  for (const stage of ['reminded', 'nudged', 'missed'] as const) {
    const group = claimed.filter(({ event }) => event.status === stage);
    if (group.length === 0) continue;
    const messages = messagesFor(deps, circle, members, stage, group.map(({ event }) => event));
    if (messages.length === 0) {
      log.info('tick.no_recipient', { circleId: circle.id, stage });
      continue;
    }
    const result = await sendAll(deps, messages);
    sent += result.sent;
    if (result.error !== undefined) log.warn('tick.send_failed', { circleId: circle.id, stage, sent: result.sent, ...errorFields(result.error) });
    if (result.sent === 0) await recordFailure(deps, circle, group, result.error, now);
    else await clearFailures(deps, circle, group);
  }
  return sent;
}

// The three-attempt limit is per stage: once a stage is sent, the next one starts from zero.
async function clearFailures(deps: Deps, circle: Circle, claimed: Claimed[]): Promise<void> {
  const failedBefore = claimed.filter(({ event }) => event.attempts > 0);
  await Promise.all(failedBefore.map(({ event }) => deps.store.update(paths.dose(circle.id, event.id), { attempts: 0, lastError: null })));
}
