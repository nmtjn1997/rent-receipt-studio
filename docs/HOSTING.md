# Hosting and running

Pick whichever fits. All of them serve the same static files, and none of them ever sees your data.

| I want to | Use | Needs |
|---|---|---|
| Just use it | The GitHub Pages link | A browser |
| Use it offline, no install | `rent-receipt.html` from Releases | A browser |
| Run it on my laptop | `npm run serve` | Node 22.13+ |
| Run it on a server or NAS | Docker | Docker |
| Host my own public copy | Fork + GitHub Pages | A GitHub account |

## 1. Host your own copy on GitHub Pages (free)

1. Fork this repository (or push a copy to your account).
2. Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand.
4. Your site appears at `https://<your-username>.github.io/<repo-name>/`.

The build uses relative asset paths, so the repo name and any custom domain work without config.
The workflow runs the unit tests, builds, deploys, then runs the browser test suite against the live URL.

## 2. One file, offline

Download `rent-receipt.html` from the latest release (or from `<your-site>/rent-receipt.html`) and double-click it.
It has no dependencies and makes no network calls. Works on macOS, Windows, Linux, and Chromium, Firefox or Safari.

Build it yourself:

```bash
npm ci
npm run build:single      # writes dist-single/rent-receipt.html
```

## 3. Run locally with Node

Install Node 22.13 or newer from https://nodejs.org (all platforms), then:

```bash
git clone https://github.com/<your-username>/rent-receipt-studio.git
cd rent-receipt-studio
npm ci
npm run dev               # development server, http://127.0.0.1:5177
npm run serve             # production build, http://127.0.0.1:5178
```

| Platform | Notes |
|---|---|
| macOS | `brew install node` or the nodejs.org installer |
| Windows | nodejs.org installer, then use PowerShell or Git Bash. Every npm script is cross-platform. |
| Ubuntu / Debian | `sudo apt install nodejs npm` may be old. Use `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash -` then `sudo apt install nodejs`, or `nvm install 22`. |
| Any | `npx serve dist` after `npm run build` also works with any static file server |

To let another device on your network open it, run `npx vite preview --host 0.0.0.0 --port 5178` after a build.

## 4. Docker

```bash
docker compose up -d --build        # http://localhost:8080
docker compose down
```

Or without compose:

```bash
docker build -t rent-receipt-studio .
docker run -d --name rent-receipt -p 8080:8080 --restart unless-stopped rent-receipt-studio
```

Prebuilt multi-arch images (amd64 and arm64, so Apple Silicon and Raspberry Pi work) are published on each release:

```bash
docker run -d -p 8080:8080 ghcr.io/<your-username>/rent-receipt-studio:latest
```

The container runs as an unprivileged user, read-only, and sends a Content Security Policy that forbids any outgoing request from the page.

## 5. Behind a reverse proxy or under a sub-path

The site is plain static files with relative URLs. Serve the contents of `dist/` at any path.
Example nginx location:

```nginx
location /rent/ { alias /var/www/rent-receipt/dist/; try_files $uri $uri/ /rent/index.html; }
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Preview is blank on a phone | Mobile browsers often cannot embed PDFs. Use **Open in new tab** or **Download PDF**. |
| Blank page from a Pages URL | Source must be **GitHub Actions**, not "Deploy from a branch". |
| `npm run e2e` cannot find Chrome | It uses your installed Google Chrome. Install it, or run `npx playwright install chromium` and change `channel` in `playwright.config.ts`. |
| Profiles vanished | Profiles live in that browser's storage. Clearing site data or switching browser starts fresh. Use **Export** to back up. |
