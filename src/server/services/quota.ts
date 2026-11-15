import type { Deps } from '../deps';

interface Counter {
  /** UTC date, YYYY-MM-DD. */
  day: string;
  count: number;
}

/**
 * Counts one use against a daily cap kept in the database, so it holds across server
 * instances. Resolves false, counting nothing, once today's cap is reached.
 */
export function takeDaily(deps: Deps, path: string, cap: number): Promise<boolean> {
  const day = new Date(deps.clock.now()).toISOString().slice(0, 10);
  return deps.store.transaction(async (tx) => {
    const counter = await tx.get<Counter>(path);
    const count = counter?.day === day ? counter.count : 0;
    if (count >= cap) return false;
    tx.set(path, { day, count: count + 1 });
    return true;
  });
}
