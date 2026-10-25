# TFT: Ted's Fitness Tracker

Personal, self-hosted fitness tracker. React PWA, Fastify API, SQLite and Docker Compose. Caddy on the host terminates HTTPS.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and set strong secrets. Local API commands load this file automatically.
3. `npm run seed:legacy -- "C:\Users\PC\Documents\Obsidian\Main\10 Personal\10.11 Health - Fitness\Nutrition.md" "C:\Users\PC\Documents\Obsidian\Main\10 Personal\10.11 Health - Fitness\Food Products.md"`
4. `npm run dev:api` and `npm run dev:web` in separate terminals.

The API listens on port 3000 and Vite on 5173. Production: `docker compose up -d --build`. Point the existing Caddy site at `127.0.0.1:3307`. Do not expose the API container directly to the internet.

Backend code lives in `src/server/`: `index.ts` registers the API routes and authentication, `models.ts` defines request schemas and types, `db.ts` owns SQLite setup and queries, `schema.ts` defines the Drizzle tables, and `utils.ts` holds shared helpers.
Client code lives in `src/client/`: `main.tsx` mounts the app, `App.tsx` handles page state, `components/` contains the forms and display components, and `models.ts`, `constants.ts`, `utils.ts`, and `api.ts` keep types and helpers separate from the UI.

The seed command parses the current Markdown tables into `seed/legacy.json`. It never modifies the Vault. The API imports it only when its meal/product tables are empty; subsequent library edits remain in SQLite. B6, S1 and D7 get explicit initial variants. Other textual alternatives in the old prose stay in the meal description until they have separate macro estimates; this avoids assigning the same misleading figures to substantially different options.

Set `FITNESS_PUBLIC_ORIGIN` to the final HTTPS origin. Caddy example: `fitness.example.com { reverse_proxy 127.0.0.1:3307 }`. Keep `.env` private and use separate random values for the session secret and agent token. The agent sends `Authorization: Bearer <FITNESS_AGENT_TOKEN>` to the JSON API; the PWA uses an HttpOnly cookie. The `GET /api/agent/context?day=YYYY-MM-DD` and `PUT /api/agent/checkins/YYYY-MM-DD` endpoints support the PC check-in.

## Current scope

This first development slice includes password login, product and meal/variant CRUD, historic daily food entries with immutable macro snapshots, sleep and measurements entry, macro totals/percentages and an agent-authenticated JSON API. Garmin, Withings and Hevy connectors are not live yet and the UI labels them accordingly.

Settings now contain the meal/product library and editable daily macro targets. Target changes take effect from the current 07:00-based day in `Europe/Athens` onward; older days retain their previous targets. Existing single-value targets are migrated into the dated target history as the baseline.
