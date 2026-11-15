import { renderEmail } from './layout';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface SlotMedicine {
  name: string;
  strength: string;
}

export interface SlotEmail {
  /** "Your" for the elder, "Mr Rao's" for someone receiving reminders on their behalf. */
  whose: string;
  slotTime: string;
  medicines: SlotMedicine[];
  /** Confirm page for the one-tap action. */
  actUrl: string;
}

const medicineLines = (medicines: SlotMedicine[]): string[] => medicines.map((med) => `${med.name} ${med.strength}`.trim());

function slotActions(actUrl: string) {
  return {
    primary: { label: 'I took them', url: actUrl },
    secondary: { label: 'Skip this dose', url: `${actUrl}?do=skip` },
  };
}

/** Sent 15 minutes before a slot: every medicine in it, in one email. */
export function upcomingEmail(input: SlotEmail, note?: string): EmailContent {
  const heading = `${input.whose} ${input.slotTime} medicines`;
  return {
    subject: `${heading} (${input.medicines.length})`,
    ...renderEmail({
      heading,
      lines: [...(note ? [note] : []), 'It is nearly time for:'],
      items: medicineLines(input.medicines),
      ...slotActions(input.actUrl),
    }),
  };
}

/** Sent 30 minutes after an unconfirmed slot, to the same person. */
export function nudgeEmail(input: SlotEmail): EmailContent {
  return {
    subject: `Reminder: ${input.whose.toLowerCase()} ${input.slotTime} medicines are waiting`,
    ...renderEmail({
      heading: `${input.whose} ${input.slotTime} medicines are waiting`,
      lines: ['These have not been confirmed yet:'],
      items: medicineLines(input.medicines),
      ...slotActions(input.actUrl),
    }),
  };
}

/** Sent 60 minutes after an unconfirmed slot, only to members the elder opted in. */
export function missedEmail(input: {
  elderName: string;
  slotTime: string;
  medicines: SlotMedicine[];
  circleUrl: string;
}): EmailContent {
  const subject = `${input.elderName} has not confirmed the ${input.slotTime} medicines`;
  return {
    subject,
    ...renderEmail({
      heading: subject,
      lines: [`These were due at ${input.slotTime} and are still not confirmed:`],
      items: medicineLines(input.medicines),
      primary: { label: 'Open the circle', url: input.circleUrl },
      footer: `${input.elderName} chose to alert you about missed doses. A quick call may help; a dose can still be marked as taken late.`,
    }),
  };
}

/** Sent 24 hours and 2 hours before an appointment. */
export function appointmentEmail(input: {
  kind: 'h24' | 'h2';
  whose: string;
  doctor: string;
  speciality: string;
  place: string;
  when: string;
  briefUrl: string;
}): EmailContent {
  const subject = `${input.kind === 'h24' ? 'Coming up' : 'Soon'}: ${input.doctor}, ${input.when}`;
  const details = [input.speciality, input.place].filter((part) => part !== '').join(' · ');
  return {
    subject,
    ...renderEmail({
      heading: `${input.whose} appointment with ${input.doctor}`,
      lines: [`When: ${input.when}`, ...(details ? [details] : []), 'The visit brief shows what happened since the last visit and questions to ask.'],
      primary: { label: 'Open visit brief', url: input.briefUrl },
    }),
  };
}

/** The Sunday summary: the week in two or three plain sentences. */
export function weeklySummaryEmail(input: { elderName: string; sentences: string[]; circleUrl: string }): EmailContent {
  const subject = `${input.elderName}'s week in medicines`;
  return {
    subject,
    ...renderEmail({ heading: subject, lines: input.sentences, primary: { label: 'Open the circle', url: input.circleUrl } }),
  };
}

/** Sent by "Send me a test reminder" when there is no open dose to attach one-tap links to. */
export function sampleEmail(todayUrl: string): EmailContent {
  return {
    subject: 'Your test reminder',
    ...renderEmail({
      heading: 'This is your test reminder',
      lines: ['Dose reminders look like this and arrive 15 minutes before each dose, with a button to confirm it.', 'There is no dose waiting right now, so this one has no confirm button.'],
      primary: { label: 'Open Today', url: todayUrl },
    }),
  };
}
