# Rent Receipt Studio: agent guide

Browser-only generator for Section 10(13A) HRA rent receipts. Static site, no backend, no network calls, no analytics.
Hosted on GitHub Pages and as a Docker image. Anyone can fork it, so treat every change as public.

## The loop (run after every change, fix until green)

```bash
npm run verify     # typecheck, unit tests, build + leak check, one-file build, Playwright e2e
```

| Need | Command |
|---|---|
| Fast inner loop | `npm test` (vitest, a few seconds) |
| Browser tests | `npm run e2e` (needs Google Chrome; starts the dev server itself) |
| Same tests against a deployment | `BASE_URL=https://host/path/ npx playwright test e2e/app.spec.ts` |
| Look at the layout | `npm run samples`, then `pdftoppm -r 70 -png out/sample-classic.pdf out/p` and read the PNGs |
| Docker check | `docker build -t rr . && docker run --rm -p 8080:8080 rr`, then `BASE_URL=http://127.0.0.1:8080 npx playwright test e2e/app.spec.ts` |
| Phones and tablets (9 emulated devices) | `npm run dev` in one shell, `npm run devices` in another; screenshots in `out/` |
| CLI and MCP | `npm run cli -- --help`; `tests/cli.test.ts` spawns both and does a real MCP stdio round trip |
| Refresh README screenshot | `npm run dev` in one shell, `npm run screenshots` in another |

Poppler substitutes fonts, so bold can look faint in PNGs. `tests/pdf.test.ts` proves bold through pdfjs instead.

## Map

| Path | Job |
|---|---|
| `src/lib/schedule.ts` | FY months, proration, grouping into receipts |
| `src/lib/words.ts` | Indian number to words (`amountToWords`), digit grouping (`inr`) |
| `src/lib/pdf.ts` | pdf-lib renderer, three templates, rich-text wrapping |
| `src/lib/validate.ts` | Errors and advisory notes (PAN, dates, future receipts, TDS, stamp) |
| `src/lib/defaults.ts` | Default profile and `normalizeConfig`, the one gate for untrusted data |
| `src/lib/storage.ts` | localStorage profiles; dev-only `src/seed.local.json` |
| `src/cli/` | `generate.ts` (shared), `cli.ts`, `mcp.ts`; launched by `bin/*.mjs` through tsx |
| `src/App.tsx` | The whole UI; the preview is the real PDF in an iframe |
| `tests/`, `e2e/` | vitest (incl. PDF text extraction), Playwright |
| `scripts/` | `check-dist.mjs` leak guard, single-file rename, samples, screenshots |
| `docs/` | Architecture with sequence diagrams, hosting, privacy, tax notes, backlog |

## Hard rules

1. **No personal data, ever.** Code, tests, docs, screenshots and commit messages use `Test Tenant`, `Test Landlord`, `ABCDE1234F`, `Alex Sharma`, `Priya Verma`. Real profiles live only in the gitignored `src/seed.local.json`.
2. **Stay client-side.** No fetch, no analytics, no remote fonts or scripts. The nginx CSP sets `connect-src 'none'` and a test suite passes against it; do not loosen it.
3. **All external data goes through `normalizeConfig`.** Imported JSON and old localStorage are untrusted.
4. **Rent for a month is `overrides[key] ?? monthlyRent`.** Do not add a second source of truth.
5. **Standard PDF fonts are Latin-1 only.** New text goes through `clean()` in `pdf.ts` so unsupported characters cannot throw.
6. **Keep the future-date warning.** A receipt records rent actually paid.
7. Every behaviour change ships with a test. Prefer asserting on extracted PDF text over snapshots.
8. Match the surrounding style. A new dependency needs a reason in the commit message.
9. Comments describe the code as it is now, not its history.

## Commits

Small, phased, conventional prefix (`feat`, `fix`, `docs`, `ci`, `build`, `test`, `chore`), body says why.
Do not commit `dist*`, `out`, `test-results` or anything `*.local.json`.

## Improving the project

Pick the top open item in `docs/BACKLOG.md`, do it as its own commit with tests, tick it off, run the loop. Repeat.
Slash commands in `.claude/commands/`: `/fix-loop`, `/review`, `/next-improvement`, `/add-template`.

## Adding a template

1. Add the id to `TemplateId` in `src/lib/types.ts` and to `ENUMS.template` in `src/lib/defaults.ts`.
2. Branch on `cfg.template` in `drawOne` (`src/lib/pdf.ts`).
3. Add the `<option>` in `App.tsx`.
4. Add it to the template list in the "renders every template and font" test.
