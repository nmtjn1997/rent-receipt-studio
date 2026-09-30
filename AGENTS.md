# Rent Receipt Studio: agent guide

Browser-only generator for Section 10(13A) HRA rent receipts. No backend, no network calls, no analytics.
The landlord PAN and addresses never leave the browser, so never add code that uploads them.

## The loop (run it after every change, fix until green)

```bash
npm run verify     # typecheck, unit tests, production build, Playwright e2e
```

Faster inner loops: `npm test` (vitest, ~5s) and `npm run e2e` (needs Google Chrome installed).
To look at the layout: `npm run samples`, then `pdftoppm -r 70 -png out/sample-classic.pdf out/p` and read the PNGs.
Poppler substitutes fonts, so bold can look faint there. `tests/pdf.test.ts` proves bold via pdfjs.

## Map

| Path | Job |
|---|---|
| `src/lib/schedule.ts` | FY months, escalation, proration, grouping into receipts |
| `src/lib/words.ts` | Indian number to words (`amountToWords`), digit grouping (`inr`) |
| `src/lib/pdf.ts` | pdf-lib renderer, three templates, rich-text wrapping |
| `src/lib/validate.ts` | PAN format, missing fields, future-dated receipts, TDS and stamp notes |
| `src/lib/storage.ts` | localStorage profiles, optional `src/seed.local.json` |
| `src/App.tsx` | The whole UI; preview is the real PDF in an iframe |
| `tests/` | vitest; `pdf.test.ts` extracts text from generated PDFs |
| `e2e/` | Playwright against `npm run dev` on 127.0.0.1:5177 |

## Rules

- Every behaviour change ships with a test in the same change. Prefer asserting on extracted PDF text over snapshots.
- Standard PDF fonts only cover Latin-1. New text passes through `clean()` in `pdf.ts` so unsupported characters cannot throw.
- Rent for a month is `overrides[key] ?? escalatedRent(...)`. Do not add a second source of truth.
- `src/seed.local.json` is gitignored and holds real profiles. Never commit it, never paste its contents into docs or tests.
- Tests use fake names (Test Tenant, Test Landlord, ABCDE1234F). Keep it that way.
- Receipts must state rent that was actually paid. Keep the future-date warning; do not remove or silence it.
- Match the surrounding style. No new dependency without a reason written in the change.

## Adding a template

1. Add the id to `TemplateId` in `src/lib/types.ts`.
2. Branch on `cfg.template` in `drawOne` (`src/lib/pdf.ts`).
3. Add the `<option>` in `App.tsx`.
4. The "renders every template and font" test in `tests/pdf.test.ts` picks it up once you add it to its list.
