import type { DocStore, Filter, Found, Query, Transaction } from './store';

type Doc = Record<string, unknown>;

// Like Firestore: a filter only matches values of the same type, so null and missing never match.
function matches(doc: Doc, filter: Filter): boolean {
  const value = doc[filter.field];
  if (typeof value !== typeof filter.value) return false;
  const left = value as string | number | boolean;
  switch (filter.op) {
    case '==':
      return left === filter.value;
    case '<':
      return left < filter.value;
    case '<=':
      return left <= filter.value;
    case '>':
      return left > filter.value;
    default:
      return left >= filter.value;
  }
}

function applyQuery(found: Found<Doc>[], query: Query = {}): Found<Doc>[] {
  let result = found.filter(({ data }) => (query.where ?? []).every((filter) => matches(data, filter)));
  const order = query.orderBy;
  if (order) {
    const sign = order.direction === 'asc' ? 1 : -1;
    result = result
      .filter(({ data }) => data[order.field] !== undefined && data[order.field] !== null)
      .sort((a, b) => {
        const left = a.data[order.field] as string | number;
        const right = b.data[order.field] as string | number;
        return left === right ? 0 : left < right ? -sign : sign;
      });
  }
  return query.limit === undefined ? result : result.slice(0, query.limit);
}

/** In-memory DocStore with Firestore's semantics, for tests and for running without a database. */
export function createMemoryStore(): DocStore {
  let docs = new Map<string, Doc>();
  let queue: Promise<unknown> = Promise.resolve();

  const read = <T>(path: string): T | null => {
    const doc = docs.get(path);
    return doc === undefined ? null : (structuredClone(doc) as T);
  };
  const write = (path: string, data: object, target = docs): void => {
    target.set(path, structuredClone(data) as Doc);
  };
  const patch = (path: string, changes: object, target = docs): void => {
    const current = target.get(path);
    if (current === undefined) throw new Error(`No document at ${path}`);
    target.set(path, { ...current, ...(structuredClone(changes) as Doc) });
  };
  const all = (): Found<Doc>[] => [...docs.entries()].map(([path, data]) => ({ path, data: structuredClone(data) }));

  return {
    get: async (path) => read(path),
    set: async (path, data) => write(path, data),
    create: async (path, data) => {
      if (docs.has(path)) return false;
      write(path, data);
      return true;
    },
    update: async (path, changes) => patch(path, changes),
    delete: async (path) => {
      docs.delete(path);
    },
    list: async <T>(collection: string, query?: Query) => {
      const inCollection = all().filter(
        ({ path }) => path.startsWith(`${collection}/`) && !path.slice(collection.length + 1).includes('/'),
      );
      return applyQuery(inCollection, query).map(({ data }) => data as T);
    },
    listGroup: async <T>(collectionId: string, query: Query) => {
      const inGroup = all().filter(({ path }) => path.split('/').at(-2) === collectionId);
      return applyQuery(inGroup, query) as Found<T>[];
    },
    // Transactions run one at a time, which gives the same isolation Firestore promises.
    transaction: <T>(run: (tx: Transaction) => Promise<T>) => {
      const result = queue.then(async () => {
        const writes: Array<(draft: Map<string, Doc>) => void> = [];
        const value = await run({
          get: async (path) => read(path),
          set: (path, data) => writes.push((draft) => write(path, data, draft)),
          update: (path, changes) => writes.push((draft) => patch(path, changes, draft)),
          delete: (path) => writes.push((draft) => draft.delete(path)),
        });
        // All or nothing, like Firestore: the writes land on a copy, which replaces the
        // store only if every one of them succeeds.
        const draft = new Map(docs);
        writes.forEach((apply) => apply(draft));
        docs = draft;
        return value;
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
