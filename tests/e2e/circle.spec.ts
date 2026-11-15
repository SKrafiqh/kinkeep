import { expect, test } from '@playwright/test';
import { fillPasscode, testPasscode } from './helpers';

const ELDER = 'Grandma Lakshmi';
const MEDICINE = 'Paracetamol';
/** Circle codes are six capitals and digits; on the ready screen the code sits alone in its element. */
const CIRCLE_CODE = /^[A-Z2-9]{6}$/;

test('an elder creates a circle, adds a medicine, signs out and joins again', async ({ page }) => {
  const passcode = testPasscode();
  let code = '';

  await test.step('create the circle as the elder', async () => {
    await page.goto('/create');
    await page.getByRole('radio', { name: 'I am the person receiving care' }).check();
    await page.getByLabel('Your name', { exact: true }).fill(ELDER);
    await page.getByLabel('Your email', { exact: true }).fill('lakshmi@example.com');
    await fillPasscode(page, passcode);
    await page.getByRole('button', { name: 'Create the circle' }).click();
    await expect(page.getByRole('heading', { name: 'Your circle is ready' })).toBeVisible();
    code = (await page.getByRole('main').getByText(CIRCLE_CODE).textContent()) ?? '';
    expect(code).toMatch(CIRCLE_CODE);
  });

  await test.step('continue to an empty Today', async () => {
    await page.getByRole('link', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { name: 'No medicines are due today' })).toBeVisible();
  });

  await test.step('add a medicine', async () => {
    await page.getByRole('link', { name: 'Add a medicine' }).click();
    await expect(page).toHaveURL(/\/medications\/new$/);
    await page.getByLabel('Medicine name').fill(MEDICINE);
    await page.getByLabel('Strength', { exact: true }).fill('500 mg');
    await page.getByRole('button', { name: 'Add this time' }).click();
    await expect(page.getByRole('button', { name: /^Remove/ })).toHaveCount(1);
    await page.getByRole('button', { name: 'Save medicine' }).click();
    await expect(page).toHaveURL(/\/medications$/);
    await expect(page.getByRole('heading', { name: new RegExp(MEDICINE) })).toBeVisible();
  });

  await test.step('sign out', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');
  });

  await test.step('join again with the code and passcode', async () => {
    await page.goto('/join');
    await page.getByLabel('Circle code').fill(code);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: ELDER, exact: true }).click();
    await fillPasscode(page, passcode);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(ELDER);
  });
});
