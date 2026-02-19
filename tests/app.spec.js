import { test, expect } from '@playwright/test';

test('login page loads with auth form', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#authContainer')).toBeVisible();
  await expect(page.locator('#loginBtn')).toBeVisible();
});

test('ETA date input is visible in the input section', async ({ page }) => {
  await page.goto('/');
  const etaInput = page.locator('#etaInput');
  await expect(etaInput).toBeAttached();
  await expect(etaInput).toHaveAttribute('type', 'date');
});

test('page title is MeBoard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('MeBoard');
});
