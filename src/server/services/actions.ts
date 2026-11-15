import { can } from '@/domain/permissions';
import { formatDay, formatTime } from '@/domain/time';
import type { Circle, DoseAction, DoseEvent, Member } from '@/domain/types';
import { first } from '@/lib/arrays';
import { AppError } from '@/lib/errors';
import { readActionToken, type ActionClaims } from '../auth/actionToken';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { actOnSlot, slotDoses } from './doses';

const INVALID = 'This link has expired or is not valid. Open the app to mark the dose.';

interface Verified {
  claims: ActionClaims;
  circle: Circle;
  doses: DoseEvent[];
}

// Membership is re-checked here: a link mailed to someone since removed must stop working.
async function verify(deps: Deps, token: string): Promise<Verified> {
  const claims = readActionToken(token, deps.config, deps.clock.now());
  if (!claims) throw new AppError('UNAUTHENTICATED', INVALID);
  const [circle, member, doses] = await Promise.all([
    deps.store.get<Circle>(paths.circle(claims.circleId)),
    deps.store.get<Member>(paths.member(claims.circleId, claims.memberId)),
    slotDoses(deps, claims.circleId, claims.slotKey),
  ]);
  const allowed =
    circle && member && member.removedAt === null && (can(member.role, 'dose:act') || circle.remindersTo === member.id);
  if (!circle || !allowed || doses.length === 0) throw new AppError('UNAUTHENTICATED', INVALID);
  return { claims, circle, doses };
}

export interface ActionPreview {
  elderName: string;
  day: string;
  slotTime: string;
  medicines: Array<{ name: string; strength: string }>;
  /** True when nothing in the slot can still be marked. */
  settled: boolean;
}

/** What the confirm page shows. Reads only: mail scanners fetch links, so GET must change nothing. */
export async function previewAction(deps: Deps, token: string): Promise<ActionPreview> {
  const { claims, circle, doses } = await verify(deps, token);
  const used = await deps.store.get(paths.usedToken(claims.jti));
  const { dueAt } = first(doses);
  return {
    elderName: circle.elderName,
    day: formatDay(dueAt, circle.timeZone),
    slotTime: formatTime(dueAt, circle.timeZone),
    medicines: doses.map((dose) => ({ name: dose.medName, strength: dose.strength })),
    settled: used !== null || doses.every((dose) => dose.status === 'taken' || dose.status === 'skipped'),
  };
}

/** Applies a one-tap action to every dose in the slot. A link works once. */
export async function performAction(deps: Deps, token: string, action: DoseAction): Promise<{ count: number }> {
  const { claims, doses } = await verify(deps, token);
  const firstUse = await deps.store.create(paths.usedToken(claims.jti), {
    circleId: claims.circleId,
    // A Date, so Firestore's TTL policy on this field can delete the record later.
    expireAt: new Date(claims.exp * 1000),
  });
  if (!firstUse) throw new AppError('CONFLICT', 'This link was already used. Open the app to see today’s doses.');
  const settled = await actOnSlot(deps, claims.circleId, first(doses).slotKey, {
    action,
    memberId: claims.memberId,
  }).catch(async (error: unknown) => {
    // The dose was not marked, so give the link back rather than leave the person stuck.
    await deps.store.delete(paths.usedToken(claims.jti));
    throw error;
  });
  if (settled.length === 0) throw new AppError('CONFLICT', 'These medicines were already marked. Nothing was changed.');
  return { count: settled.length };
}
