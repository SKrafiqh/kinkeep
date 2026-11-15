import type { Activity } from '@/domain/types';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { newId } from '../repos/store';

type Entry = Pick<Activity, 'action' | 'targetType' | 'targetId' | 'summary'>;

/** Adds a plain-language line to the circle's "what changed" feed. */
export async function recordActivity(
  deps: Deps,
  circleId: string,
  actor: { id: string; name: string },
  entry: Entry,
): Promise<void> {
  const activity: Activity = { id: newId(), actorId: actor.id, actorName: actor.name, at: deps.clock.now(), ...entry };
  await deps.store.set(paths.activityItem(circleId, activity.id), activity);
}
