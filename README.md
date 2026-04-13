# Discord Interactions Minimal

Minimal webhook service for Discord Interactions endpoint verification.

## Endpoints
- `GET /health`
- `POST /api/discord/interactions`

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Set `DISCORD_PUBLIC_KEY` from Discord Developer Portal.
3. Install and run:
   - `npm install`
   - `npm start`

## Railway
- Deploy this folder as a separate service.
- Add env var: `DISCORD_PUBLIC_KEY`
- Use this URL in Discord Developer Portal:
  - `https://<your-railway-domain>/api/discord/interactions`

## Expected PING behavior
- Valid signature + PING (`type: 1`) => `200` with body `{"type":1}`
