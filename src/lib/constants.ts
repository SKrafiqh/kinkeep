/** Working name; rename the product here. */
export const APP_NAME = 'KinKeep';

/** Minutes before a dose for the reminder, and after it for the nudge and the escalation. */
export const REMINDER_DEFAULTS = { leadMin: 15, nudgeMin: 30, escalateMin: 60 } as const;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const SESSION_HOURS = 12;
export const SESSION_WARNING_MINUTES = 5;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const PASSCODE_LENGTH = 6;

export const MATERIALISE_HOURS = 36;
/** A medicine is topped up once its materialised horizon is closer than this. */
export const MATERIALISE_REFILL_HOURS = 12;
export const ACTION_TOKEN_HOURS = 24;
export const SEND_RETRY_MINUTES = 5;
export const MAX_SEND_ATTEMPTS = 3;
export const TICK_BUDGET_MS = 40_000;
export const TICK_PAGE_SIZE = 200;

export const AI_DAILY_CAP = 20;
export const AI_TIMEOUT_MS = 20_000;
export const BRIEF_DEFAULT_DAYS = 30;
export const BRIEF_MAX_DAYS = 90;

/** Local time on Sunday when the weekly summary goes out. */
export const WEEKLY_SUMMARY_TIME = '18:00';

export const AI_DISCLAIMER =
  'Prepared by AI from your records. Not medical advice. Check with your doctor or pharmacist.';
export const BRIEF_DISCLAIMER =
  'Prepared from your records. Not medical advice. Check with your doctor or pharmacist.';

export const ROLE_LABELS = { elder: 'Elder', caregiver: 'Caregiver', family: 'Family' } as const;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MEDICINE_FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Inhaler', 'Drops', 'Other'] as const;
