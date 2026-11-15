# KinKeep — Build Plan

Rule: each phase ends deployed and green. Do not start a phase until the previous exit
check passes. Deploy from Phase 0 so the Cloud Run URL is never the last-minute risk.

## Kickoff prompt for Claude Code

```
Read CLAUDE.md and everything in docs/. Do not write code yet.
Reply with: (1) anything unclear or contradictory, (2) the file list for Phase 0 of
docs/BUILD_PLAN.md, (3) the exact versions you will install. Wait for my go.
```

Prompt for each later phase:

```
Start Phase N of docs/BUILD_PLAN.md. List the files you will add or change and the
tests you will write, then wait for my go. When finished, run npm run verify, show me
the output, and state which exit checks pass.
```

## Phases

### Phase 0 — Skeleton and first deploy
- Next.js + TypeScript strict, Tailwind, ESLint, Vitest, Playwright configured
- `src/` layout from ARCHITECTURE.md; `config.ts` parsing env with Zod; logger; `AppError`
- Security headers; `/api/health`; landing page with design tokens and font
- Dockerfile (multi-stage, standalone, non-root), `.dockerignore`, CI workflow
- Deploy to Cloud Run (SETUP.md)

Exit: `npm run verify` passes · CI green · Cloud Run URL serves the landing page and
`/api/health` returns 200.

### Phase 1 — Circles, passcodes, sessions (P0-1, P0-2, P0-3)
- Domain: permissions table. Server: passcode hashing, lockout, session cookie
- Repositories with interfaces and in-memory fakes; Firestore adapters
- Create circle, join flow, members page for the elder, sign out

Exit: tests for hashing, lockout, permissions and cross-circle isolation · e2e: create
a circle, sign out, sign back in · a removed member is refused on the next request.

### Phase 2 — Medicines, Today, adherence (P0-4, P0-5, P0-6, P0-13)
- Domain: schedule expansion, time zones, adherence
- Medicine CRUD; dose materialisation on write; Today view; mark taken or skipped
- Activity log on every write; circle dashboard with adherence and what changed

Exit: tests for schedule expansion across midnight and a DST change · editing a medicine
changes future doses only · e2e: add medicine → mark taken → dashboard updates.

### Phase 3 — Reminder engine and email (P0-8, P0-9, P0-11, P0-15)
- Domain: stage machine. Server: tick service, slot grouping, transactional claim
- `EmailSender` with console and Gmail adapters; templates with a text part
- Action tokens, `/act/[token]` confirm page, `POST /api/act`
- Cron auth; Cloud Scheduler job; demo circle and test-reminder button

Exit: tests prove a repeated tick sends nothing twice and an overlapping tick is safe ·
a real email arrives from the deployed app · one-tap Taken works from the email on a
phone · GET on the action link changes nothing.

### Phase 4 — Appointments and visit brief (P0-7, P0-10, P0-14)
- Appointment CRUD; 24-hour and 2-hour reminders through the same engine
- `AiClient` with Gemini adapter and fake; visit brief with schema validation, cache,
  non-AI fallback, print stylesheet

Exit: brief renders with Gemini on and with Gemini forced off · malformed AI output is
rejected by a test · appointment reminder email arrives.

### Phase 5 — Elder control and polish (P0-12)
- Alert switches per member wired into escalation
- Empty, loading and error states on every screen; copy pass against DESIGN.md
- Responsive check at 320 px and 200% zoom

Exit: a member with alerts off receives no missed-dose email (test) · every page passes
the DESIGN.md checklist.

### Phase 6 — Hardening and first scored submission
- axe on every page, zero violations; keyboard-only walk-through
- Security pass against ARCHITECTURE.md section 10; `npm audit`
- README per SUBMISSION.md; remove dead code and unused dependencies
- Fresh-clone test: clone, install, verify, run with `.env.example` values

Exit: SUBMISSION.md checklist complete → **submit scored attempt 1**.

### Phase 7 — P1 features, one at a time
Order: add by photo → ask before you change → refill tracker → weekly summary →
read aloud and language. Each must reach the Phase 6 bar before the next starts.

Exit: everything deployed and green → **submit scored attempt 2**. If any P1 feature is
not fully working, remove it from the UI before submitting.

## Submission strategy

- Two scored attempts; the last one is the score. Never use attempt 2 on a build that is
  less stable than attempt 1.
- Read the feedback from attempt 1 and spend the gap on the lowest-scoring criteria
  before adding features.
- A retry is available only for a technical failure of the platform, not for a low score.

## If the build window is short

Cut from the bottom of this list first; the top rows are the brief itself.

| Keep at all costs | Cut first |
| --- | --- |
| Passcode access, medicines, Today, mark taken | All of P1 and P2 |
| Upcoming, missed and appointment emails | Members page: seed three fixed roles instead |
| Cloud Run deploy with a working URL | 30-day adherence: keep 7-day only |
| One Gemini feature (visit brief) | Nudge stage: go straight from reminded to missed |
| Tests for domain logic, axe on main pages | What-changed feed: keep the log, drop the UI |

A one-day window: Phases 0–4 with the cuts above, then Phase 6.
A window of a few hours: Phase 0, a single-circle version of Phases 1–3, the visit
brief, then README and submit.
