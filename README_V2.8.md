# Padel Live v2.8 — Background followed-player alerts

Adds:
- Upcoming matches for followed players
- iPhone-local match times
- Background Web Push via OneSignal
- 24-hour, match-started and match-completed notification toggles
- Cloudflare KV preferences storage
- Cloudflare Cron notification checks
- Backend test push

## IMPORTANT
This package is coded, but background alerts need a one-time OneSignal + Cloudflare setup. Follow the setup steps in ChatGPT.

Frontend public config (`config.js`):
- `apiBaseUrl`: your existing Cloudflare Worker URL
- `oneSignalAppId`: your OneSignal App ID (safe/public)

Cloudflare Worker requirements:
- Secret `PADEL_API_TOKEN` (already exists)
- Secret `ONESIGNAL_API_KEY`
- Variable/secret `ONESIGNAL_APP_ID`
- KV binding named `ALERTS_KV`
- Cron Trigger: `*/5 * * * *`

OneSignal worker file is included at:
`push/onesignal/OneSignalSDKWorker.js`
