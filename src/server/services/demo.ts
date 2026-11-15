import { buildDoseEvent } from '@/domain/schedule';
import { addDays, localDate, localTime, zonedToInstant } from '@/domain/time';
import type { Activity, Appointment, Circle, DoseEvent, DoseStatus, Medication, Member } from '@/domain/types';
import { first } from '@/lib/arrays';
import { DAY_MS, DEMO_GLOBAL_CAP, MINUTE_MS } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { randomPasscode } from '../auth/passcode';
import type { Deps } from '../deps';
import { materialiseMedication } from '../reminders/materialise';
import { paths } from '../repos/paths';
import { newId } from '../repos/store';
import { ALERTS_OFF, ALERTS_ON, buildCircle, buildMember, newCircleCode } from './circles';
import { takeDaily } from './quota';

const HISTORY_DAYS = 30;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const EVENING = '20:00';
/** Doses due this recently are left open for the reminder engine instead of being made history. */
const HISTORY_CUTOFF_MINUTES = 90;
/** How long after a dose was due the demo elder marks it taken. */
const TAKEN_AFTER_MINUTES = 5;
/** The demo's first dose is due this soon, so a visitor sees a reminder arrive. */
const FIRST_DOSE_IN_MINUTES = 4;

interface DemoPeople {
  elder: Member;
  daughter: Member;
  grandson: Member;
}

// Demo members have no email on purpose: the engine must never mail a made-up address.
async function buildPeople(deps: Deps, passcode: string): Promise<DemoPeople> {
  const person = (name: string, role: Member['role'], alerts: Member['alerts']) =>
    buildMember(deps, { name, email: null, role, passcode, mustChangePasscode: false, alerts });
  const [elder, daughter, grandson] = await Promise.all([
    person('Mr Rao', 'elder', ALERTS_ON),
    person('Priya', 'caregiver', ALERTS_ON),
    person('Arjun', 'family', ALERTS_OFF),
  ]);
  return { elder, daughter, grandson };
}

function buildMedicines(circle: Circle, soon: string, now: number, by: string): Medication[] {
  const medicine = (name: string, strength: string, times: string[], instructions: string): Medication => ({
    id: newId(),
    name,
    strength,
    form: 'Tablet',
    instructions,
    times: [...new Set(times)],
    daysOfWeek: EVERY_DAY,
    startDate: addDays(localDate(now, circle.timeZone), -HISTORY_DAYS),
    endDate: null,
    active: true,
    materialisedUntil: null,
    createdBy: by,
    updatedBy: by,
    updatedAt: now,
  });
  return [
    medicine('Metformin', '1000 mg', [soon, EVENING], 'After food'),
    medicine('Amlodipine', '5 mg', [soon], ''),
    medicine('Aspirin', '75 mg', [soon], 'After food'),
    medicine('Atorvastatin', '10 mg', [EVENING], 'At bedtime'),
  ];
}

interface Slip {
  medicine: string;
  /** Only this dose time slips; every time when absent. */
  time?: string;
  on: (daysAgo: number) => boolean;
  status: DoseStatus;
}

// A believable month: evenings slip more than mornings, and the statin slips most. First match wins.
const SLIPS: Slip[] = [
  { medicine: 'Atorvastatin', on: (daysAgo) => daysAgo % 4 === 0, status: 'missed' },
  { medicine: 'Metformin', time: EVENING, on: (daysAgo) => daysAgo % 9 === 0, status: 'missed' },
  { medicine: 'Metformin', time: EVENING, on: (daysAgo) => daysAgo === 5, status: 'skipped' },
  { medicine: 'Amlodipine', on: (daysAgo) => daysAgo === 13, status: 'missed' },
];

function pastStatus(med: Medication, time: string, daysAgo: number): DoseStatus {
  if (daysAgo === 0) return 'taken';
  const slip = SLIPS.find(
    (rule) => rule.medicine === med.name && (rule.time === undefined || rule.time === time) && rule.on(daysAgo),
  );
  return slip?.status ?? 'taken';
}

interface HistoryContext {
  circle: Circle;
  elderId: string;
  now: number;
}

function pastDose(
  { circle, elderId, now }: HistoryContext,
  med: Medication,
  slot: { date: string; time: string; daysAgo: number },
): DoseEvent[] {
  const { date, time, daysAgo } = slot;
  const dueAt = zonedToInstant(date, time, circle.timeZone);
  if (dueAt > now - HISTORY_CUTOFF_MINUTES * MINUTE_MS) return [];
  const status = pastStatus(med, time, daysAgo);
  const taken = status === 'taken';
  return [
    {
      ...buildDoseEvent(circle.id, med, { date, time, dueAt }, circle.settings),
      status,
      nextActionAt: null,
      actedBy: taken ? elderId : null,
      actedAt: taken ? dueAt + TAKEN_AFTER_MINUTES * MINUTE_MS : null,
    },
  ];
}

