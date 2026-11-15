import { adherenceOf, missedPatterns } from '@/domain/adherence';
import { nextWeeklySummaryAt, weeklySummarySentences } from '@/domain/summary';
import type { Circle, Member } from '@/domain/types';
import { DAY_MS } from '@/lib/constants';
import { errorFields, log } from '@/lib/logger';
import type { Deps } from '../deps';
import { weeklySummaryEmail } from '../email/templates';
import { paths } from '../repos/paths';
import { listDoses } from '../repos/queries';
import { alertRecipients, elderRecipient, uniqueByEmail } from '../services/recipients';

// Moves the circle's next summary to the following Sunday before sending, so it goes out once.
function claim(deps: Deps, circleId: string, now: number): Promise<Circle | null> {
  const path = paths.circle(circleId);
  return deps.store.transaction(async (tx) => {
    const circle = await tx.get<Circle>(path);
    if (!circle || circle.nextSummaryAt === null || circle.nextSummaryAt > now) return null;
    tx.update(path, { nextSummaryAt: nextWeeklySummaryAt(now, circle.timeZone) });
    return circle;
  });
}

/** Sends the Sunday summary to the elder and to members the elder opted in. Returns emails sent. */
export async function processWeeklySummary(deps: Deps, circleId: string, members: Member[], now: number): Promise<number> {
  const circle = await claim(deps, circleId, now);
  if (!circle) return 0;
  const elder = elderRecipient(circle, members);
  const recipients = uniqueByEmail([...(elder ? [elder] : []), ...alertRecipients(members, 'weeklySummary')]);
  if (recipients.length === 0) return 0;
  const doses = await listDoses(deps.store, circle.id, now - 7 * DAY_MS, now);
  const sentences = weeklySummarySentences(circle.elderName, adherenceOf(doses), missedPatterns(doses, circle.timeZone));
  const content = weeklySummaryEmail({ elderName: circle.elderName, sentences, circleUrl: `${deps.config.APP_URL}/circle` });
  const results = await Promise.allSettled(recipients.map((recipient) => deps.email.send({ to: recipient.email, ...content })));
  for (const result of results) {
    if (result.status === 'rejected') log.warn('tick.summary_send_failed', { circleId, ...errorFields(result.reason) });
  }
  return results.filter((result) => result.status === 'fulfilled').length;
}
