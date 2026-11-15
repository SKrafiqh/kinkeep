import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);
// Fresh for every run, so no secret ever lives in the repo.
const secret = (): string => randomBytes(48).toString('base64');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The production build, as Cloud Run serves it. One server holds the in-memory store for the whole run.
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    env: {
      NODE_ENV: 'production',
      APP_URL: BASE_URL,
      DATA_STORE: 'memory',
      EMAIL_PROVIDER: 'console',
      LOG_LEVEL: 'silent',
      // Empty wins over any key in .env files, so the visit brief always uses its offline fallback.
      AI_API_KEY: '',
      SESSION_SECRET: secret(),
      PASSCODE_PEPPER: secret(),
      ACTION_TOKEN_SECRET: secret(),
      CRON_SECRET: secret(),
    },
  },
});
