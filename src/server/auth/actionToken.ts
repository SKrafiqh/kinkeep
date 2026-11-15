import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ACTION_TOKEN_HOURS, HOUR_MS } from '@/lib/constants';
import type { Config } from '../config';
import { signToken, verifyToken } from './token';

const actionSchema = z.object({
  typ: z.literal('act'),
  /** Recorded on first use, so a link works once. */
  jti: z.string(),
  circleId: z.string(),
  slotKey: z.string(),
  memberId: z.string(),
  exp: z.number(),
});

export type ActionClaims = z.infer<typeof actionSchema>;

/** Token for the one-tap links in a dose email. It can only settle that slot, for 24 hours after it. */
export function issueActionToken(
  config: Config,
  slot: { circleId: string; slotKey: string; memberId: string; dueAt: number },
): string {
  const exp = Math.floor((slot.dueAt + ACTION_TOKEN_HOURS * HOUR_MS) / 1000);
  const { circleId, slotKey, memberId } = slot;
  return signToken({ typ: 'act', jti: randomUUID(), circleId, slotKey, memberId, exp }, config.ACTION_TOKEN_SECRET);
}

/** Claims of a valid, unexpired action token, or null. */
export function readActionToken(token: string, config: Config, now: number): ActionClaims | null {
  return verifyToken(token, config.ACTION_TOKEN_SECRET, actionSchema, now);
}
