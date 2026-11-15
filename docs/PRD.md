# KinKeep — Product Requirements

Status: draft v1 · Owner: Rafiqh · Challenge: Elderly Care & Medication Management Platform

## 1. Summary

KinKeep is a shared care circle for one elderly person. The elder, their caregivers and
their family see the same medication schedule and appointments, each through their own
passcode. Reminders go out by email, missed doses escalate to the right people, and the
elder decides who can see, change and be alerted about what.

One-line pitch: **the care circle the elder runs, not one that is run about them.**

## 2. Problem

- Older adults on several medicines miss doses, double-dose, or lose track after a
  prescription change.
- Families find out late, usually by phone, and from one overloaded caregiver.
- Most reminder apps treat the elder as the subject of monitoring. They lose trust and
  stop using it.
- Doctor visits start from memory instead of from what actually happened.

## 3. Users and roles

| Role | Who | Can do |
| --- | --- | --- |
| Elder (owner) | The person receiving care | Everything, plus manage members, roles and alert settings |
| Caregiver | Spouse, adult child, paid carer | View, add and edit medicines and appointments, mark doses |
| Family | Wider family | View and receive the alerts the elder allows |

A relative may set the circle up on the elder's behalf. The elder role still belongs to
the elder and has its own passcode. An elder without email is supported: their reminders
go to a caregiver they choose.

## 4. Product principles

1. **Elder at the centre.** Nothing about the elder's care changes silently. They see
   every change in plain words and control who is alerted.
2. **Escalate, do not spam.** Remind the elder first. Involve others only when a dose
   stays unconfirmed.
3. **One tap.** Confirming a dose never needs a login: the email itself carries the action.
4. **Readable by default.** Large type, strong contrast, plain language, no jargon.
5. **AI drafts, people decide.** Gemini prepares; a person confirms. No medical advice.

## 5. Scope

### P0 — must work end to end before the first scored submission

| # | Feature | Acceptance criteria |
| --- | --- | --- |
| P0-1 | Create a care circle | Creator enters elder name, time zone, own name, email and role. System returns a circle code and the creator sets a 6-digit passcode. |
| P0-2 | Passcode access | Enter circle code, pick your name, enter passcode. Five wrong attempts lock that member for 15 minutes. Session lasts 12 hours. Sign out works. |
| P0-3 | Members and roles | Elder adds members (name, email, role), each with a one-time setup passcode they must change. Elder can change a role or remove a member; removal ends that member's access immediately. |
| P0-4 | Medications | Add, edit, pause, delete. Fields: name, strength, form, instructions, times of day, days of week, start date, optional end date. Editing regenerates future doses only. |
| P0-5 | Today view | Shows today's doses grouped by time with one large action each: Taken, Skip. Late and missed doses are clearly marked. Works on a phone. |
| P0-6 | Adherence | Circle dashboard shows 7-day and 30-day adherence overall and per medicine, plus the last 7 days as a simple day strip. |
| P0-7 | Appointments | Add, edit, delete: doctor, speciality, place, date and time, notes. Upcoming list sorted by date. |
| P0-8 | Email: upcoming dose | 15 minutes before a dose slot, one email to the elder listing every medicine in that slot. |
| P0-9 | Email: missed dose with escalation | Still unconfirmed 30 minutes after: a nudge to the elder. Still unconfirmed 60 minutes after: marked missed, and an email to each member the elder allowed. |
| P0-10 | Email: appointments | Reminder 24 hours and 2 hours before, to the elder and opted-in members. |
| P0-11 | One-tap actions | Each dose email has Taken and Skip links. The link opens a confirm page; the action happens on the button press. Links expire and work once. |
| P0-12 | Elder control | Per member, the elder sets role and three alert switches: missed doses, appointments, weekly summary. |
| P0-13 | What changed | Every create, edit, delete and role change is recorded with who and when, shown as a plain-language feed on the elder's home. |
| P0-14 | Visit brief (Gemini) | For any upcoming appointment, generate a one-page brief: adherence since the last visit, missed-dose patterns, medicine changes, and questions to ask. Printable. Shows the "not medical advice" line. |
| P0-15 | Demo circle | "Try a demo" creates a sample circle with realistic data and a dose due in a few minutes. "Send me a test reminder" sends one real email to the address entered, rate limited. |

