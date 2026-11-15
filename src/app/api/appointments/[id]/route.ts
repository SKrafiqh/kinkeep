import { appointmentSchema } from '@/lib/schemas';
import { memberRoute } from '@/server/http';
import { deleteAppointment, updateAppointment } from '@/server/services/appointments';

export const PATCH = memberRoute(
  { body: appointmentSchema, permission: 'appointment:write' },
  ({ deps, body, params, who }) => updateAppointment(deps, who, params.id, body),
);

export const DELETE = memberRoute({ permission: 'appointment:write' }, async ({ deps, params, who }) => {
  await deleteAppointment(deps, who, params.id);
  return { deleted: true };
});
