import { addMemberSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { addMember, listMemberViews } from '@/server/services/members';

export const GET = memberRoute({ permission: 'members:manage' }, ({ deps, circle }) => listMemberViews(deps, circle));

export const POST = memberRoute({ body: addMemberSchema, permission: 'members:manage' }, ({ deps, body, circle, member, expiresAt }) =>
  addMember(deps, { circle, member, expiresAt }, body),
);
