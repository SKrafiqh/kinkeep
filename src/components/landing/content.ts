/** Landing page copy. Every line describes something KinKeep does today; nothing is invented. */

export const FACTS = [
  { value: '15 min', label: 'before each dose, one email lists every medicine due' },
  { value: '1 tap', label: 'to confirm, straight from the email, with no login' },
  { value: '60 min', label: 'before anyone else hears, and only people the elder chose' },
  { value: '3 roles', label: 'elder, caregiver and family, each with their own passcode' },
];

export const FEATURES = [
  {
    title: 'Today, with one big button',
    text: 'The elder sees today’s medicines grouped by time, with one large Taken button for each time and Skip beside it. Late and missed doses say so in words and icons, never colour alone. Read aloud speaks the whole day.',
    tags: ['Large type', 'Read aloud', 'Works on a phone'],
  },
  {
    title: 'Reminders that escalate gently',
    text: 'Fifteen minutes before a dose, one email to the elder. Still unconfirmed at thirty minutes, a gentle nudge to the elder only. At sixty, the dose is marked missed and the people the elder chose are told.',
    tags: ['Email', 'No spam'],
  },
  {
    title: 'One tap from the email',
    text: 'Each reminder carries a signed link that works once and expires. Opening it changes nothing, because mail scanners open links too. The dose is marked only when a person presses I took them.',
    tags: ['No app', 'No login'],
  },
  {
    title: 'The elder decides who is told',
    text: 'For each person the elder sets a role and three switches: missed doses, appointments and the weekly summary. Removing someone signs them out at once.',
    tags: ['Elder in control'],
  },
  {
    title: 'What changed, in plain words',
    text: 'Every change is written as a sentence the elder can read: “Priya changed Metformin from 500 mg to 1000 mg, yesterday 6:10 pm.”',
    tags: ['Shared record'],
  },
  {
    title: 'A brief for every doctor visit',
    text: 'Before an appointment, AI drafts one page from the records: doses taken since the last visit, the doses most often missed, medicine changes and questions to ask. A person can correct it, then print it. If the AI is unavailable, the same brief is built without it.',
    tags: ['AI draft, person decides', 'Printable', 'Not medical advice'],
  },
];

export const STEPS = [
  { time: '7:45 am', title: 'One reminder', text: 'An email to the elder lists every 8:00 medicine, with an I took them button.' },
  { time: '8:00 am', title: 'One tap', text: 'The elder taps Taken, in the app or the email. Everything stops here and nobody else is emailed.' },
  { time: '8:30 am', title: 'A gentle nudge', text: 'Still unconfirmed? A second email, to the same person only.' },
  { time: '9:00 am', title: 'The right people hear', text: 'Still unconfirmed, the dose is marked missed and only the people the elder chose are told. It can still be marked as taken late.' },
];

export const ROLES = [
  {
    name: 'The elder',
    lead: 'Runs the circle.',
    can: ['Marks doses taken with one tap', 'Decides each person’s role and alerts', 'Sees every change in plain words', 'Adds or removes anyone, at once'],
  },
  {
    name: 'Caregivers',
    lead: 'Do the day-to-day.',
    can: ['Add and edit medicines and visits', 'Mark doses on the elder’s behalf', 'Prepare and print the visit brief'],
  },
  {
    name: 'Family',
    lead: 'Stay informed.',
    can: ['See the schedule and how doses are going', 'Get the alerts the elder switched on'],
  },
];

export const QUESTIONS = [
  { q: 'Do we need to install an app?', a: 'No. KinKeep works in any browser, on a phone or a computer, and reminders arrive by email.' },
  {
    q: 'What if the elder does not use email?',
    a: 'Their reminders can go to a caregiver they choose. The elder still has their own passcode and the final say.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. KinKeep keeps the record and sends reminders. It never tells anyone to start, stop or change a medicine. The visit brief lists questions to ask your doctor or pharmacist.',
  },
  {
    q: 'Who can see the elder’s medicines?',
    a: 'Only people in the circle. The elder chooses each person’s role and what they are told, and can remove anyone straight away.',
  },
  {
    q: 'How safe is a six-digit passcode?',
    a: 'It is a convenience, kept careful: five wrong tries lock that person for 15 minutes, and passcodes are stored only as salted hashes, never as the digits.',
  },
  {
    q: 'What does the AI do?',
    a: 'Only one thing: before a doctor visit it drafts the one-page brief from the records. A person reads and can correct it before it is printed or shown.',
  },
];
