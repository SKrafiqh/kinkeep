import {
  adherenceByMedicine,
  adherenceOf,
  dayStrip,
  inWindow,
  type AdherenceStat,
  type DayMark,
  type MedicineAdherence,
} from '@/domain/adherence';
import type { Activity, Appointment, Circle } from '@/domain/types';
import { DAY_MS, WEEK_MS } from '@/lib/constants';
import type { Deps } from '../deps';
import { listActivity, listAppointments, listDoses } from '../repos/queries';

const FEED_LENGTH = 20;
const MONTH_DAYS = 30;

export interface Dashboard {
  week: AdherenceStat;
  month: AdherenceStat;
  byMedicine: MedicineAdherence[];
  strip: DayMark[];
  nextAppointment: Appointment | null;
  activity: Activity[];
}

/** Everything the circle page shows, from one dose query, one appointment query and one activity query. */
export async function circleDashboard(deps: Deps, circle: Circle): Promise<Dashboard> {
  const now = deps.clock.now();
  const [doses, appointments, activity] = await Promise.all([
    listDoses(deps.store, circle.id, now - MONTH_DAYS * DAY_MS, now),
    listAppointments(deps.store, circle.id),
    listActivity(deps.store, circle.id, FEED_LENGTH),
  ]);
  return {
    week: adherenceOf(inWindow(doses, now - WEEK_MS, now)),
    month: adherenceOf(doses),
    byMedicine: adherenceByMedicine(doses),
    strip: dayStrip(doses, now, circle.timeZone),
    nextAppointment: appointments.find((appointment) => appointment.at > now) ?? null,
    activity,
  };
}
