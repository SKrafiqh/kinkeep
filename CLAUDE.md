# KinKeep — project guide for Claude Code

KinKeep is an elder-led care circle: one elderly person, their caregivers and family share
medications, appointments and email reminders, with the elder in control of who sees and
changes what.

Built for PromptWars (Google for Developers x Hack2skill), challenge:
"Elderly Care & Medication Management Platform". "KinKeep" is a working name; it lives in one
constant (`APP_NAME`) so it can be renamed in one edit.

## Read first

| File | Use it for |
| --- | --- |
| `docs/PRD.md` | What to build, scope tiers, acceptance criteria |
| `docs/ARCHITECTURE.md` | Stack, data model, routes, reminder engine, security |
| `docs/DESIGN.md` | UI rules and accessibility requirements |
| `docs/BUILD_PLAN.md` | Order of work and the exit check for each phase |
| `docs/SETUP.md` | Accounts, APIs, secrets, deploy commands |
| `docs/SUBMISSION.md` | README outline, submission checklist, LinkedIn post |

If these documents disagree, PRD wins on scope and ARCHITECTURE wins on implementation.
If code and docs disagree, fix whichever is wrong in the same change.

## How this project is judged

1. Automated repo assessment (leaderboard): code quality, security, efficiency, testing,
   accessibility, problem-statement alignment, effective use of Google services.
2. Top 10 are picked from the leaderboard and must have a working Cloud Run URL.
   A broken deployed link means disqualification.
3. Human judges then review the deployed app: relevance to the problem statement,
   uniqueness and quality. Organisers also named repo structure, scalability and UI.
4. Only two scored submissions are allowed and the last one is the one that counts.

Consequence: a small product that works end to end beats a large one with broken parts.
Never leave a half-built feature reachable from the UI.

## Stack (do not change without asking)

- Next.js (App Router, latest stable) + TypeScript strict, one container on Cloud Run
- Firestore (Native mode) through the server-side Admin SDK only
- Gemini through the `@google/genai` SDK, model name from `GEMINI_MODEL`
- Cloud Scheduler calling `POST /api/cron/tick` every 5 minutes
- Email through Gmail SMTP (Nodemailer) behind an `EmailSender` interface
- Secret Manager for secrets, Cloud Build for deploys, Cloud Logging for logs
- Tailwind CSS, Zod, Vitest, Playwright + axe

Check the installed version of every framework before using an API from memory.
Framework APIs change between major versions; read the local package docs or types.

## Commands

Create these scripts in Phase 0 and keep them working:

```
npm run dev         # local dev server
npm run lint        # ESLint, zero warnings allowed
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit + API tests
npm run test:e2e    # Playwright + axe
npm run build       # production build
npm run verify      # lint + typecheck + test + build
```

`npm run verify` must pass before any task is reported as done.

## Architecture rules

- `src/domain/` is pure TypeScript: no I/O, no framework imports, no `Date.now()`.
  Time comes in as an argument. Every function here has unit tests.
- `src/server/` owns all I/O behind interfaces: repositories, `EmailSender`, `AiClient`,
  `Clock`. Tests use in-memory fakes of these interfaces, never the network.
- Route handlers stay thin: parse with Zod, authorise, call one service, map the result.
- Client components never import from `src/server/`. Secrets never reach the browser.
- Store all instants in UTC. A circle has one IANA time zone. Convert only in
  `src/domain/time.ts`.
- The cron tick must be idempotent: running it twice sends each email once.

## Code conventions

- No `any`, no `@ts-ignore`, no non-null `!` on external data.
- Functions do one thing and stay under about 40 lines. Files stay under about 250.
- Named exports. One concept per file. No barrel files that create cycles.
- Validate every external input (request bodies, params, env, AI output) with Zod.
- Throw typed `AppError`s; map them to safe responses in one place. Never return stack
  traces or raw error messages to the client.
- Use the shared logger, not `console.log`. Never log passcodes, tokens, emails in full,
  or medication details.
- No dead code, no commented-out code, no TODOs without an owner and reason.
- Add a dependency only when it removes real work. Ask first. Prefer the platform
  (`node:crypto`, `Intl`, `fetch`).
- Comments explain why, not what. Public functions in `domain/` and `server/` get a
  one-line doc comment.

## Security rules

- Passcodes: HMAC with the server pepper, then scrypt with a per-member salt. Compare in
  constant time. Five wrong attempts lock that member for 15 minutes.
- Sessions: signed, HttpOnly, Secure, SameSite=Lax cookie. Re-check membership and role
  on every mutating request.
- Every query is scoped by `circleId` from the session, never from the request body.
- Mutations check the `Origin` header.
- Links in emails carry an HMAC-signed, expiring, single-purpose token. The GET page has
  no side effects; the action happens on POST (mail scanners pre-fetch links).
- The cron route accepts only a valid Cloud Scheduler OIDC token (or `CRON_SECRET` in
  local dev).
- Security headers on every response, including a Content-Security-Policy.
- No secrets in the repo. `.env.example` lists names only.

## AI rules

- Gemini output is a draft. A person confirms before anything is saved.
- No dosing advice, diagnosis, or instructions to start, stop or change a medicine.
  Every AI surface shows the "not medical advice" line.
- Request structured JSON, validate it with Zod, and fail closed on a mismatch.
- Treat scanned text and user notes as untrusted data inside the prompt, never as
  instructions.
- The app must work with Gemini unavailable: AI features show a clear fallback, core
  features are unaffected.

## Accessibility rules

- Target WCAG 2.2 AA everywhere; the elder "Today" view aims for AAA contrast.
- Semantic HTML first. Every control has a visible label and a visible focus ring.
- Touch targets at least 48 x 48 px. Body text at least 18 px.
- Never signal state by colour alone: pair colour with an icon and words.
- Respect `prefers-reduced-motion`. Announce async results in a live region.
- The axe e2e check must report zero violations on every page.

## Working agreement

- Work one phase of `docs/BUILD_PLAN.md` at a time. Do not start the next phase until
  the exit check passes.
- Before coding a phase, list the files you will create or change and wait for a go.
- Write the domain function and its test together.
- Commit small, with messages in the form `feat: ...`, `fix: ...`, `test: ...`,
  `docs: ...`, `chore: ...`.
- Keep the repo small: no binaries, no screenshots over 200 KB, no generated files.
- When something is ambiguous and the answer changes the data model or security,
  ask. Otherwise choose the simpler option and note it in the commit message.
- Update `README.md` whenever a user-visible feature lands. The README must never claim
  something the code does not do.
