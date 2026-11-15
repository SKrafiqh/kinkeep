import { RATE_LIMITS } from '@/lib/constants';
import { testReminderSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { sendTestReminder } from '@/server/services/testReminder';

// It mails an address the caller types in, so it is limited hard and has fixed content.
export const POST = memberRoute(
  { body: testReminderSchema, permission: 'dose:act', rateLimit: RATE_LIMITS.testReminder },
  ({ deps, body, who }) => sendTestReminder(deps, who, body.email),
);
