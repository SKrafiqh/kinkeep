import { authoriseCron } from '@/server/auth/cron';
import { publicRoute } from '@/server/http';
import { runTick } from '@/server/reminders/tick';

/** The reminder engine. Called every 5 minutes by the scheduler, which proves who it is instead of sending an Origin. */
export const POST = publicRoute({ skipOriginCheck: true }, async ({ deps, request }) => {
  await authoriseCron(request, deps.config, deps.oidc);
  return runTick(deps);
});
