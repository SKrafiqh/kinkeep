import { z } from 'zod';

const secret = z.string().min(32, 'must be at least 32 characters');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  DATA_STORE: z.enum(['memory', 'firestore']).optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-flash-latest'),
  EMAIL_PROVIDER: z.enum(['console', 'gmail']).default('console'),
  GMAIL_USER: z.email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  SESSION_SECRET: secret.optional(),
  PASSCODE_PEPPER: secret.optional(),
  ACTION_TOKEN_SECRET: secret.optional(),
  CRON_SERVICE_ACCOUNT: z.email().optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

type Env = z.infer<typeof envSchema>;
const SECRET_NAMES = ['SESSION_SECRET', 'PASSCODE_PEPPER', 'ACTION_TOKEN_SECRET'] as const;

export interface Config extends Omit<Env, 'DATA_STORE' | (typeof SECRET_NAMES)[number]> {
  DATA_STORE: 'memory' | 'firestore';
  SESSION_SECRET: string;
  PASSCODE_PEPPER: string;
  ACTION_TOKEN_SECRET: string;
  isProduction: boolean;
}

function problems(env: Env): string[] {
  const missing: string[] = [];
  if (env.NODE_ENV === 'production') {
    missing.push(...SECRET_NAMES.filter((name) => !env[name]));
    if (!env.CRON_SECRET && !env.CRON_SERVICE_ACCOUNT) missing.push('CRON_SECRET or CRON_SERVICE_ACCOUNT');
  }
  if (env.EMAIL_PROVIDER === 'gmail') {
    if (!env.GMAIL_USER) missing.push('GMAIL_USER');
    if (!env.GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
  }
  return missing;
}

/** Parses the environment once. Throws, naming only variable names, when it is unusable. */
export function parseConfig(source: Record<string, string | undefined>): Config {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== ''));
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration: ${names.join('; ')}`);
  }
  const env = parsed.data;
  const missing = problems(env);
  if (missing.length > 0) throw new Error(`Missing configuration: ${missing.join(', ')}`);
  // Outside production a fixed placeholder keeps local runs and tests working without setup.
  const devSecret = (name: string): string => `dev-only-${name}-never-used-in-production`;
  return Object.freeze({
    ...env,
    APP_URL: env.APP_URL.replace(/\/+$/, ''),
    DATA_STORE: env.DATA_STORE ?? (env.NODE_ENV === 'production' ? 'firestore' : 'memory'),
    SESSION_SECRET: env.SESSION_SECRET ?? devSecret('session-secret'),
    PASSCODE_PEPPER: env.PASSCODE_PEPPER ?? devSecret('passcode-pepper'),
    ACTION_TOKEN_SECRET: env.ACTION_TOKEN_SECRET ?? devSecret('action-token-secret'),
    isProduction: env.NODE_ENV === 'production',
  });
}

let cached: Config | undefined;

/** The frozen configuration, parsed on first use so `next build` needs no secrets. */
export function getConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
