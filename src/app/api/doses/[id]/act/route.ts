import { doseActionSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { actOnDose } from '@/server/services/doses';

export const POST = memberRoute({ body: doseActionSchema, permission: 'dose:act' }, async ({ deps, body, params, circle, member }) => {
  const doses = await actOnDose(deps, { circle, member }, params.id, body);
  return { doses };
});
