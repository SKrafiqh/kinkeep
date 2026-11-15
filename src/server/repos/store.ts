import { randomUUID } from 'node:crypto';

/**
 * The one seam between the app and its database. Two adapters implement it:
 * Firestore for real use and an in-memory one for tests and local runs.
 * Paths look like Firestore's: "circles/{id}/members/{id}".
 */
export interface Filter {
  field: string;
  op: '==' | '<' | '<=' | '>' | '>=';
  value: string | number | boolean;
}

export interface Query {
  /** Keep to one field per query so no composite index is needed. */
  where?: Filter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface Found<T> {
  path: string;
  data: T;
}

export interface Transaction {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: object): void;
  update(path: string, patch: object): void;
  delete(path: string): void;
}

export interface DocStore {
  get<T>(path: string): Promise<T | null>;
  set(path: string, data: object): Promise<void>;
  /** Creates the document; resolves false, changing nothing, when it already exists. */
  create(path: string, data: object): Promise<boolean>;
  /** Replaces the named top-level fields of an existing document. */
  update(path: string, patch: object): Promise<void>;
  delete(path: string): Promise<void>;
  list<T>(collection: string, query?: Query): Promise<T[]>;
  /** Queries every collection with this id, across all circles. */
  listGroup<T>(collectionId: string, query: Query): Promise<Found<T>[]>;
  /** Reads then writes atomically. All reads must come before the first write. */
  transaction<T>(run: (tx: Transaction) => Promise<T>): Promise<T>;
}

/** A new random document id. */
export function newId(): string {
  return randomUUID().replaceAll('-', '').slice(0, 20);
}
