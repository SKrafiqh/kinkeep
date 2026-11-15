import { formatWhen } from '@/domain/time';
import type { Activity } from '@/domain/types';

/** "What changed": who did what, when, in plain words, newest first. */
export function ActivityFeed({ items, now, timeZone }: { items: Activity[]; now: number; timeZone: string }) {
  if (items.length === 0) {
    return <p className="text-muted">Nothing has changed yet. Every change to medicines, appointments and members will be listed here.</p>;
  }
  return (
    <ol className="grid gap-4">
      {items.map((item) => (
        <li key={item.id} className="margin-rule pl-4">
          <p>{item.summary}</p>
          <p className="hint">{formatWhen(item.at, now, timeZone)}</p>
        </li>
      ))}
    </ol>
  );
}
