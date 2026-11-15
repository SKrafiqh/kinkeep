import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { can, homePath, type Permission } from '@/domain/permissions';
import { SESSION_COOKIE } from './auth/session';
import { getDeps } from './deps';
import { memberForSession, type MemberContext } from './services/sessions';

/** The signed-in member for a server-rendered page, or null. Read once per request, shared by layout and page. */
export const currentMember = cache(async (): Promise<MemberContext | null> => {
  const deps = getDeps();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return memberForSession(deps, token, deps.clock.now());
});

/** The signed-in member, or a redirect to the join screen. Setup passcodes are sent to change it first. */
export async function requireMember(permission: Permission = 'circle:view'): Promise<MemberContext> {
  const who = await currentMember();
  if (!who) redirect('/join');
  if (who.member.mustChangePasscode) redirect('/passcode');
  if (!can(who.member.role, permission)) redirect(homePath(who.member.role));
  return who;
}
