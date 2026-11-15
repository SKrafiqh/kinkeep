# 0005. Pure domain logic and one storage seam

**Status:** Accepted

## Context

Scheduling across time zones and daylight-saving changes, escalation timing and adherence are
the parts most likely to be wrong, and they must be testable without a database or a clock.

## Decision

- `src/domain/` is pure TypeScript: no I/O, no framework, no `Date.now()`. Time is an argument.
  ESLint forbids `Date.now` and I/O imports there.
- `src/server/` owns all I/O behind small interfaces: `DocStore`, `EmailSender`, `AiClient`,
  `Clock`, `OidcVerifier`. Production uses Firestore, Gmail and Adaption Labs; tests use
  in-memory fakes with the same semantics (all-or-nothing transactions, typed query filters).
- Route handlers stay thin: validate with Zod, authorise, call one service, return one envelope.

## Consequences

- 330+ unit and API tests run in seconds with no network or credentials.
- The Firestore adapter is the one place that knows Firestore; swapping the database means one
  new adapter, not a rewrite.
