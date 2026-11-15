/** Request shapes, shared by the forms and the API. Unknown fields are rejected. */

import { z } from 'zod';
import { isValidTimeZone } from '@/domain/time';
import { MEDICINE_FORMS, PASSCODE_LENGTH } from './constants';

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `Enter ${label}.`)
    .max(max, `Keep ${label} under ${max} characters.`);

const unique = (values: Array<string | number>): boolean => new Set(values).size === values.length;

export const passcodeSchema = z.string().regex(new RegExp(`^\\d{${PASSCODE_LENGTH}}$`), `Use exactly ${PASSCODE_LENGTH} digits.`);
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254));
export const circleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, 'A circle code has 6 letters or numbers.');
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const dateSchema = z.iso.date('Choose a date.');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time.');
const nameSchema = text(1, 60, 'a name');
const roleSchema = z.enum(['elder', 'caregiver', 'family']);
const helperRoleSchema = z.enum(['caregiver', 'family']);

export const createCircleSchema = z.strictObject({
  elderName: nameSchema,
  timeZone: z.string().refine(isValidTimeZone, 'Choose a time zone from the list.'),
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
  passcode: passcodeSchema,
});

export const lookupSchema = z.strictObject({ code: circleCodeSchema });
export const signInSchema = z.strictObject({ code: circleCodeSchema, memberId: idSchema, passcode: passcodeSchema });
export const changePasscodeSchema = z.strictObject({ current: passcodeSchema, passcode: passcodeSchema });

const alertsSchema = z.strictObject({
  missedDose: z.boolean(),
  appointments: z.boolean(),
  weeklySummary: z.boolean(),
});

export const addMemberSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema.nullable(),
  role: helperRoleSchema,
});

export const updateMemberSchema = z.strictObject({
  name: nameSchema.optional(),
  email: emailSchema.nullable().optional(),
  role: helperRoleSchema.optional(),
  alerts: alertsSchema.optional(),
  /** True makes this member the one who receives the elder's own reminders. */
  receivesElderReminders: z.boolean().optional(),
});

export const medicationSchema = z
  .strictObject({
    name: text(1, 80, 'the medicine name'),
    strength: text(1, 40, 'the strength'),
    form: z.enum(MEDICINE_FORMS),
    instructions: z.string().trim().max(200, 'Keep the instructions under 200 characters.'),
    times: z.array(timeSchema).min(1, 'Add at least one time.').max(8).refine(unique, 'Each time can be added once.'),
    daysOfWeek: z.array(z.int().min(0).max(6)).min(1, 'Choose at least one day.').max(7).refine(unique),
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
    active: z.boolean(),
  })
  .refine((med) => med.endDate === null || med.endDate >= med.startDate, {
    path: ['endDate'],
    message: 'The end date must be on or after the start date.',
  });

export const appointmentSchema = z.strictObject({
  doctor: text(1, 80, "the doctor's name"),
  speciality: z.string().trim().max(60),
  place: z.string().trim().max(120),
  date: dateSchema,
  time: timeSchema,
  notes: z.string().trim().max(1000, 'Keep the notes under 1000 characters.'),
});

const doseActionField = z.enum(['taken', 'skipped']);
/** `slot: true` marks every dose due at the same time, the way the Today view's one button does. */
export const doseActionSchema = z.strictObject({ action: doseActionField, slot: z.boolean().default(false) });
export const demoSchema = z.strictObject({ timeZone: z.string().refine(isValidTimeZone, 'Choose a time zone from the list.') });
export const actSchema = z.strictObject({ token: z.string().min(20).max(1200), action: doseActionField });
export const dayQuerySchema = z.strictObject({ date: dateSchema.optional() });
export const testReminderSchema = z.strictObject({ email: emailSchema });

const briefLines = z.array(z.string().trim().min(1).max(400)).max(8);
/** Used both to validate what the AI model returns and what a person saves after editing. */
export const briefSchema = z.strictObject({
  summary: z.string().trim().min(1, 'Write a short summary.').max(1500),
  patterns: briefLines,
  changes: briefLines,
  questions: briefLines,
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type MedicationInput = z.infer<typeof medicationSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
