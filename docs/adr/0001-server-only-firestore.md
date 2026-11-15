# 0001. Firestore is reached only from the server

**Status:** Accepted

## Context

Care data is sensitive, and the access rules are richer than Firestore security rules express
well: a member's role can change, a removed member must lose access at once, and every read is
scoped to one circle.

## Decision

The browser never talks to Firestore. All reads and writes go through Next.js route handlers and
the Admin SDK under the Cloud Run service account. `firestore.rules` denies every client read
and write. Every repository function takes the `circleId` from the signed session, never from the
request body, and every mutating request re-reads the member, so a role change or removal applies
on the next request.

## Consequences

- One place to enforce authorisation (`src/server/http.ts`), tested with in-memory fakes.
- No offline client cache or realtime listeners; pages refresh after an action instead.
- The service account needs only `roles/datastore.user`.
