# Padel Live

Installable iPhone web app for Premier Padel schedules, rankings, favourites and match alerts.

## App files

- `index.html` — app shell
- `styles.css` — black / purple / cream design system
- `data.js` — bundled fallback snapshot
- `config.js` — backend URL and refresh interval
- `app.js` — screens, favourites, notifications and automatic refresh logic
- `sw.js` — offline/service-worker cache
- `server/worker.js` — Cloudflare Worker backend
- `server/SERVER_SETUP.md` — backend deployment instructions

## Data flow

`Padel API -> Cloudflare Worker/cache -> Padel Live PWA`

When a Worker URL is configured, the app refreshes on launch, every minute while open, when manually refreshed, and whenever it returns to the foreground. If the backend cannot be reached, the bundled snapshot remains available.

See `START_HERE.txt` and `server/SERVER_SETUP.md` for setup instructions.
