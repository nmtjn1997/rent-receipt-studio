// Emulates common phones and tablets in Chrome and reports overflow, tiny tap targets and sub-16px fields.
// Needs the dev server running. Screenshots land in ./out.

import { chromium, devices } from '@playwright/test';
const list = [
  ['iPhone SE', devices['iPhone SE']],
  ['iPhone 14 Pro', devices['iPhone 14 Pro']],
  ['iPhone 14 Pro Max', devices['iPhone 14 Pro Max']],
  ['Pixel 7', devices['Pixel 7']],
  ['Galaxy S8', devices['Galaxy S8']],
  ['Galaxy S9+', devices['Galaxy S9+']],
  ['Galaxy Tab S4 (tablet)', devices['Galaxy Tab S4']],
  ['iPad Mini', devices['iPad Mini']],
  ['tiny 320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
];
const b = await chromium.launch({ channel: 'chrome' });
for (const [name, d] of list) {
  const ctx = await b.newContext({ ...d, defaultBrowserType: undefined });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.clear());
  await p.goto((process.env.BASE_URL ?? 'http://127.0.0.1:5177/'));
  await p.getByRole('button', { name: 'New' }).click();
  await p.getByRole('button', { name: 'Fill sample data' }).click();
  await p.waitForTimeout(400);
  const m = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const small = [...document.querySelectorAll('button, input, select, textarea, a.btn-link')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 36) && !e.closest('.schedule') && e.type !== 'checkbox' && e.type !== 'file' && e.type !== 'color'; }).map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20));
    const fs = [...document.querySelectorAll('input:not([type=checkbox]):not([type=file]), select, textarea')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16 && e.getBoundingClientRect().width > 0).length;
    const clipped = [...document.querySelectorAll('.card *, .topbar *, .preview *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !e.closest('.table-wrap'); }).length;
    return { vw, scrollW: document.documentElement.scrollWidth, smallTargets: [...new Set(small)].slice(0, 6), inputsUnder16px: fs, clipped };
  });
  console.log(name.padEnd(24), JSON.stringify(m));
  await p.screenshot({ path: `out/dev-${name.replace(/[^a-z0-9]+/gi, '_')}.png` });
  await ctx.close();
}
await b.close();
