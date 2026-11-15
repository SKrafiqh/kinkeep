import { dayQuerySchema } from '@/lib/schemas';
import { memberRoute, parse } from '@/server/http';
import { listDay } from '@/server/services/doses';

export const GET = memberRoute({ permission: 'circle:view' }, ({ deps, request, circle }) => {
  const { date } = parse(dayQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  return listDay(deps, circle, date);
});
