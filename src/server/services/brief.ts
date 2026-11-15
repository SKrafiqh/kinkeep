import { adherenceByMedicine, adherenceOf, missedPatterns } from '@/domain/adherence';
import { briefPeriodStart, fallbackBrief, type BriefFacts } from '@/domain/brief';
import { formatDay, formatWhen } from '@/domain/time';
import type { Appointment, BriefContent, Circle, VisitBrief } from '@/domain/types';
import { AI_DAILY_CAP, BRIEF_DEFAULT_DAYS } from '@/lib/constants';
import { errorFields, log } from '@/lib/logger';
import { briefSchema } from '@/lib/schemas';
import { BRIEF_JSON_SCHEMA, BRIEF_SYSTEM, briefUserPrompt } from '../ai/briefPrompt';
import type { Deps } from '../deps';
import { paths } from '../repos/paths';
import { listActivity, listAppointments, listDoses } from '../repos/queries';
import { appointmentWhen, getAppointment } from './appointments';
import { takeDaily } from './quota';
import type { MemberContext } from './sessions';

const CHANGES_SCANNED = 100;
/** One retry when the model times out or replies off-schema, then the fallback brief. */
const AI_ATTEMPTS = 2;

async function gatherFacts(deps: Deps, circle: Circle, appointment: Appointment, now: number): Promise<BriefFacts> {
  const visits = await listAppointments(deps.store, circle.id);
  const { from, sinceVisit } = briefPeriodStart(
    visits.filter((v) => v.id !== appointment.id).map((v) => v.at),
    now,
  );
  const [doses, activity] = await Promise.all([
    listDoses(deps.store, circle.id, from, now),
    listActivity(deps.store, circle.id, CHANGES_SCANNED),
  ]);
  return {
    elderName: circle.elderName,
    doctor: appointment.doctor,
    speciality: appointment.speciality,
    visitWhen: appointmentWhen(appointment.at, circle),
    periodLabel: sinceVisit
      ? `since the last visit on ${formatDay(from, circle.timeZone)}`
      : `in the last ${BRIEF_DEFAULT_DAYS} days`,
    overall: adherenceOf(doses),
    byMedicine: adherenceByMedicine(doses),
    patterns: missedPatterns(doses, circle.timeZone),
    changes: activity
      .filter((item) => item.targetType === 'medication' && item.at >= from)
      .map((item) => `${item.summary} (${formatWhen(item.at, now, circle.timeZone)})`),
    notes: appointment.notes,
  };
}

// The model's reply is a draft: it must match the schema exactly or it is thrown away.
async function askAi(deps: Deps, facts: BriefFacts): Promise<BriefContent | null> {
  if (!deps.ai) return null;
  for (let attempt = 1; attempt <= AI_ATTEMPTS; attempt += 1) {
    try {
      const reply = await deps.ai.generateJson({
        system: BRIEF_SYSTEM,
        user: briefUserPrompt(facts),
        schema: BRIEF_JSON_SCHEMA,
      });
      const parsed = briefSchema.safeParse(reply);
      if (parsed.success) return parsed.data;
      log.warn('brief.ai_output_rejected', { attempt });
    } catch (error) {
      log.warn('brief.ai_failed', { attempt, ...errorFields(error) });
    }
  }
  return null;
}

async function saveBriefDoc(
  deps: Deps,
  circleId: string,
  appointmentId: string,
  brief: VisitBrief,
): Promise<VisitBrief> {
  await deps.store.update(paths.appointment(circleId, appointmentId), { brief });
  return brief;
}

/** Builds the visit brief with the AI model, or from the same facts without it, and caches it on the appointment. */
export async function generateBrief(deps: Deps, who: MemberContext, appointmentId: string): Promise<VisitBrief> {
  const now = deps.clock.now();
  const appointment = await getAppointment(deps, who.circle.id, appointmentId);
  const facts = await gatherFacts(deps, who.circle, appointment, now);
  // One counter per circle per day keeps a busy circle from draining the AI credits.
  const underCap = deps.ai !== null && (await takeDaily(deps, paths.quota(who.circle.id, 'ai'), AI_DAILY_CAP));
  const fromAi = underCap ? await askAi(deps, facts) : null;
  return saveBriefDoc(deps, who.circle.id, appointmentId, {
    content: fromAi ?? fallbackBrief(facts),
    generatedAt: now,
    source: fromAi ? 'ai' : 'fallback',
    editedBy: null,
  });
}

/** Saves a brief after a person has edited it. */
export async function saveBrief(
  deps: Deps,
  who: MemberContext,
  appointmentId: string,
  content: BriefContent,
): Promise<VisitBrief> {
  const appointment = await getAppointment(deps, who.circle.id, appointmentId);
  return saveBriefDoc(deps, who.circle.id, appointmentId, {
    content,
    generatedAt: appointment.brief?.generatedAt ?? deps.clock.now(),
    source: appointment.brief?.source ?? 'fallback',
    editedBy: who.member.name,
  });
}
