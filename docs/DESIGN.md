# KinKeep — Design and Accessibility

UI is scored twice: by the automated accessibility check and by human judges using the
deployed app. This file is the rulebook for both.

## 1. Design position

Calm, warm, legible. It should feel like a well-kept paper notebook on the kitchen table,
not a hospital dashboard. One primary action per screen. Words before icons.

Two modes share one design system:

- **Today (elder-first).** One column, very large type, one large button per slot.
  Nothing on this screen requires reading small text or precise tapping.
- **Circle (caregivers and family).** Denser: adherence, appointments, what changed.

A member's role sets the default landing page: elder → `/today`, others → `/circle`.

## 2. Tokens

Typography — Atkinson Hyperlegible, loaded through the framework's Google Fonts
integration (self-hosted at build time, no runtime request to Google).

| Token | Circle | Today |
| --- | --- | --- |
| Body | 18 px / 1.6 | 22 px / 1.6 |
| Label | 16 px, weight 700 | 20 px, weight 700 |
| Heading 2 | 24 px | 30 px |
| Heading 1 | 32 px | 40 px |

Colour — define as CSS variables; check every pair with a contrast tool before use.

| Role | Light | Notes |
| --- | --- | --- |
| Background | `#FBF7F0` warm paper | |
| Surface | `#FFFFFF` | Cards |
| Ink | `#16262E` | Body text; aim for 7:1 or better on background |
| Primary | `#0F5C5C` deep teal | Buttons, links; white text on it |
| Accent | `#B45309` amber | Highlights, never for body text |
| Taken | `#166534` | Always with a check icon and the word "Taken" |
| Missed | `#9F1239` | Always with an alert icon and the word "Missed" |
| Due | `#1D4ED8` | Always with a clock icon and the time |
| Border | `#D6CFC2` | 3:1 against background for control outlines |

Provide a dark theme through the same variables only if time allows; a correct light
theme beats two half-checked themes.

Spacing and shape: 8 px grid; card radius 16 px; buttons radius 12 px; minimum target
48 x 48 px (56 px on Today); at least 8 px between adjacent targets.

## 3. Components

Button (primary, secondary, quiet, danger) · Card · Field (label, hint, error) ·
TimeChips (pick dose times) · DayChips · DoseSlotCard · StatusBadge · AdherenceBar ·
DayStrip · MemberRow with alert switches · ActivityItem · EmptyState · Toast (live
region) · ConfirmDialog · PasscodeInput (six boxes, numeric keypad, paste supported).

Every component ships with: visible focus state, disabled state, loading state, and an
accessible name.

## 4. Screens

| Screen | Must show | Primary action |
| --- | --- | --- |
| Landing | What KinKeep is in one sentence, three choices | Create a circle |
| Join | Circle code, then names, then passcode | Continue |
| Today | Date, greeting, slots in time order, each with medicines and status | Taken |
| Circle | Adherence (7 and 30 days), next appointment, what changed | Add medicine |
| Medications | List with next dose time and status | Add medicine |
| Medication form | Name, strength, form, instructions, times, days, dates | Save |
| Appointments | Upcoming first, past collapsed | Add appointment |
| Visit brief | Summary, patterns, changes, questions, disclaimer | Print |
| Members | Each member, role, three alert switches | Add member |
| Act (from email) | Slot time, medicine list, two large buttons | I took them |

Every list has an empty state that explains what will appear and offers the first action.
Every async action has a loading state and a plain-language error with a retry.

## 5. Copy

- Second person, short sentences, no medical or technical jargon.
- Say what happened and what to do next: "Saved. Your 8:00 pm reminder is set."
- Errors never blame: "That passcode did not match. Three tries left."
- Times in the circle's time zone, 12-hour with am/pm; dates as "Mon 16 Nov".
- Emails: subject states the action ("Your 8:00 am medicines (3)"), one button.
- Fixed line under every AI output: "Prepared by AI from your records. Not medical
  advice. Check with your doctor or pharmacist."

## 6. Accessibility checklist (WCAG 2.2 AA; Today targets AAA contrast)

- [ ] One `h1` per page; headings in order; landmarks: header, nav, main, footer
- [ ] "Skip to main content" link as the first focusable element
- [ ] Every input has a visible `label`; hints and errors linked with `aria-describedby`
- [ ] Errors announced, focus moved to the first invalid field
- [ ] Full keyboard use; logical tab order; no keyboard traps; visible 3 px focus ring
- [ ] Dialogs trap focus, close on Escape, and return focus to the opener
- [ ] Status never by colour alone: icon + text + colour
- [ ] Text contrast at least 4.5:1 (7:1 on Today); controls and focus ring at least 3:1
- [ ] Targets at least 48 x 48 px with spacing
- [ ] Layout works at 320 px width and at 200% zoom without horizontal scrolling
- [ ] `prefers-reduced-motion` respected; nothing flashes or auto-plays
- [ ] Live region announces "Marked as taken", save results and errors
- [ ] `lang` set on `html`; page titles are unique and descriptive
- [ ] Session timeout warns before signing out and keeps unsaved input
- [ ] Icons are decorative (`aria-hidden`) or have a text alternative
- [ ] axe reports zero violations on every page in CI

## 7. What to avoid

- Carousels, hover-only controls, placeholder-as-label, toasts as the only confirmation
- Light grey text, thin fonts, text over images
- Icon-only buttons on Today
- More than one primary button on a screen
- Modal chains: one dialog at a time
