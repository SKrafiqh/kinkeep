import { memberRoute } from '@/server/http';
import { listActivity } from '@/server/repos/queries';

const FEED_LENGTH = 30;

export const GET = memberRoute({ permission: 'circle:view' }, ({ deps, circle }) =>
  listActivity(deps.store, circle.id, FEED_LENGTH),
);
