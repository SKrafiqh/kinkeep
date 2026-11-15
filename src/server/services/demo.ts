import { buildDoseEvent } from '@/domain/schedule';
import { addDays, localDate, localTime, zonedToInstant } from '@/domain/time';
import type { Activity, Appointment, Circle, DoseEvent, DoseStatus, Medication, Member } from '@/domain/types';
import { DAY_MS, MINUTE_MS } from '@/lib/constants';
import { randomPasscode } from '../auth/passcode';
import type { Deps } from '../deps';
import { materialiseMedication } from '../reminders/materialise';
import { paths } from '../repos/paths';
import { newId } from '../repos/store';
import { ALERTS_OFF, ALERTS_ON, buildCircle, buildMember, newCircleCode } from './circles';

const HISTORY_DAYS = 30;
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const EVENING = '20:00';

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

// A believable month: evenings slip more than mornings, and the statin slips most.
function pastStatus(med: Medication, time: string, daysAgo: number): DoseStatus {
  if (med.name === 'Atorvastatin' && daysAgo % 4 === 0) return 'missed';
  if (med.name === 'Metformin' && time === EVENING && daysAgo % 9 === 0) return 'missed';
  if (med.name === 'Metformin' && time === EVENING && daysAgo === 5) return 'skipped';
  if (med.name === 'Amlodipine' && daysAgo === 13) return 'missed';
  return 'taken';
}

function buildHistory(circle: Circle, medicines: Medication[], elderId: string, now: number): DoseEvent[] {
  const today = localDate(now, circle.timeZone);
  const history: DoseEvent[] = [];
  for (let daysAgo = 0; daysAgo <= HISTORY_DAYS; daysAgo += 1) {
    const date = addDays(today, -daysAgo);
    for (const med of medicines) {
      for (const time of med.times) {
        const dueAt = zonedToInstant(date, time, circle.timeZone);
        if (dueAt > now - 90 * MINUTE_MS) continue;
        const status = pastStatus(med, time, daysAgo);
        const taken = status === 'taken';
        history.push({
          ...buildDoseEvent(circle.id, med, { date, time, dueAt }, circle.settings),
          status,
          nextActionAt: null,
          actedBy: taken ? elderId : null,
          actedAt: taken ? dueAt + 5 * MINUTE_MS : null,
        });
      }
    }
  }
  return history;
}

function buildAppointments(circle: Circle, now: number): Appointment[] {
  const visit = (daysFromNow: number, time: string, doctor: string, speciality: string, place: string, notes: string): Appointment => ({
    id: newId(),
    doctor,
    speciality,
    place,
    notes,
    at: zonedToInstant(addDays(localDate(now, circle.timeZone), daysFromNow), time, circle.timeZone),
    // The demo sends no appointment emails: its members have no addresses.
    nextReminderAt: null,
    remindersSent: { h24: true, h2: true },
    brief: null,
  });
  return [
    visit(-28, '10:30', 'Dr Meera Iyer', 'Cardiology', 'Sunrise Clinic, Room 4', ''),
    visit(3, '10:30', 'Dr Meera Iyer', 'Cardiology', 'Sunrise Clinic, Room 4', 'Ankles swell a little in the evenings.'),
    visit(12, '16:00', 'Dr Sanjay Kulkarni', 'Diabetes care', 'City Health Centre', ''),
  ];
}

function buildActivity(circle: Circle, people: DemoPeople, medicines: Medication[], now: number): Activity[] {
  const yesterday = addDays(localDate(now, circle.timeZone), -1);
  const entry = (actor: Member, at: number, targetType: Activity['targetType'], targetId: string, action: string, summary: string): Activity => ({
    id: newId(),
    actorId: actor.id,
    actorName: actor.name,
    at,
    targetType,
    targetId,
    action,
    summary,
  });
  const [metformin] = medicines;
  return [
    entry(people.daughter, now - HISTORY_DAYS * DAY_MS, 'circle', circle.id, 'circle.create', 'Priya created the circle'),
    entry(people.elder, now - 6 * DAY_MS, 'member', people.grandson.id, 'member.add', 'Mr Rao added Arjun as family'),
    entry(people.elder, now - 6 * DAY_MS + MINUTE_MS, 'member', people.grandson.id, 'member.update', 'Mr Rao turned off missed-dose alerts for Arjun'),
    entry(people.daughter, zonedToInstant(yesterday, '18:10', circle.timeZone), 'medication', metformin.id, 'medication.update', 'Priya changed Metformin from 500 mg to 1000 mg'),
  ];
}

/**
 * A sample circle with a month of history and a dose due in a few minutes, so every screen
 * has something real to show. Everyone in it shares one passcode, shown in the demo banner.
 */
export async function seedDemoCircle(deps: Deps, timeZone: string): Promise<{ circle: Circle; member: Member }> {
  const now = deps.clock.now();
  const passcode = randomPasscode();
  const people = await buildPeople(deps, passcode);
  const circle = buildCircle({ elderName: 'Mr Rao', timeZone, code: await newCircleCode(deps), now, remindersTo: null, demoPasscode: passcode });
  const medicines = buildMedicines(circle, localTime(now + 4 * MINUTE_MS, timeZone), now, people.daughter.id);
  const { store } = deps;
  await store.set(paths.circle(circle.id), circle);
  await Promise.all([
    ...Object.values(people).map((member) => store.set(paths.member(circle.id, member.id), member)),
    ...medicines.map((med) => store.set(paths.medication(circle.id, med.id), med)),
    ...buildHistory(circle, medicines, people.elder.id, now).map((dose) => store.set(paths.dose(circle.id, dose.id), dose)),
    ...buildAppointments(circle, now).map((visit) => store.set(paths.appointment(circle.id, visit.id), visit)),
    ...buildActivity(circle, people, medicines, now).map((item) => store.set(paths.activityItem(circle.id, item.id), item)),
  ]);
  await Promise.all(medicines.map((med) => materialiseMedication(deps, circle, med, now)));
  return { circle, member: people.elder };
}
