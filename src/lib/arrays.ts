/** First item of a list the caller knows is not empty. An empty list here is a bug, so it throws. */
export function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('Expected a non-empty list.');
  return item;
}

/** Last item of a list the caller knows is not empty. An empty list here is a bug, so it throws. */
export function last<T>(items: readonly T[]): T {
  const item = items.at(-1);
  if (item === undefined) throw new Error('Expected a non-empty list.');
  return item;
}
