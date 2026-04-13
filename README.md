# Discord Interactions Minimal

Minimal webhook service for Discord Interactions endpoint verification.

## Endpoints
- `GET /health`
- `POST /api/discord/interactions`

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Set `DISCORD_PUBLIC_KEY` from Discord Developer Portal.
3. (Optional) Set `FORWARD_INTERACTIONS_URL` to your main app endpoint for non-PING interactions.
4. Install and run:
   - `npm install`
   - `npm start`

## Railway
- Deploy this folder as a separate service.
- Add env var: `DISCORD_PUBLIC_KEY`
- Add env var: `FORWARD_INTERACTIONS_URL` (example: `https://discord-dashboard.up.railway.app/api/interactions`)
- Add env var: `PUBLIC_KEY_RESOLVER_URL` (example: `https://discord-dashboard.up.railway.app/api/internal/interactions/public-key`)
- Add env var: `PUBLIC_KEY_RESOLVER_SECRET` (must match `INTERACTIONS_RESOLVER_SECRET` in dashboard-frontend)
- Use this URL in Discord Developer Portal:
  - `https://<your-railway-domain>/api/discord/interactions`

## Expected PING behavior
- Valid signature + PING (`type: 1`) => `200` with body `{"type":1}`

## Non-PING behavior
- If `FORWARD_INTERACTIONS_URL` is set, non-PING payloads are forwarded to your main app.
- If not set, the service returns `{ "type": 5 }`.

## Dynamic public key lookup
- The service resolves public key by `application_id` via `PUBLIC_KEY_RESOLVER_URL`.
- This allows customer custom bots to verify without changing Railway variables per customer.
