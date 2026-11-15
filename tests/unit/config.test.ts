import { describe, expect, it } from 'vitest';
import { parseConfig } from '@/server/config';

const SECRET = 's'.repeat(32);
const PRODUCTION = {
  NODE_ENV: 'production',
  APP_URL: 'https://kinkeep.example',
  SESSION_SECRET: SECRET,
  PASSCODE_PEPPER: SECRET,
  ACTION_TOKEN_SECRET: SECRET,
  CRON_SECRET: 'c'.repeat(16),
};

describe('parseConfig', () => {
  it('uses safe development defaults', () => {
    const config = parseConfig({});
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      DATA_STORE: 'memory',
      EMAIL_PROVIDER: 'console',
      AI_MODEL: 'gemma-4-31b-it',
      AI_BASE_URL: 'https://api.prod.adaptionlabs.ai',
      isProduction: false,
    });
    expect(config.SESSION_SECRET).toContain('dev-only');
    expect(config.SESSION_SECRET).not.toBe(config.PASSCODE_PEPPER);
  });

  it('uses Firestore in production and marks it as production', () => {
    const config = parseConfig(PRODUCTION);
    expect(config).toMatchObject({ DATA_STORE: 'firestore', isProduction: true, SESSION_SECRET: SECRET });
  });

  it('requires the three secrets in production and names them without their values', () => {
    expect(() =>
      parseConfig({ NODE_ENV: 'production', APP_URL: 'https://kinkeep.example', CRON_SECRET: 'c'.repeat(16) }),
    ).toThrow('Missing configuration: SESSION_SECRET, PASSCODE_PEPPER, ACTION_TOKEN_SECRET');
  });

  it('requires APP_URL in production, since email links and the Secure cookie depend on it', () => {
    expect(() => parseConfig({ ...PRODUCTION, APP_URL: undefined })).toThrow('Missing configuration: APP_URL');
  });

  it('requires a cron credential in production, either kind', () => {
    const withoutCron = { ...PRODUCTION, CRON_SECRET: undefined };
    expect(() => parseConfig(withoutCron)).toThrow('CRON_SECRET or CRON_SERVICE_ACCOUNT');
    expect(
      parseConfig({ ...withoutCron, CRON_SERVICE_ACCOUNT: 'scheduler@test.iam.gserviceaccount.com' }).isProduction,
    ).toBe(true);
    expect(parseConfig(PRODUCTION).isProduction).toBe(true);
  });

  it('requires a user and password for gmail', () => {
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail' })).toThrow('GMAIL_USER, GMAIL_APP_PASSWORD');
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'me@gmail.com' })).toThrow('GMAIL_APP_PASSWORD');
    expect(
      parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'me@gmail.com', GMAIL_APP_PASSWORD: 'pw' }).EMAIL_PROVIDER,
    ).toBe('gmail');
  });

  it('treats empty strings as unset', () => {
    expect(() => parseConfig({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: '', GMAIL_APP_PASSWORD: '' })).toThrow(
      'GMAIL_USER',
    );
    const config = parseConfig({ APP_URL: '', AI_MODEL: '', SESSION_SECRET: '', DATA_STORE: '' });
    expect(config).toMatchObject({
      APP_URL: 'http://localhost:3000',
      AI_MODEL: 'gemma-4-31b-it',
      DATA_STORE: 'memory',
    });
    expect(config.SESSION_SECRET).toContain('dev-only');
  });

  it('strips trailing slashes from APP_URL', () => {
    expect(parseConfig({ APP_URL: 'https://kinkeep.example.com/' }).APP_URL).toBe('https://kinkeep.example.com');
    expect(parseConfig({ APP_URL: 'https://kinkeep.example.com///' }).APP_URL).toBe('https://kinkeep.example.com');
  });

  it('rejects invalid values and short secrets', () => {
    expect(() => parseConfig({ APP_URL: 'not a url' })).toThrow('Invalid configuration');
    expect(() => parseConfig({ NODE_ENV: 'staging' })).toThrow('NODE_ENV');
    expect(() => parseConfig({ SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET');
    expect(() => parseConfig({ CRON_SECRET: 'short' })).toThrow('CRON_SECRET');
  });

  it('never puts a secret value in an error', () => {
    expect(() => parseConfig({ SESSION_SECRET: 'tooshort-but-secret' })).toThrow(/^(?!.*tooshort-but-secret)/s);
  });

  it('returns a frozen object', () => {
    const config = parseConfig({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as { APP_URL: string }).APP_URL = 'https://evil.example';
    }).toThrow(TypeError);
  });
});
