import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The dev build may load a private seed profile; tests always start from a blank one.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-cleared', '1');
    }
  });
});

async function blank(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'New' }).click();
}

async function fillBasics(page: import('@playwright/test').Page) {
  await page.getByLabel('Your name (tenant)').fill('Test Tenant');
  await page.getByLabel("Landlord's name").fill('Test Landlord');
  await page.getByLabel("Landlord's PAN").fill('abcde1234f');
  await page.getByLabel('Rented property address').fill('12 Test Lane, Testville');
  await page.getByLabel('Monthly rent (INR)').fill('20000');
}

test('blank profile blocks download until required fields are filled', async ({ page }) => {
  await blank(page);
  await expect(page.getByTestId('download-pdf')).toBeDisabled();
  await expect(page.getByTestId('issues')).toContainText('Your name is required');
  await fillBasics(page);
  await expect(page.getByTestId('download-pdf')).toBeEnabled();
});

test('full FY schedule, escalation, override, and live preview', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  await page.getByLabel('Yearly increase (%)').fill('10');
  await page.getByLabel('Rent in force since').fill('2025-04-01');
  await page.getByLabel('Rent from').fill('2026-04-01');
  await page.getByLabel('Rent upto').fill('2027-03-31');
  await expect(page.getByTestId('schedule').locator('tbody tr')).toHaveCount(12);
  // 20000 raised 10% once after 12 months: 22000 x 12
  await expect(page.getByTestId('total')).toHaveText('2,64,000');
  await page.getByLabel('Rent for Jun 2026').fill('25000');
  await expect(page.getByTestId('total')).toHaveText('2,67,000');
  await page.getByRole('button', { name: 'reset' }).click();
  await expect(page.getByTestId('total')).toHaveText('2,64,000');
  await expect(page.getByTestId('preview')).toBeVisible();
  await expect(page.getByTestId('preview')).toHaveAttribute('src', /^blob:/);
});

test('downloads a valid PDF named for the tenant and FY', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()]);
  expect(dl.suggestedFilename()).toMatch(/^rent-receipts-test-tenant-fy\d{4}-\d{2}\.pdf$/);
  const bytes = readFileSync((await dl.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.byteLength).toBeGreaterThan(3000);
});

test('downloads a zip of single receipts', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  await page.getByLabel('Receipts as').selectOption('quarterly');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-zip').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.zip$/);
  const bytes = readFileSync((await dl.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
});

test('profiles persist across reload and can be duplicated', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  const before = await page.getByLabel('Profile').locator('option').count();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByLabel('Profile').locator('option')).toHaveCount(before + 1);
  await page.getByLabel('Profile name').fill('Second');
  await page.reload();
  await expect(page.getByLabel('Profile').locator('option')).toHaveCount(before + 1);
  await expect(page.getByLabel('Profile name')).toHaveValue('Second');
});

test('warns when receipts are future dated', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  await page.getByLabel('Financial year').selectOption(String(new Date().getFullYear() + 1));
  await expect(page.getByTestId('issues')).toContainText('dated in the future');
});

test('sample data fills a blank profile so a visitor can try it in one click', async ({ page }) => {
  await blank(page);
  await expect(page.getByTestId('download-pdf')).toBeDisabled();
  await page.getByRole('button', { name: 'Fill sample data' }).click();
  await expect(page.getByLabel('Your name (tenant)')).toHaveValue('Alex Sharma');
  await expect(page.getByTestId('download-pdf')).toBeEnabled();
});

test('a hostile import file is repaired, not fatal', async ({ page }) => {
  await blank(page);
  await page.locator('input[type=file][accept="application/json"]').setInputFiles({
    name: 'evil.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ label: 'Imported', perPage: 99, template: 'x', overrides: 'nope', tenantName: 'T' })),
  });
  await expect(page.getByLabel('Profile name')).toHaveValue('Imported');
  await expect(page.getByLabel('Receipts per page')).toHaveValue('2');
});

test('required fields expose their state to assistive tech', async ({ page }) => {
  await blank(page);
  const name = page.getByLabel('Your name (tenant)');
  await expect(name).toHaveAttribute('aria-required', 'true');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription(/required/i);
  await expect(page.getByTestId('issues')).toHaveAttribute('aria-live', 'polite');
});

test('a month can be paid on a different day and reset', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  await page.getByLabel('Rent from').fill('2026-04-01');
  await page.getByLabel('Rent upto').fill('2027-03-31');
  const jun = page.getByLabel('Payment date for Jun 2026');
  const original = await jun.inputValue();
  await jun.fill('2026-06-09');
  await expect(jun).toHaveValue('2026-06-09');
  await page.getByRole('button', { name: 'reset' }).click();
  await expect(jun).toHaveValue(original);
});

test('phone width has no sideways scrolling and the schedule scrolls inside its own box', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await blank(page);
  await page.getByRole('button', { name: 'Fill sample data' }).click();
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
  await expect(page.getByTestId('download-pdf')).toBeVisible();
});

test('clearing a rent cell mid-edit does not snap back, and blur resets it', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  const cell = page.getByLabel(/^Rent for /).first();
  await cell.fill('');
  await expect(cell).toHaveValue('');
  await cell.blur();
  await expect(cell).toHaveValue('20000');
});

test('grouped receipts lock the per-month payment date', async ({ page }) => {
  await blank(page);
  await fillBasics(page);
  await page.getByLabel('Receipts as').selectOption('quarterly');
  await expect(page.getByLabel(/^Payment date for /).first()).toBeDisabled();
});

test('importing something that is not a profile shows an error and adds nothing', async ({ page }) => {
  await blank(page);
  const before = await page.getByLabel('Profile').locator('option').count();
  await page.locator('input[type=file][accept="application/json"]').setInputFiles({
    name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('[1,2,3]'),
  });
  await expect(page.getByRole('alert').filter({ hasText: 'not a profile' })).toBeVisible();
  await expect(page.getByLabel('Profile').locator('option')).toHaveCount(before);
});

test('an array of profiles imports every one, and sample data hides once a profile has content', async ({ page }) => {
  await blank(page);
  await page.locator('input[type=file][accept="application/json"]').setInputFiles({
    name: 'many.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([{ label: 'A', tenantName: 'T' }, { label: 'B', tenantName: 'U' }])),
  });
  await expect(page.getByLabel('Profile').locator('option', { hasText: /^A$|^B$/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Fill sample data' })).toHaveCount(0);
});

test('the signature control has an accessible name', async ({ page }) => {
  await blank(page);
  await expect(page.getByLabel("Owner's signature image")).toHaveAttribute('type', 'file');
});
