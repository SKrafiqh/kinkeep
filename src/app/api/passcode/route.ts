import { homePath } from '@/domain/permissions';
import { changePasscodeSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { changePasscode } from '@/server/services/sessions';

export const POST = memberRoute(
  { body: changePasscodeSchema, permission: 'circle:view', allowPendingPasscode: true },
  async ({ deps, body, who }) => {
    await changePasscode(deps, who, body);
    return { home: homePath(who.member.role) };
  },
);
