import { isOpen } from '@/domain/escalation';
import { formatTime } from '@/domain/time';
import { HOUR_MS, MATERIALISE_HOURS, TEST_EMAIL_CIRCLE_CAP, TEST_EMAIL_GLOBAL_CAP } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { errorFields, log } from '@/lib/logger';
import { issueActionToken } from '../auth/actionToken';
import type { Deps } from '../deps';
import { sampleEmail, upcomingEmail, type EmailContent } from '../email/templates';
import { paths } from '../repos/paths';
import { listDoses } from '../repos/queries';
import { takeDaily } from './quota';
import { whose } from './recipients';
import type { MemberContext } from './sessions';

async function buildEmail(deps: Deps, who: MemberContext): Promise<{ content: EmailContent; withActions: boolean }> {
  const now = deps.clock.now();
  const ahead = await listDoses(deps.store, who.circle.id, now - HOUR_MS, now + MATERIALISE_HOURS * HOUR_MS);
  const next = ahead.find((dose) => isOpen(dose.status));
  if (!next) return { content: sampleEmail(`${deps.config.APP_URL}/today`), withActions: false };
  const slot = ahead.filter((dose) => dose.slotKey === next.slotKey && isOpen(dose.status));
  const token = issueActionToken(deps.config, {
    circleId: who.circle.id,
    slotKey: next.slotKey,
    memberId: who.member.id,
    dueAt: next.dueAt,
  });
  const content = upcomingEmail(
    {
      whose: whose(who.member, who.circle),
      slotTime: formatTime(next.dueAt, who.circle.timeZone),
      medicines: slot.map((dose) => ({ name: dose.medName, strength: dose.strength })),
      actUrl: `${deps.config.APP_URL}/act/${token}`,
    },
    'This is the test reminder you asked for. The buttons are real.',
  );
  return { content, withActions: true };
}

/** Sends one real reminder for the next open slot to the address entered, with working one-tap links. */
export async function sendTestReminder(
  deps: Deps,
  who: MemberContext,
  email: string,
): Promise<{ withActions: boolean }> {
  // The address is typed in by the caller, so sends are capped in the database, per circle and overall.
  const allowed =
    (await takeDaily(deps, paths.quota(who.circle.id, 'testEmail'), TEST_EMAIL_CIRCLE_CAP)) &&
    (await takeDaily(deps, paths.globalQuota('testEmail'), TEST_EMAIL_GLOBAL_CAP));
  if (!allowed)
    throw new AppError('RATE_LIMITED', 'That is all the test reminders for today. Real reminders are not affected.');
  const { content, withActions } = await buildEmail(deps, who);
  try {
    await deps.email.send({ to: email, ...content });
  } catch (error) {
    log.warn('test_reminder.send_failed', { circleId: who.circle.id, ...errorFields(error) });
    throw new AppError('INTERNAL', 'We could not send that email. Check the address and try again in a minute.');
  }
  return { withActions };
}
