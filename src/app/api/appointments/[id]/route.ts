import { appointmentSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { deleteAppointment, updateAppointment } from '@/server/services/appointments';

export const PATCH = memberRoute({ body: appointmentSchema, permission: 'appointment:write' }, ({ deps, body, params, circle, member, expiresAt }) =>
  updateAppointment(deps, { circle, member, expiresAt }, params.id, body),
);

export const DELETE = memberRoute({ permission: 'appointment:write' }, async ({ deps, params, circle, member, expiresAt }) => {
  await deleteAppointment(deps, { circle, member, expiresAt }, params.id);
  return { deleted: true };
});
