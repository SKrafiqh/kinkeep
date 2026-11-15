import { appointmentSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { listAppointments } from '@/server/repos/queries';
import { createAppointment } from '@/server/services/appointments';

export const GET = memberRoute({ permission: 'circle:view' }, ({ deps, circle }) => listAppointments(deps.store, circle.id));

export const POST = memberRoute({ body: appointmentSchema, permission: 'appointment:write' }, ({ deps, body, circle, member, expiresAt }) =>
  createAppointment(deps, { circle, member, expiresAt }, body),
);
