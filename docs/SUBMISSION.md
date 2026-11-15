# KinKeep — Submission Kit

## 1. What the platform asks for

- Public GitHub repository link
- Deployed project link (Cloud Run)
- Brief description of the project
- LinkedIn post (mandatory per the briefing)

Two scored attempts; the last one counts.

## 2. Pre-submission checklist

Repository
- [ ] Public, all work merged to the default branch, no secrets anywhere in history
      (search for `key`, `secret`, `password`, `.env`)
- [ ] `.env.example` present; `.gitignore` covers env files, build output, node_modules
- [ ] No generated files, large images or binaries
- [ ] Fresh clone → `npm install` → `npm run verify` passes
- [ ] CI badge green on the default branch
- [ ] README complete (section 3) and true to the code

Deployed app
- [ ] Cloud Run URL loads in a private window on a phone and a laptop
- [ ] `/api/health` returns 200
- [ ] Demo circle works without any setup
- [ ] A real reminder email arrives at an outside address; one-tap Taken works
- [ ] Visit brief generates; fallback works with the key removed in a test deploy
- [ ] Scheduler job's last run succeeded
- [ ] `--min-instances 1` set for the judging window

Quality
- [ ] axe: zero violations on every page
- [ ] Keyboard-only pass of the main flow
- [ ] `npm audit` shows no high or critical issues
- [ ] No half-built feature reachable from the UI

## 3. README outline

1. Name, one-line pitch, live URL, CI badge
2. The problem, in three sentences
3. What makes it different: elder control, escalation ladder, one-tap email, visit brief
4. Two-minute tour (numbered steps a judge can follow on the demo circle)
5. Features, grouped by the challenge brief's own wording
6. Architecture diagram (Mermaid) and a short walk-through of one reminder
7. Google services used, each with the file where it is used
8. How each evaluation criterion is addressed (table below)
9. Run locally · Run tests · Deploy
10. Security notes and known limits
11. Accessibility statement
12. Roadmap · Licence

Evaluation table for the README. Fill the right-hand column with real paths and commands
only after the code exists; do not claim scores.

| Criterion | Where to look |
| --- | --- |
| Problem-statement alignment | Requirement table in `docs/PRD.md` section 10 |
| Code quality | `src/domain/` pure logic, strict TypeScript, ESLint config, CI |
| Security | `src/server/auth/`, headers config, `docs/ARCHITECTURE.md` section 10 |
| Efficiency | `nextActionAt` query, server components, cached AI output, image size |
| Testing | `tests/`, how to run, what is covered |
| Accessibility | `docs/DESIGN.md` checklist, axe e2e, font and contrast choices |
| Google services | Cloud Run, Firestore, Cloud Scheduler, Secret Manager, Cloud Build, Cloud Logging, Gmail, Google Fonts |
| Scalability | Stateless container, idempotent engine, growth path |

## 4. Brief description for the platform (edit to match what shipped)

> KinKeep is an elder-led care circle. The elder, caregivers and family share one
> medication schedule and appointment list through personal passcodes. Email reminders
> carry one-tap "Taken" links, missed doses escalate only to the people the elder has
> chosen, every change is shown to the elder in plain words, and AI prepares a visit
> brief before each doctor appointment. Runs on Cloud Run with Firestore, Cloud Scheduler
> and Adaption Labs AI.

## 5. Two-minute demo script for judges

1. Open the URL → "Try a demo". You are signed in as the elder, Mr Rao.
2. Today view: three medicines at 8:00. Tap Taken. The dashboard updates.
3. Enter your own email → "Send me a test reminder". Open the email on your phone, tap
   Taken, confirm. No login needed.
4. Circle → What changed: "Priya changed Metformin…" in plain words.
5. Members: turn off missed-dose alerts for one relative. The elder decides.
6. Appointments → Open visit brief: adherence, patterns and questions for the doctor.
7. Sign out, join as the daughter with her passcode: same circle, caregiver's view.

## 6. LinkedIn post

Rules: say what it does in the first two lines, show one screenshot or a 30-second
screen recording, link the live app and the repo, tag the organisers with the official
handles and hashtags (confirm these with the organisers; do not guess). Post only what
actually shipped.

Draft:

> Most medication apps remind the elder and report to the family. The elder becomes the
> one being monitored, and stops using it.
>
> For PromptWars I built KinKeep: a care circle the elder runs.
>
> What it does
> • One shared schedule for the elder, caregivers and family, each with a personal passcode
> • Email reminders with a one-tap "Taken" button. No app, no login
> • If a dose stays unconfirmed, it escalates only to the people the elder has chosen
> • Every change is shown to the elder in plain words: who changed what, and when
> • Before a doctor visit, AI prepares a one-page brief from what actually happened
>
> How it is built
> Next.js on Cloud Run · Firestore · Cloud Scheduler · Adaption Labs AI · built by prompting, with
> tests and an accessibility check on every page
>
> Try it: [live URL]
> Code: [GitHub URL]
>
> What would you want an app like this to do for your family?
>
> [official hashtags] [organiser tags]

If you have a true story of your own behind this, open with it instead: a real first
line outperforms a general one. Do not invent one.

## 7. Pitch outline if selected for the top 10 (about 3 minutes)

1. Problem (20 s): reminders exist; trust and coordination do not.
2. Insight (20 s): the elder must be the owner, not the subject.
3. Live demo (90 s): section 5, steps 1–6.
4. How it works (30 s): one diagram; idempotent engine; why it scales.
5. What is next (20 s): add by photo, approvals, refill tracking.
