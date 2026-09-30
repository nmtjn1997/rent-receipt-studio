import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = resolve('dist-single/rent-receipt.html');

// Proves the one-file build works with no server and no network, straight from disk.
test.skip(!existsSync(file), 'run `npm run build:single` first');

test('single-file build runs from file:// and produces a PDF', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) external.push(r.url());
  });
  await page.goto(pathToFileURL(file).href);
  await page.getByRole('button', { name: 'Fill sample data' }).click();
  await expect(page.getByTestId('download-pdf')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()]);
  expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
  expect(external).toEqual([]);
});
