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

type Docs = Map<string, Doc>;

interface MemoryState {
  docs: Docs;
  /** The last transaction, so the next one waits for it. */
  queue: Promise<unknown>;
}

function readDoc<T>(docs: Docs, path: string): T | null {
  const doc = docs.get(path);
  return doc === undefined ? null : (structuredClone(doc) as T);
}

function writeDoc(target: Docs, path: string, data: object): void {
  target.set(path, structuredClone(data) as Doc);
}

function patchDoc(target: Docs, path: string, changes: object): void {
  const current = target.get(path);
  if (current === undefined) throw new Error(`No document at ${path}`);
  target.set(path, { ...current, ...(structuredClone(changes) as Doc) });
}

function allDocs(docs: Docs): Found<Doc>[] {
  return [...docs.entries()].map(([path, data]) => ({ path, data: structuredClone(data) }));
}

function inCollection(docs: Docs, collection: string): Found<Doc>[] {
  return allDocs(docs).filter(
    ({ path }) => path.startsWith(`${collection}/`) && !path.slice(collection.length + 1).includes('/'),
  );
}

// Transactions run one at a time, which gives the same isolation Firestore promises.
function runTransaction<T>(state: MemoryState, run: (tx: Transaction) => Promise<T>): Promise<T> {
  const result = state.queue.then(async () => {
    const writes: Array<(draft: Docs) => void> = [];
    const value = await run({
      get: async (path) => readDoc(state.docs, path),
      set: (path, data) => writes.push((draft) => writeDoc(draft, path, data)),
      update: (path, changes) => writes.push((draft) => patchDoc(draft, path, changes)),
      delete: (path) => writes.push((draft) => draft.delete(path)),
    });
    // All or nothing, like Firestore: the writes land on a copy, which replaces the
    // store only if every one of them succeeds.
    const draft = new Map(state.docs);
    writes.forEach((apply) => apply(draft));
    state.docs = draft;
    return value;
  });
  state.queue = result.catch(() => undefined);
  return result;
}

/** In-memory DocStore with Firestore's semantics, for tests and for running without a database. */
export function createMemoryStore(): DocStore {
  const state: MemoryState = { docs: new Map(), queue: Promise.resolve() };
  return {
    get: async (path) => readDoc(state.docs, path),
    set: async (path, data) => writeDoc(state.docs, path, data),
    create: async (path, data) => {
      if (state.docs.has(path)) return false;
      writeDoc(state.docs, path, data);
      return true;
    },
    update: async (path, changes) => patchDoc(state.docs, path, changes),
    delete: async (path) => {
      state.docs.delete(path);
    },
    list: async <T>(collection: string, query?: Query) =>
      applyQuery(inCollection(state.docs, collection), query).map(({ data }) => data as T),
    listGroup: async <T>(collectionId: string, query: Query) => {
      const inGroup = allDocs(state.docs).filter(({ path }) => path.split('/').at(-2) === collectionId);
      return applyQuery(inGroup, query) as Found<T>[];
    },
    transaction: (run) => runTransaction(state, run),
  };
}
