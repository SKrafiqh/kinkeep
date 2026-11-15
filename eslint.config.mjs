import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    // The domain is pure: no I/O, no framework, no system clock.
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/server/*', '@/app/*', 'next', 'next/*', 'react', 'node:*'] }],
      'no-restricted-properties': ['error', { object: 'Date', property: 'now', message: 'Pass time in as an argument.' }],
    },
  },
  {
    // Client components must never pull server code or secrets into the browser bundle.
    files: ['src/components/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['@/server/*'] }] },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**', 'playwright-report/**', 'test-results/**']),
]);
