import { medicationSchema } from '@/lib/schemas';
import { memberRoute, requireParam } from '@/server/http';
import { deleteMedication, updateMedication } from '@/server/services/medications';

export const PATCH = memberRoute(
  { body: medicationSchema, permission: 'medication:write' },
  ({ deps, body, params, who }) => updateMedication(deps, who, requireParam(params, 'id'), body),
);

export const DELETE = memberRoute({ permission: 'medication:write' }, async ({ deps, params, who }) => {
  await deleteMedication(deps, who, requireParam(params, 'id'));
  return { deleted: true };
});
