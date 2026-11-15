import { MINUTE_MS } from '@/lib/constants';
import { testReminderSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { sendTestReminder } from '@/server/services/testReminder';

// It mails an address the caller types in, so it is limited hard and has fixed content.
export const POST = memberRoute(
  { body: testReminderSchema, permission: 'dose:act', rateLimit: { limit: 3, windowMs: 10 * MINUTE_MS } },
  ({ deps, body, circle, member, expiresAt }) => sendTestReminder(deps, { circle, member, expiresAt }, body.email),
);
