# Backlog

Ordered. An agent or a person takes the first unchecked item, ships it with tests, ticks it, and moves on.

- [ ] Rupee symbol and Devanagari text: embed an open-licensed font (Noto Sans) via pdf-lib fontkit, keep the Latin-1 path as the fast default
- [ ] Installable offline PWA (manifest + service worker) for the hosted site
- [x] Per-receipt payment date override in the month table
- [ ] Multiple landlords in one profile (co-owners, split rent), one receipt block each
- [ ] Optional landlord signature drawn on a canvas, alongside image upload
- [ ] Keyboard and screen-reader audit of the month table (labels and live regions are done, table cell semantics are not)
- [ ] Lighthouse run in CI with a score floor
- [ ] Visual regression: rasterise sample PDFs with pdfjs in CI and diff against committed PNGs
- [ ] Translations of the form (Hindi first); receipt wording stays in English unless asked
- [ ] Sync profiles between two open tabs with the `storage` event instead of last-writer-wins
- [ ] Pin GitHub Actions by commit SHA
- [ ] Unit tests for `storage.ts` (load, corrupt entry, quota failure)
- [ ] Group-aware payment dates: print each month's date on a grouped receipt instead of only the first
