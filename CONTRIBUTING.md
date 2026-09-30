# Contributing

Bug reports, templates and tax-format tweaks are welcome.

```bash
npm ci
npm run verify      # typecheck, unit tests, build, one-file build, browser tests
```

- Add a test with every behaviour change. Prefer asserting on text extracted from the generated PDF.
- Use fake data only: `Test Tenant`, `Test Landlord`, `ABCDE1234F`. Never real names, PANs or addresses.
- Keep it client-side. No analytics, no remote fonts, no network calls.
- `AGENTS.md` describes the layout and the fix-and-rerun loop. It works for people as well as coding agents.
- To add a template, follow "Adding a template" in `AGENTS.md`.
