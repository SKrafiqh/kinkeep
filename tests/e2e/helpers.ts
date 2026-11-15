import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { randomInt } from 'node:crypto';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PASSCODE_LENGTH = 6;

/** A fresh six-digit test passcode. */
export function testPasscode(): string {
  return String(randomInt(10 ** PASSCODE_LENGTH)).padStart(PASSCODE_LENGTH, '0');
}

/** Starts a new demo circle from the landing page, signed in as the elder, Mr Rao. */
export async function startDemo(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page).toHaveURL(/\/today$/);
}

/** Types a passcode into the page's six digit boxes, one digit per box. */
export async function fillPasscode(page: Page, passcode: string): Promise<void> {
  for (const [index, digit] of [...passcode].entries()) {
    await page.getByLabel(new RegExp(`digit ${index + 1} of ${PASSCODE_LENGTH}$`)).fill(digit);
  }
}

/** Runs axe for WCAG 2.2 AA. Soft, so one run reports every page; each violation reads as one line. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const report = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'no impact'}, ${violation.nodes.length} element(s)): ` +
      `${String(violation.nodes[0]?.target[0] ?? 'no target')}. ${violation.help}`,
  );
  expect.soft(report, `axe violations on ${new URL(page.url()).pathname}`).toEqual([]);
}
