import { formatTime } from '@/domain/time';
import type { Circle, Member } from '@/domain/types';
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS, MINUTE_MS } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import type { SignInInput } from '@/lib/schemas';
import { newPasscodeFields, verifyPasscode } from '../auth/passcode';
import { issueSession, readSession } from '../auth/session';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { findCircleByCode } from '../repos/queries';

export interface MemberContext {
  circle: Circle;
  member: Member;
  /** When the session cookie stops working. */
  expiresAt: number;
}

/**
 * The circle and member behind a session token, re-read from the database every time, so a
 * removed member or a changed role takes effect on the very next request.
 */
export async function memberForSession(
  deps: Deps,
  token: string | null | undefined,
  now: number,
): Promise<MemberContext | null> {
  const session = readSession(token, deps.config, now);
  if (!session) return null;
  const [circle, member] = await Promise.all([
    deps.store.get<Circle>(paths.circle(session.circleId)),
    deps.store.get<Member>(paths.member(session.circleId, session.memberId)),
  ]);
  if (!circle || !member || member.removedAt !== null) return null;
  return { circle, member, expiresAt: session.exp * 1000 };
}

const lockedError = (until: number, timeZone: string): AppError =>
  new AppError('LOCKED', `Too many tries. For safety, this passcode is locked until ${formatTime(until, timeZone)}.`);

interface Attempt {
  member: Member;
  lockedUntil: number | null;
  triesLeft: number;
}

// Counts the try before checking the passcode, so parallel guesses cannot outrun the lock.
function claimAttempt(deps: Deps, circleId: string, memberId: string, now: number): Promise<Attempt> {
  const path = paths.member(circleId, memberId);
  return deps.store.transaction(async (tx) => {
    const member = await tx.get<Member>(path);
    if (!member || member.removedAt !== null) throw new AppError('UNAUTHENTICATED', 'That passcode did not match.');
    if (member.lockedUntil !== null && member.lockedUntil > now)
      return { member, lockedUntil: member.lockedUntil, triesLeft: 0 };
    const failed = member.failedAttempts + 1;
    const locks = failed >= MAX_FAILED_ATTEMPTS;
    tx.update(path, {
      failedAttempts: locks ? 0 : failed,
      lockedUntil: locks ? now + LOCKOUT_MINUTES * MINUTE_MS : null,
    });
    return { member, lockedUntil: null, triesLeft: MAX_FAILED_ATTEMPTS - failed };
  });
}

/** The member, if the passcode is right. Five wrong tries lock that member for 15 minutes. */
export async function checkPasscode(deps: Deps, circle: Circle, memberId: string, passcode: string): Promise<Member> {
  const now = deps.clock.now();
  const { member, lockedUntil, triesLeft } = await claimAttempt(deps, circle.id, memberId, now);
  if (lockedUntil !== null) throw lockedError(lockedUntil, circle.timeZone);
  if (await verifyPasscode(passcode, member.passcodeSalt, member.passcodeHash, deps.config.PASSCODE_PEPPER)) {
    await deps.store.update(paths.member(circle.id, memberId), { failedAttempts: 0, lockedUntil: null });
    return { ...member, failedAttempts: 0, lockedUntil: null };
  }
  if (triesLeft === 0) throw lockedError(now + LOCKOUT_MINUTES * MINUTE_MS, circle.timeZone);
  throw new AppError(
    'UNAUTHENTICATED',
    `That passcode did not match. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`,
  );
}

/** Signs a member in and returns the Set-Cookie value for their 12-hour session. */
export async function signIn(
  deps: Deps,
  input: SignInInput,
): Promise<{ cookie: string; circle: Circle; member: Member }> {
  const circle = await findCircleByCode(deps.store, input.code);
  if (!circle) throw new AppError('NOT_FOUND', 'We could not find a circle with that code. Check it and try again.');
  const member = await checkPasscode(deps, circle, input.memberId, input.passcode);
  return { cookie: sessionCookieFor(deps, circle, member), circle, member };
}

/** A fresh session cookie for this member. */
export function sessionCookieFor(deps: Deps, circle: Circle, member: Member): string {
  return issueSession(deps.config, deps.clock.now(), { circleId: circle.id, memberId: member.id, role: member.role });
}

/** Replaces a member's passcode after checking the current one. Clears the "must change" flag. */
export async function changePasscode(
  deps: Deps,
  who: MemberContext,
  input: { current: string; passcode: string },
): Promise<void> {
  if (input.current === input.passcode) {
    throw new AppError('VALIDATION', 'Choose a new passcode.', {
      passcode: 'Choose a passcode different from the current one.',
    });
  }
  await checkPasscode(deps, who.circle, who.member.id, input.current);
  await deps.store.update(paths.member(who.circle.id, who.member.id), {
    ...(await newPasscodeFields(input.passcode, deps.config.PASSCODE_PEPPER)),
    mustChangePasscode: false,
  });
}
