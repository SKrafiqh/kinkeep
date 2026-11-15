import { medicationSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { listMedications } from '@/server/repos/queries';
import { createMedication } from '@/server/services/medications';

export const GET = memberRoute({ permission: 'circle:view' }, ({ deps, circle }) => listMedications(deps.store, circle.id));

export const POST = memberRoute({ body: medicationSchema, permission: 'medication:write' }, ({ deps, body, circle, member, expiresAt }) =>
  createMedication(deps, { circle, member, expiresAt }, body),
);
