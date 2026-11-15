import { updateMemberSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { removeMember, updateMember } from '@/server/services/members';

export const PATCH = memberRoute({ body: updateMemberSchema, permission: 'members:manage' }, ({ deps, body, params, circle, member, expiresAt }) =>
  updateMember(deps, { circle, member, expiresAt }, params.id, body),
);

export const DELETE = memberRoute({ permission: 'members:manage' }, async ({ deps, params, circle, member, expiresAt }) => {
  await removeMember(deps, { circle, member, expiresAt }, params.id);
  return { removed: true };
});
