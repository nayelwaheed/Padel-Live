# Padel Live v2.6 — Premier Padel match filtering

v2.5 proved the API is healthy, but the global `/matches` feed included every FIP event happening that day.

v2.6 changes the Worker to use the dedicated current-tournament endpoint:
`GET /api/tournaments/{tournament}/matches`

This means Today, Recent Results and Featured Match are sourced only from the active Premier Padel tournament.

## Update Cloudflare only first

1. Cloudflare -> Workers & Pages -> `padel-live-api`
2. Edit Code
3. Replace all code with `server/worker.js`
4. Deploy

Your `PADEL_API_TOKEN` secret remains saved.

## Test

Health:
`https://YOUR-WORKER.workers.dev/api/health`

Expected:
`"service":"padel-live-api-v2.6"`
and `"tokenConfigured":true`

Data:
`https://YOUR-WORKER.workers.dev/api/data`

Expected on Paris Major:
- `todayMatches` contains Paris Major matches only
- no unrelated FIP events
- `recentResults` contains Paris Major results only
- player names and finished scores remain populated
- `featuredMatch` is the current live/upcoming Paris Major match
- `warnings` should ideally be empty

You do not need to update the iPhone frontend yet just to test this Worker.