### P1 — differentiators, build in this order after P0 is deployed and green

1. **Add by photo.** Photograph or paste a prescription or medicine label; Gemini returns
   a draft schedule; the user corrects and confirms each line.
2. **Ask before you change.** Edits by caregivers to a medicine arrive as a proposal the
   elder approves or declines. A circle-level switch lets the elder delegate approval to
   one trusted caregiver.
3. **Refill tracker.** Optional pill count per medicine; a refill email at 7 days of
   supply left.
4. **Weekly summary.** A Sunday email with the week's adherence in two or three plain
   sentences.
5. **Read aloud and language.** Read the Today view aloud using the browser speech API;
   switch UI language (English, Hindi, Telugu, Tamil).

### P2 — only if time remains

- Calendar file (.ics) for appointments
- Installable app with offline Today view
- Quiet hours for family alerts

## 6. Key flows

**Set up (caregiver on the elder's behalf).** Create circle → set own passcode → add the
elder as owner with a setup passcode → add first medicine → see Today view.

**A normal morning.** 07:45 email "Your 8:00 medicines (3)" → elder taps Taken → confirm
page → done. The dashboard updates for everyone. Nobody else is emailed.

**A missed dose.** No action by 08:30 → gentle nudge to the elder → no action by 09:00 →
dose marked missed → the daughter (alerts on) gets "Dad has not confirmed his 8:00
medicines" with a link to the circle. The elder can still mark it "taken late".

**Before a doctor visit.** 24-hour reminder includes "Open visit brief" → brief shows the
last 30 days, the two medicines most often missed, and five questions → print or show on
the phone.

**A prescription change.** Caregiver edits a dose → the elder's home shows "Priya changed
Metformin from 500 mg to 1000 mg, yesterday 6:10 pm".

## 7. Reminder rules

- A "slot" is every dose for one circle due at the same minute. One slot produces one
  email per recipient, never one per medicine.
- Stages per dose: `scheduled → reminded → nudged → missed`, or `taken` / `skipped` at
  any point. Taken after the missed stage is recorded as taken late.
- Lead, nudge and escalation times default to 15, 30 and 60 minutes and are constants in
  one file.
- A dose is never escalated to someone the elder has not opted in.
- The same email is never sent twice for the same stage of the same slot.

## 8. AI rules

- AI features: visit brief (P0), add by photo (P1), weekly summary wording (P1).
- No dosing advice, no diagnosis, no interaction verdicts. The brief may list "questions
  to ask your doctor or pharmacist".
- Every AI output is labelled as AI-generated and editable before it is saved or printed.
- If Gemini fails or is rate limited, the visit brief falls back to a non-AI version
  built from the same data.

## 9. Non-goals

- Not a medical device. No clinical decision support, no drug-interaction checker
  (an unreliable answer here is worse than none).
- No SMS, WhatsApp or push notifications. The brief specifies email.
- No multiple elders per account, no billing, no admin console.
- No storage of real patient records. Demo data only during judging.

## 10. Brief-to-feature traceability

| Requirement in the challenge brief | Where KinKeep answers it |
| --- | --- |
| Manage daily medications, appointments, routines | P0-4, P0-5, P0-7 |
| Keep family and caretakers informed | P0-9, P0-10, P0-13, P1-4 |
| Shared ecosystem with secure passcode-based access | P0-1, P0-2, P0-3 |
| View, add, edit, manage schedules | P0-4, P0-7 |
| Track adherence | P0-5, P0-6 |
| Monitor upcoming appointments | P0-7, P0-10 |
| Email reminders: missed, upcoming, appointments | P0-8, P0-9, P0-10 |
| Beyond a basic reminder app | P0-9 escalation, P0-11 one-tap, P0-14 visit brief, P1-1, P1-2 |
| Smarter, more accessible, reliable, collaborative | P0-14, DESIGN.md, idempotent engine, P0-13 |
| Elder at the centre of their own decisions | P0-12, P0-13, P1-2 |

## 11. Open questions

1. How long is the build window? If it is hours rather than days, see the cut list in
   `BUILD_PLAN.md`.
2. Is Claude Code permitted, or must the build happen in Antigravity or AI Studio?
3. Is there a repository size limit? Until confirmed, keep the repo under 1 MB of source.
4. Official hashtags and accounts to tag in the LinkedIn post.
