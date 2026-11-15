import { randomInt } from 'node:crypto';
import { nextWeeklySummaryAt } from '@/domain/summary';
import type { AlertSettings, Circle, Member, Role } from '@/domain/types';
import { REMINDER_DEFAULTS } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import type { CreateCircleInput } from '@/lib/schemas';
import { newPasscodeFields, randomPasscode } from '../auth/passcode';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { findCircleByCode, listMembers } from '../repos/queries';
import { newId } from '../repos/store';
import { recordActivity } from './activity';

// No 0/O or 1/I/L: codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
/** Collisions are rare at this code length, so a few tries are plenty. */
const CODE_ATTEMPTS = 5;

export const ALERTS_ON: AlertSettings = { missedDose: true, appointments: true, weeklySummary: true };
/** New members start with every alert off; the elder opts each person in. */
export const ALERTS_OFF: AlertSettings = { missedDose: false, appointments: false, weeklySummary: false };

/** A join code no other circle uses. */
export async function newCircleCode(deps: Deps): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    if ((await findCircleByCode(deps.store, code)) === null) return code;
  }
  throw new Error('Could not allocate a circle code');
}

/** A new member with a hashed passcode, not yet saved. */
export async function buildMember(
  deps: Deps,
  input: {
    name: string;
    email: string | null;
    role: Role;
    passcode: string;
    mustChangePasscode: boolean;
    alerts: AlertSettings;
  },
): Promise<Member> {
  const { passcode, ...rest } = input;
  return {
    id: newId(),
    ...rest,
    ...(await newPasscodeFields(passcode, deps.config.PASSCODE_PEPPER)),
    failedAttempts: 0,
    lockedUntil: null,
    removedAt: null,
  };
}

/** A new circle with default reminder settings and its first weekly summary scheduled, not yet saved. */
export function buildCircle(input: {
  elderName: string;
  timeZone: string;
  code: string;
  now: number;
  remindersTo: string | null;
  demoPasscode: string | null;
}): Circle {
  const { now, ...rest } = input;
  return {
    id: newId(),
    ...rest,
    createdAt: now,
    settings: { ...REMINDER_DEFAULTS },
    nextSummaryAt: nextWeeklySummaryAt(now, input.timeZone),
  };
}

/** The elder's own member when a relative sets the circle up: no email, and a passcode to change on first sign-in. */
function buildSetupElder(deps: Deps, elderName: string, setupPasscode: string): Promise<Member> {
  return buildMember(deps, {
    name: elderName,
    email: null,
    role: 'elder',
    passcode: setupPasscode,
    mustChangePasscode: true,
    alerts: ALERTS_ON,
  });
}

export interface CreatedCircle {
  circle: Circle;
  member: Member;
  /** Shown once to a relative who set the circle up; the elder must change it on first sign-in. */
  elderSetupPasscode: string | null;
}

/**
 * Creates a circle. The elder role always belongs to the elder: when a relative sets the
 * circle up, the elder gets their own member and a one-time passcode, and the relative
 * receives the elder's reminders until the elder decides otherwise.
 */
export async function createCircle(deps: Deps, input: CreateCircleInput): Promise<CreatedCircle> {
  const isElder = input.role === 'elder';
  if (!isElder && input.name.toLowerCase() === input.elderName.toLowerCase()) {
    throw new AppError('VALIDATION', 'Check the names.', { name: 'Your name must be different from theirs.' });
  }
  const creator = await buildMember(deps, {
    name: isElder ? input.elderName : input.name,
    email: input.email,
    role: input.role,
    passcode: input.passcode,
    mustChangePasscode: false,
    alerts: ALERTS_ON,
  });
  const elderSetupPasscode = isElder ? null : randomPasscode();
  const elder = elderSetupPasscode ? await buildSetupElder(deps, input.elderName, elderSetupPasscode) : null;
  const circle = buildCircle({
    elderName: input.elderName,
    timeZone: input.timeZone,
    code: await newCircleCode(deps),
    now: deps.clock.now(),
    remindersTo: isElder ? null : creator.id,
    demoPasscode: null,
  });
  await deps.store.set(paths.circle(circle.id), circle);
  await Promise.all(
    [creator, ...(elder ? [elder] : [])].map((member) => deps.store.set(paths.member(circle.id, member.id), member)),
  );
  await recordActivity(deps, circle.id, creator, {
    action: 'circle.create',
    targetType: 'circle',
    targetId: circle.id,
    summary: `${creator.name} created the circle`,
  });
  return { circle, member: creator, elderSetupPasscode };
}

/** What the join screen needs: display names only, never emails or roles. */
export async function lookupCircle(
  deps: Deps,
  code: string,
): Promise<{ elderName: string; members: Array<{ id: string; name: string }> }> {
  const circle = await findCircleByCode(deps.store, code);
  if (!circle) throw new AppError('NOT_FOUND', 'We could not find a circle with that code. Check it and try again.');
  const members = await listMembers(deps.store, circle.id);
  return { elderName: circle.elderName, members: members.map(({ id, name }) => ({ id, name })) };
}
