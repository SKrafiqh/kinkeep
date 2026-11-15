import { doseActionSchema } from '@/lib/schemas';
import { memberRoute, requireParam } from '@/server/http';
import { actOnDose } from '@/server/services/doses';

export const POST = memberRoute(
  { body: doseActionSchema, permission: 'dose:act' },
  async ({ deps, body, params, who }) => {
    const doses = await actOnDose(deps, who, requireParam(params, 'id'), body);
    return { doses };
  },
);
