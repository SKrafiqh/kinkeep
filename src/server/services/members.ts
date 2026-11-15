import type { AlertSettings, Circle, Member } from '@/domain/types';
import { MAX_MEMBERS } from '@/lib/constants';
import { AppError, notFound } from '@/lib/errors';
import type { AddMemberInput, UpdateMemberInput } from '@/lib/schemas';
import { randomPasscode } from '../auth/passcode';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { listMembers } from '../repos/queries';
import { recordActivity } from './activity';
import { ALERTS_OFF, buildMember } from './circles';
import type { MemberContext } from './sessions';

/** A member without passcode material; the only member shape that leaves the server. */
export interface MemberView extends Pick<Member, 'id' | 'name' | 'email' | 'role' | 'alerts' | 'mustChangePasscode'> {
  receivesElderReminders: boolean;
}

const ALERT_LABELS: Record<keyof AlertSettings, string> = {
  missedDose: 'missed-dose alerts',
  appointments: 'appointment reminders',
  weeklySummary: 'the weekly summary',
};

/** Strips passcode material from a member before it leaves the server. */
export function toMemberView(member: Member, circle: Circle): MemberView {
  const { id, name, email, role, alerts, mustChangePasscode } = member;
  return { id, name, email, role, alerts, mustChangePasscode, receivesElderReminders: circle.remindersTo === id };
}

/** Every current member of a circle, as views safe to send to the browser. */
export async function listMemberViews(deps: Deps, circle: Circle): Promise<MemberView[]> {
  return (await listMembers(deps.store, circle.id)).map((member) => toMemberView(member, circle));
}

async function assertNameFree(deps: Deps, circleId: string, name: string, exceptId?: string): Promise<void> {
  const taken = (await listMembers(deps.store, circleId)).some(
    (m) => m.id !== exceptId && m.name.toLowerCase() === name.toLowerCase(),
  );
  // People pick their own name on the join screen, so names must be unique in a circle.
  if (taken)
    throw new AppError('CONFLICT', 'Check the name.', { name: 'Someone in the circle already has that name.' });
}

/** Adds a helper with a one-time setup passcode, returned once for the elder to pass on. */
export async function addMember(
  deps: Deps,
  who: MemberContext,
  input: AddMemberInput,
): Promise<{ member: MemberView; setupPasscode: string }> {
  await assertNameFree(deps, who.circle.id, input.name);
  if ((await listMembers(deps.store, who.circle.id)).length >= MAX_MEMBERS) {
    throw new AppError('CONFLICT', `A circle can have ${MAX_MEMBERS} members. Remove someone before adding another.`);
  }
  const setupPasscode = randomPasscode();
  const member = await buildMember(deps, {
    ...input,
    passcode: setupPasscode,
    mustChangePasscode: true,
    alerts: ALERTS_OFF,
  });
  await deps.store.set(paths.member(who.circle.id, member.id), member);
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'member.add',
    targetType: 'member',
    targetId: member.id,
    summary: `${who.member.name} added ${member.name} as ${member.role === 'caregiver' ? 'a caregiver' : 'family'}`,
  });
  return { member: toMemberView(member, who.circle), setupPasscode };
}

function describeChanges(
  actor: string,
  { before, after }: { before: Member; after: Member },
  remindersTo: { from: string | null; to: string | null },
): string[] {
  const lines: string[] = [];
  if (before.name !== after.name) lines.push(`${actor} renamed ${before.name} to ${after.name}`);
  if (before.role !== after.role)
    lines.push(`${actor} changed ${after.name}'s role from ${before.role} to ${after.role}`);
  if (before.email !== after.email) lines.push(`${actor} updated ${after.name}'s email`);
  for (const key of Object.keys(ALERT_LABELS) as Array<keyof AlertSettings>) {
    if (before.alerts[key] !== after.alerts[key]) {
      lines.push(`${actor} turned ${after.alerts[key] ? 'on' : 'off'} ${ALERT_LABELS[key]} for ${after.name}`);
    }
  }
  if (remindersTo.to !== remindersTo.from) {
    lines.push(
      remindersTo.to === after.id
        ? `${actor} chose ${after.name} to receive the dose reminders`
        : `${after.name} no longer receives the dose reminders`,
    );
  }
  return lines;
}

function nextRemindersTo(circle: Circle, after: Member, wants: boolean | undefined): string | null {
  if (wants === true) {
    if (after.email === null)
      throw new AppError('VALIDATION', 'Add an email first.', {
        email: `Add an email address for ${after.name} first.`,
      });
    return after.role === 'elder' ? null : after.id;
  }
  const isCurrent = circle.remindersTo === after.id;
  return isCurrent && (wants === false || after.email === null) ? null : circle.remindersTo;
}

/** Changes a member's name, email, role, alert switches, or whether they receive the elder's reminders. */
export async function updateMember(
  deps: Deps,
  who: MemberContext,
  memberId: string,
  input: UpdateMemberInput,
): Promise<MemberView> {
  const before = await deps.store.get<Member>(paths.member(who.circle.id, memberId));
  if (!before || before.removedAt !== null) throw notFound('member');
  if (before.role === 'elder' && input.role !== undefined)
    throw new AppError('VALIDATION', "The elder's role cannot be changed.");
  if (input.name !== undefined && input.name !== before.name)
    await assertNameFree(deps, who.circle.id, input.name, memberId);
  const { receivesElderReminders, ...fields } = input;
  const after: Member = { ...before, ...fields };
  const remindersTo = nextRemindersTo(who.circle, after, receivesElderReminders);
  await deps.store.set(paths.member(who.circle.id, memberId), after);
  if (remindersTo !== who.circle.remindersTo) await deps.store.update(paths.circle(who.circle.id), { remindersTo });
  const lines = describeChanges(who.member.name, { before, after }, { from: who.circle.remindersTo, to: remindersTo });
  if (lines.length > 0) {
    await recordActivity(deps, who.circle.id, who.member, {
      action: 'member.update',
      targetType: 'member',
      targetId: memberId,
      summary: lines.join('. '),
    });
  }
  return toMemberView(after, { ...who.circle, remindersTo });
}

/** Removes a helper. Their session stops working on the next request. */
export async function removeMember(deps: Deps, who: MemberContext, memberId: string): Promise<void> {
  const member = await deps.store.get<Member>(paths.member(who.circle.id, memberId));
  if (!member || member.removedAt !== null) throw notFound('member');
  if (member.role === 'elder') throw new AppError('VALIDATION', 'The elder cannot be removed from their own circle.');
  await deps.store.update(paths.member(who.circle.id, memberId), { removedAt: deps.clock.now() });
  if (who.circle.remindersTo === memberId) await deps.store.update(paths.circle(who.circle.id), { remindersTo: null });
  await recordActivity(deps, who.circle.id, who.member, {
    action: 'member.remove',
    targetType: 'member',
    targetId: memberId,
    summary: `${who.member.name} removed ${member.name} from the circle`,
  });
}
