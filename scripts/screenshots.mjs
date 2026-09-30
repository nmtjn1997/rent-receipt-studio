// Refreshes docs/img/app.png. Needs the dev server (npm run dev) and Google Chrome.
import { chromium } from '@playwright/test';

const url = process.env.BASE_URL ?? 'http://127.0.0.1:5177';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' });
await page.addInitScript(() => localStorage.clear());
await page.goto(url);
await page.getByRole('button', { name: 'New' }).click();
await page.getByRole('button', { name: 'Fill sample data' }).click();
await page.getByLabel('Financial year').selectOption('2025');
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/img/app.png' });
await browser.close();
console.log('wrote docs/img/app.png');
