import type { AlertSettings, Circle, Member } from '@/domain/types';

type WithEmail = Member & { email: string };
const hasEmail = (member: Member | undefined): member is WithEmail => member !== undefined && member.email !== null;

/** Who gets the elder's own reminders: the member the elder chose, else the elder, else nobody. */
export function elderRecipient(circle: Circle, members: Member[]): WithEmail | null {
  const chosen = members.find((member) => member.id === circle.remindersTo);
  if (hasEmail(chosen)) return chosen;
  const elder = members.find((member) => member.role === 'elder');
  return hasEmail(elder) ? elder : null;
}

/** Members the elder switched this alert on for. The elder is never in this list. */
export function alertRecipients(members: Member[], alert: keyof AlertSettings): WithEmail[] {
  return members.filter(
    (member): member is WithEmail => member.role !== 'elder' && member.alerts[alert] && hasEmail(member),
  );
}

/** One entry per address, first wins. */
export function uniqueByEmail(members: WithEmail[]): WithEmail[] {
  return members.filter((member, index) => members.findIndex((other) => other.email === member.email) === index);
}

/** "Your" when writing to the elder, "Mr Rao's" when writing to someone on their behalf. */
export function whose(recipient: Member, circle: Circle): string {
  return recipient.role === 'elder' ? 'Your' : `${circle.elderName}'s`;
}
