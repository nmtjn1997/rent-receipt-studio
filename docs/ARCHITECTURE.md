# Architecture

Everything runs in the visitor's browser. There is no server component, database or API.

## Modules

```mermaid
flowchart LR
  UI["App.tsx<br/>form, table, preview"] --> Store["storage.ts<br/>localStorage profiles"]
  UI --> Sched["schedule.ts<br/>months, proration, grouping"]
  UI --> Val["validate.ts<br/>PAN, dates, tax notes"]
  UI -->|"dynamic import"| Pdf["pdf.ts<br/>pdf-lib renderer"]
  Sched --> Dates["dates.ts"]
  Pdf --> Words["words.ts<br/>amount in words, INR grouping"]
  Store --> Norm["defaults.ts<br/>normalizeConfig"]
```

| Module | Responsibility |
|---|---|
| `src/lib/schedule.ts` | Turns a profile into month rows (flat rent, proration, hand-set months) and then into receipts (monthly, quarterly, half-yearly, consolidated). Pure functions. |
| `src/lib/pdf.ts` | Lays receipts out on A4 with pdf-lib. Three templates, 1 to 4 per page, bold values, text stays selectable. |
| `src/lib/validate.ts` | Blocking errors (missing names, bad PAN) and advisory notes (future dates, TDS, stamp). |
| `src/lib/defaults.ts` | `normalizeConfig` coerces any untrusted object into a valid profile. |
| `src/lib/storage.ts` | Reads and writes profiles in `localStorage`. Loads `src/seed.local.json` under `vite dev` only. |

## Generating a receipt PDF

```mermaid
sequenceDiagram
  actor U as User
  participant A as App (React)
  participant S as schedule.ts
  participant V as validate.ts
  participant P as pdf.ts (lazy chunk)
  participant F as iframe (blob URL)

  U->>A: edit a field
  A->>S: buildMonths(profile)
  S-->>A: month rows
  A->>S: buildReceipts(profile, months)
  S-->>A: receipts
  A->>V: validate(profile, months, receipts)
  V-->>A: errors and notes
  alt errors present
    A-->>U: disable download, show messages
  else valid
    Note over A: 250 ms debounce
    A->>P: generatePdf(profile, receipts)
    P-->>A: PDF bytes
    A->>F: show Blob URL
    F-->>U: live preview
  end
  U->>A: Download PDF
  A->>P: generatePdf(profile, receipts)
  P-->>A: PDF bytes
  A-->>U: file saved by the browser
```

The preview is the real output. What you see is the file you download.

## Where data lives

```mermaid
flowchart TB
  subgraph Browser["Your browser (nothing leaves it)"]
    Form["Form fields"] --> LS[("localStorage<br/>profiles")]
    Form --> PDF["PDF in memory"]
    PDF --> Save["Downloaded file"]
    JSON["Export / Import JSON"] <--> LS
  end
  Host["Static host<br/>GitHub Pages, Docker, any server"] -. "serves HTML, JS, CSS only" .-> Browser
  Browser -. "no requests carry your data" .-> Host
```

Three independent guards keep it that way:

1. The code makes no network calls other than loading its own static files.
2. The Docker image sends `connect-src 'none'`, so the browser itself blocks any outgoing request from the page.
3. `scripts/check-dist.mjs` fails the build if any value from a private `src/seed.local.json` appears in the output.

## Build and release pipeline

```mermaid
flowchart LR
  Push["push to main"] --> CI["ci.yml<br/>verify + docker health"]
  Push --> Pages["pages.yml<br/>build, publish, smoke test"]
  Pages --> Live["GitHub Pages site<br/>plus rent-receipt.html"]
  Tag["git tag v*"] --> Rel["release.yml"]
  Rel --> GH["GitHub Release<br/>one-file html + site zip"]
  Rel --> GHCR["GHCR image<br/>amd64 + arm64"]
```

## Build variants

| Command | Output | Use |
|---|---|---|
| `npm run build` | `dist/` (relative asset paths) | Any static host, sub-path safe |
| `npm run build:single` | `dist-single/rent-receipt.html` | One file, opens from disk, works offline |
| `docker build .` | nginx image on port 8080 | Servers, NAS, Raspberry Pi |
