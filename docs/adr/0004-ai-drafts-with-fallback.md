# 0004. AI drafts the visit brief; a non-AI brief is the fallback

**Status:** Accepted

## Context

A brief before a doctor visit is useful, but an AI must not give dosing advice, and the app must
keep working when the model is slow, down or out of credits.

## Decision

- The model (Adaption Labs, model id from `AI_MODEL`) only drafts the visit brief, on a button
  press. The records go in as delimited data, never as instructions.
- The reply must match a strict Zod schema; anything else is discarded after one retry.
- The facts and numbers come from code; the same facts build a non-AI brief whenever the model
  is unavailable, rejected, or over the per-circle daily cap.
- A person can edit the brief before printing, and every brief carries the "Not medical advice"
  line.

## Consequences

- The feature never blocks core care tasks, and tests cover AI on, AI off and malformed output.
- The provider is swappable behind the `AiClient` interface (`src/server/ai/client.ts`).
