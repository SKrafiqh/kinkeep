/** Shapes stored in Firestore. Instants are epoch milliseconds (UTC); dates are YYYY-MM-DD. */

export type Role = 'elder' | 'caregiver' | 'family';
export type DoseStatus = 'scheduled' | 'reminded' | 'nudged' | 'missed' | 'taken' | 'skipped';
export type DoseAction = 'taken' | 'skipped';

export interface ReminderSettings {
  leadMin: number;
  nudgeMin: number;
  escalateMin: number;
}

export interface Circle {
  id: string;
  elderName: string;
  timeZone: string;
  code: string;
  createdAt: number;
  settings: ReminderSettings;
  /** Member who receives the elder's own reminders; null means the elder. */
  remindersTo: string | null;
  nextSummaryAt: number | null;
  /** Demo circles only: the shared passcode shown in the demo banner. */
  demoPasscode: string | null;
}

export interface AlertSettings {
  missedDose: boolean;
  appointments: boolean;
  weeklySummary: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  passcodeHash: string;
  passcodeSalt: string;
  mustChangePasscode: boolean;
  alerts: AlertSettings;
  failedAttempts: number;
  lockedUntil: number | null;
  removedAt: number | null;
}

export interface Medication {
  id: string;
  name: string;
  strength: string;
  form: string;
  instructions: string;
  times: string[];
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
  active: boolean;
  /** Dose events exist up to this instant; null while paused or finished. */
  materialisedUntil: number | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: number;
}

export interface DoseEvent {
  id: string;
  medId: string;
  medName: string;
  strength: string;
  dueAt: number;
  slotKey: string;
  status: DoseStatus;
  nextActionAt: number | null;
  actedBy: string | null;
  actedAt: number | null;
  late: boolean;
  attempts: number;
  lastError: string | null;
}

export interface BriefContent {
  summary: string;
  patterns: string[];
  changes: string[];
  questions: string[];
}

export interface VisitBrief {
  content: BriefContent;
  generatedAt: number;
  source: 'ai' | 'fallback';
  editedBy: string | null;
}

export interface Appointment {
  id: string;
  doctor: string;
  speciality: string;
  place: string;
  at: number;
  notes: string;
  nextReminderAt: number | null;
  remindersSent: { h24: boolean; h2: boolean };
  brief: VisitBrief | null;
}

export interface Activity {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'circle' | 'member' | 'medication' | 'appointment' | 'dose';
  targetId: string;
  summary: string;
  at: number;
}
