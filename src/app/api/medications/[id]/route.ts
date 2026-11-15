import { medicationSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { deleteMedication, updateMedication } from '@/server/services/medications';

export const PATCH = memberRoute(
  { body: medicationSchema, permission: 'medication:write' },
  ({ deps, body, params, who }) => updateMedication(deps, who, params.id, body),
);

export const DELETE = memberRoute({ permission: 'medication:write' }, async ({ deps, params, who }) => {
  await deleteMedication(deps, who, params.id);
  return { deleted: true };
});
