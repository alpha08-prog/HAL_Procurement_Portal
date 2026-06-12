# HAL Nashik — Procurement Portal (Prototype)

Clickable prototype of the HAL Nashik public-procurement portal, for client demos and
feedback. Mock data only — no real integrations, no auth (role switcher in the top bar).

## Stack

- **Client** — React + Vite (`client/`), plain JSX and CSS
- **Server** — Node + Express serving mock JSON fixtures (`server/`)

## Run

```bash
npm install   # installs client + server (npm workspaces)
npm run dev   # starts mock API on :3001 and Vite on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to Express.

## Layout

```
client/src/components/   shared UI (DataGrid, StatusPill, Header, RoleSwitcher)
client/src/screens/      one folder per screen
client/src/config/       field/column configs, roles, status colours
client/src/lib/          currency (₹ lakh/crore) and date (DD/MM/YYYY) helpers
server/mock/             JSON fixtures (RVs, payment advices, vendors)
server/routes/           Express API routes
```
