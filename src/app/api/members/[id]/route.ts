import { updateMemberSchema } from '@/lib/schemas';
import { memberRoute, requireParam } from '@/server/http';
import { removeMember, updateMember } from '@/server/services/members';

export const PATCH = memberRoute(
  { body: updateMemberSchema, permission: 'members:manage' },
  ({ deps, body, params, who }) => updateMember(deps, who, requireParam(params, 'id'), body),
);

export const DELETE = memberRoute({ permission: 'members:manage' }, async ({ deps, params, who }) => {
  await removeMember(deps, who, requireParam(params, 'id'));
  return { removed: true };
});
