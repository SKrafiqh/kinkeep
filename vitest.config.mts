import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    env: { LOG_LEVEL: 'silent' },
    include: ['tests/unit/**/*.test.ts', 'tests/api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/server/**', 'src/lib/**'],
      // Thin adapters over real networks; exercised on the deployed app, not in unit tests.
      exclude: ['src/server/repos/firestoreStore.ts', 'src/server/email/gmailSender.ts', 'src/server/ai/geminiClient.ts', 'src/server/auth/googleOidc.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80 },
    },
  },
});