function buildHistory(context: HistoryContext, medicines: Medication[]): DoseEvent[] {
  const today = localDate(context.now, context.circle.timeZone);
  const days = Array.from({ length: HISTORY_DAYS + 1 }, (_, daysAgo) => daysAgo);
  return days.flatMap((daysAgo) => {
    const date = addDays(today, -daysAgo);
    return medicines.flatMap((med) => med.times.flatMap((time) => pastDose(context, med, { date, time, daysAgo })));
  });
}

interface DemoVisit extends Pick<Appointment, 'doctor' | 'speciality' | 'place' | 'notes'> {
  daysFromNow: number;
  time: string;
}

function buildAppointments(circle: Circle, now: number): Appointment[] {
  const visit = ({ daysFromNow, time, ...details }: DemoVisit): Appointment => ({
    id: newId(),
    ...details,
    at: zonedToInstant(addDays(localDate(now, circle.timeZone), daysFromNow), time, circle.timeZone),
    // The demo sends no appointment emails: its members have no addresses.
    nextReminderAt: null,
    remindersSent: { h24: true, h2: true },
    brief: null,
  });
  const cardiology = {
    time: '10:30',
    doctor: 'Dr Meera Iyer',
    speciality: 'Cardiology',
    place: 'Sunrise Clinic, Room 4',
  };
  return [
    visit({ ...cardiology, daysFromNow: -28, notes: '' }),
    visit({ ...cardiology, daysFromNow: 3, notes: 'Ankles swell a little in the evenings.' }),
    visit({
      daysFromNow: 12,
      time: '16:00',
      doctor: 'Dr Sanjay Kulkarni',
      speciality: 'Diabetes care',
      place: 'City Health Centre',
      notes: '',
    }),
  ];
}

function buildActivity(circle: Circle, people: DemoPeople, medicines: Medication[], now: number): Activity[] {
  const yesterday = addDays(localDate(now, circle.timeZone), -1);
  const entry = (actor: Member, item: Omit<Activity, 'id' | 'actorId' | 'actorName'>): Activity => ({
    id: newId(),
    actorId: actor.id,
    actorName: actor.name,
    ...item,
  });
  const metformin = first(medicines);
  const arjunAddedAt = now - 6 * DAY_MS;
  const aboutArjun = { targetType: 'member', targetId: people.grandson.id } as const;
  return [
    entry(people.daughter, {
      at: now - HISTORY_DAYS * DAY_MS,
      targetType: 'circle',
      targetId: circle.id,
      action: 'circle.create',
      summary: 'Priya created the circle',
    }),
    entry(people.elder, {
      ...aboutArjun,
      at: arjunAddedAt,
      action: 'member.add',
      summary: 'Mr Rao added Arjun as family',
    }),
    entry(people.elder, {
      ...aboutArjun,
      at: arjunAddedAt + MINUTE_MS,
      action: 'member.update',
      summary: 'Mr Rao turned off missed-dose alerts for Arjun',
    }),
    entry(people.daughter, {
      at: zonedToInstant(yesterday, '18:10', circle.timeZone),
      targetType: 'medication',
      targetId: metformin.id,
      action: 'medication.update',
      summary: 'Priya changed Metformin from 500 mg to 1000 mg',
    }),
  ];
}

/**
 * A sample circle with a month of history and a dose due in a few minutes, so every screen
 * has something real to show. Everyone in it shares one passcode, shown in the demo banner.
 */
export async function seedDemoCircle(deps: Deps, timeZone: string): Promise<{ circle: Circle; member: Member }> {
  const now = deps.clock.now();
  // Each demo writes about 150 documents; this cap holds across instances, unlike the per-address limit.
  if (!(await takeDaily(deps, paths.globalQuota('demo'), DEMO_GLOBAL_CAP))) {
    throw new AppError(
      'RATE_LIMITED',
      'The demo has been used a lot today. Please create your own circle, or try again tomorrow.',
    );
  }
  const passcode = randomPasscode();
  const people = await buildPeople(deps, passcode);
  const circle = buildCircle({
    elderName: 'Mr Rao',
    timeZone,
    code: await newCircleCode(deps),
    now,
    remindersTo: null,
    demoPasscode: passcode,
  });
  const medicines = buildMedicines(
    circle,
    localTime(now + FIRST_DOSE_IN_MINUTES * MINUTE_MS, timeZone),
    now,
    people.daughter.id,
  );
  const { store } = deps;
  await store.set(paths.circle(circle.id), circle);
  await Promise.all([
    ...Object.values(people).map((member) => store.set(paths.member(circle.id, member.id), member)),
    ...medicines.map((med) => store.set(paths.medication(circle.id, med.id), med)),
    ...buildHistory({ circle, elderId: people.elder.id, now }, medicines).map((dose) =>
      store.set(paths.dose(circle.id, dose.id), dose),
    ),
    ...buildAppointments(circle, now).map((visit) => store.set(paths.appointment(circle.id, visit.id), visit)),
    ...buildActivity(circle, people, medicines, now).map((item) =>
      store.set(paths.activityItem(circle.id, item.id), item),
    ),
  ]);
  await Promise.all(medicines.map((med) => materialiseMedication(deps, circle, med, now)));
  return { circle, member: people.elder };
}
