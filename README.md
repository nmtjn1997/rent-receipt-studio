# Rent Receipt Studio

Generate a full year of Section 10(13A) rent receipts as one PDF. Runs entirely in the browser.

```bash
npm install
npm run dev        # http://127.0.0.1:5177
npm run verify     # typecheck + unit + build + e2e
```

What it does: financial-year picker, yearly rent escalation, per-month overrides, proration, monthly / quarterly /
half-yearly / consolidated receipts, 1 to 4 per page, three templates, signature image, receipt numbers,
saved profiles with JSON import and export, ZIP of single PDFs, print. No watermark, no signup, no upload.

Optional: put profiles in `src/seed.local.json` (gitignored) to preload them on first run.
See `AGENTS.md` for the agent workflow.
