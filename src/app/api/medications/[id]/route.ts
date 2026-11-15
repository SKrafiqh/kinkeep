import { medicationSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { deleteMedication, updateMedication } from '@/server/services/medications';

export const PATCH = memberRoute({ body: medicationSchema, permission: 'medication:write' }, ({ deps, body, params, circle, member, expiresAt }) =>
  updateMedication(deps, { circle, member, expiresAt }, params.id, body),
);

export const DELETE = memberRoute({ permission: 'medication:write' }, async ({ deps, params, circle, member, expiresAt }) => {
  await deleteMedication(deps, { circle, member, expiresAt }, params.id);
  return { deleted: true };
});
