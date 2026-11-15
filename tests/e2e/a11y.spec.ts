import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, startDemo } from './helpers';

// Entry animations start at opacity 0; reduced motion skips them, so axe measures the settled colours.
test.use({ reducedMotion: 'reduce' });

const PUBLIC_PAGES = ['/', '/join', '/create'];
const SIGNED_IN_PAGES = [
  '/today',
  '/circle',
  '/medications',
  '/medications/new',
  '/appointments',
  '/appointments/new',
  '/members',
];

/** Loads the page fresh, then checks axe, the single h1, and that Tab reaches the skip link first. */
async function auditPage(page: Page, path: string): Promise<void> {
  await test.step(path, async () => {
    await page.goto(path);
    await expectNoAxeViolations(page);
    await expect.soft(page.getByRole('heading', { level: 1 }), `one h1 on ${path}`).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect
      .soft(page.getByRole('link', { name: 'Skip to main content' }), `skip link first on ${path}`)
      .toBeFocused();
  });
}

/** Opens the first item in a list the way a person would, and returns the detail page's path. */
async function pathAfterOpening(page: Page, listPath: string, linkName: RegExp): Promise<string> {
  await page.goto(listPath);
  await page.getByRole('main').getByRole('link', { name: linkName }).first().click();
  await page.waitForURL(new RegExp(`${listPath}/[\\w-]+$`));
  return new URL(page.url()).pathname;
}

test('public pages pass axe, have one h1 and put the skip link first', async ({ page }) => {
  for (const path of PUBLIC_PAGES) await auditPage(page, path);
});

test('signed-in pages pass axe, have one h1 and put the skip link first', async ({ page }) => {
  test.slow();
  await startDemo(page);
  for (const path of SIGNED_IN_PAGES) await auditPage(page, path);
  await auditPage(page, await pathAfterOpening(page, '/appointments', /^Open/));
  await auditPage(page, await pathAfterOpening(page, '/medications', /^Edit/));
});
