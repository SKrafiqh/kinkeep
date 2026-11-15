import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type Query as FirestoreQuery } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Config } from '../config';
import type { DocStore, Found, Query } from './store';

const GRPC_ALREADY_EXISTS = 6;

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.email(),
  private_key: z.string().min(1),
});

function credentialFor(config: Config) {
  // Cloud Run supplies an identity; other hosts pass the service-account JSON in an env var.
  if (!config.FIREBASE_SERVICE_ACCOUNT) return applicationDefault();
  const account = serviceAccountSchema.parse(JSON.parse(config.FIREBASE_SERVICE_ACCOUNT));
  return cert({
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key.replace(/\\n/g, '\n'),
  });
}

function connect(config: Config): Firestore {
  const existing = getApps()[0];
  if (existing) return getFirestore(existing);
  const app = initializeApp({ credential: credentialFor(config), projectId: config.GOOGLE_CLOUD_PROJECT });
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

function applyQuery(base: FirestoreQuery, query: Query = {}): FirestoreQuery {
  let result = base;
  for (const filter of query.where ?? []) result = result.where(filter.field, filter.op, filter.value);
  if (query.orderBy) result = result.orderBy(query.orderBy.field, query.orderBy.direction);
  return query.limit === undefined ? result : result.limit(query.limit);
}

/** DocStore over Firestore through the Admin SDK. Clients never reach the database directly. */
export function createFirestoreStore(config: Config): DocStore {
  const db = connect(config);
  return {
    get: async <T>(path: string) => ((await db.doc(path).get()).data() as T | undefined) ?? null,
    set: async (path, data) => {
      await db.doc(path).set(data);
    },
    create: async (path, data) => {
      try {
        await db.doc(path).create(data);
        return true;
      } catch (error) {
        if ((error as { code?: unknown }).code === GRPC_ALREADY_EXISTS) return false;
        throw error;
      }
    },
    update: async (path, patch) => {
      await db.doc(path).update(patch);
    },
    delete: async (path) => {
      await db.doc(path).delete();
    },
    list: async <T>(collection: string, query?: Query) => {
      const snapshot = await applyQuery(db.collection(collection), query).get();
      return snapshot.docs.map((doc) => doc.data() as T);
    },
    listGroup: async <T>(collectionId: string, query: Query) => {
      const snapshot = await applyQuery(db.collectionGroup(collectionId), query).get();
      return snapshot.docs.map((doc): Found<T> => ({ path: doc.ref.path, data: doc.data() as T }));
    },
    transaction: (run) =>
      db.runTransaction((tx) =>
        run({
          get: async <T>(path: string) => ((await tx.get(db.doc(path))).data() as T | undefined) ?? null,
          set: (path, data) => void tx.set(db.doc(path), data),
          update: (path, patch) => void tx.update(db.doc(path), patch),
          delete: (path) => void tx.delete(db.doc(path)),
        }),
      ),
  };
}
