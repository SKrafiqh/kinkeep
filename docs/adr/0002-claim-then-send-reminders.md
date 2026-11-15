# 0002. The reminder engine claims a stage before it sends

**Status:** Accepted

## Context

Cloud Scheduler calls `POST /api/cron/tick` every five minutes. Calls can be retried, run late,
or overlap with each other. An elder must never get the same reminder twice, and a missed-dose
alert must never go to someone the elder did not choose.

## Decision

- Dose events have deterministic ids (`medId_YYYYMMDD_HHmm`), so creating them twice is a no-op.
- The engine reads only events whose `nextActionAt` is due (one indexed field).
- For each slot it moves the stage inside a transaction first, and sends email only after the
  commit. Two overlapping ticks cannot both win the same stage.
- A failed send rolls the stage back with a five-minute retry, up to three attempts per stage.
- One failing item is logged and skipped; it never stops the items behind it.
- The stage machine itself is pure code (`src/domain/escalation.ts`).

## Consequences

- Repeated and overlapping ticks are safe; tests prove both (`tests/api/engine*.test.ts`).
- If the mail server fails after a partial send, the stage is not retried, so nobody gets a
  duplicate; the cost is that a recipient may miss that one email.
- Growth path: one Cloud Tasks task per slot, and sharding the tick by circle.
