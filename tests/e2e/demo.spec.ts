import { expect, test } from '@playwright/test';
import { startDemo } from './helpers';

test('the demo elder marks a dose taken, checks the circle and prepares a visit brief', async ({ page }) => {
  await startDemo(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mr Rao');

  await test.step('mark the first open slot as taken', async () => {
    const takenButton = page.getByRole('button', { name: /^Taken/ });
    const slotTime = await page
      .getByRole('article')
      .filter({ has: takenButton })
      .first()
      .getByRole('heading')
      .innerText();
    // Found by its time, which stays put once the slot's buttons are gone.
    const slot = page.getByRole('article').filter({ has: page.getByRole('heading', { name: slotTime, exact: true }) });
    await slot.getByRole('button', { name: /^Taken/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Marked as taken' })).toBeVisible();
    await expect(slot.getByRole('button', { name: /^Taken/ })).toHaveCount(0);
    await expect(slot).toContainText('Taken');
  });

  await test.step('the circle shows adherence and the change feed', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Circle', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Doses taken' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
  });

  await test.step('prepare a visit brief without AI', async () => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Appointments' }).click();
    await page.getByRole('main').getByRole('link', { name: /^Open/ }).first().click();
    await page.getByRole('button', { name: 'Prepare the visit brief' }).click();
    await expect(page.getByText(/Mr Rao took \d+ of \d+ doses/)).toBeVisible();
    await expect(page.getByText(/Not medical advice/)).toBeVisible();
  });
});
