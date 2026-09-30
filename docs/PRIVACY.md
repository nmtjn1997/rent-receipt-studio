# Privacy

Rent receipts carry a PAN, addresses and rent amounts. This tool is built so none of that ever leaves your device.

## What is stored, and where

| Data | Where | How long |
|---|---|---|
| Names, addresses, PAN, rent, layout choices | Your browser's `localStorage`, under the key `rent-receipt.v1` | Until you clear site data or delete the profile |
| Signature image (optional) | Same place, as a data URL | Same |
| Generated PDFs | Memory only, then the file your browser saves | Until you close the tab |

There are no cookies, no analytics, no accounts and no server.

## Check it yourself

1. Open DevTools, Network tab, then generate and download a PDF. Only the site's own static files load.
2. Generate one preview, then turn off Wi-Fi. Everything keeps working (the PDF code loads on first use, so going offline before the first preview will not work; the one-file `rent-receipt.html` has no such limit).
3. With the Docker image: `curl -I http://localhost:8080` shows `connect-src 'none'`, which makes the browser refuse any request the page tries to send.

## If you host your own copy

- Keep personal profiles in `src/seed.local.json`. It is gitignored, loads only under `npm run dev`, and `npm run build` fails if any of its values end up in the bundle.
- Use the **Export** button to share a profile with someone. The signature image is left out of exports.
- Do not paste real details into GitHub issues, screenshots or tests.

## Sharing a profile safely

Export produces a JSON file with the names and addresses in it. Treat it like the receipt itself.
