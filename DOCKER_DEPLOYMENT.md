# HAL Procurement Portal — Docker Deployment Guide

Two containers, no database server:

| Container | What it runs | Persistence |
|---|---|---|
| `hal_backend_server` | Express API on port 3001 (Node 24) | SQLite files under `/app/server/data` (volume `hal_data`); uploaded attachments under `/app/server/uploads` (volume `hal_uploads`) |
| `hal_frontend_portal` | nginx serving the built React app on port 80, reverse-proxying `/api` to the server | none |

What is and isn't persisted matches the dev setup: the noting, contracts, approvals,
AI-case and requisition stores are SQLite files and survive restarts and rebuilds; the
payment-advice and claims modules are in-memory stores seeded from `server/mock/*.json` and
**reset whenever the server container restarts**. There is no PostgreSQL and no migration step.

> The server needs Node ≥ 22.5 for the built-in `node:sqlite`; the image uses `node:24-alpine`.

---

## 1. Quick start

From the repository root:

```bash
docker compose up --build -d
```

Open `http://localhost` (or `http://<server-lan-ip>` from any workstation on the LAN).

Optional environment, set in a `.env` file next to `docker-compose.yml` or exported before
`docker compose up`:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Host port for the portal | `80` |
| `JWT_SECRET` | Token signing secret | dev secret (change it) |
| `CONTRACT_ENCRYPTION_KEY` | 32-byte hex/base64 key for contract payload encryption | unset: fixed demo key, labelled "demo key" in verify |
| `OLLAMA_URL` | Ollama for AI-case drafting | `http://host.docker.internal:11434` (Ollama on the host) |
| `SLM_MODEL` | Model name | server default `qwen2.5:3b` |
| `OTP_DEMO_ENDPOINT` | Expose `GET /api/auth/otp-demo` | `true` |

AI-case notes are still produced when Ollama is unreachable; the drafted section is marked
unavailable.

---

## 2. Test credentials

All seeded accounts share the password **`hal@1234`** (`server/mock/users.json`).

| Email | Role |
|---|---|
| `admin@hal.local`, `test@hal.local` | Admin — every screen plus the live role switcher |
| `indentor@hal.local` | Indentor |
| `maker@hal.local` | Purchase Maker |
| `officer@hal.local` | Purchase Officer |
| `stores@hal.local` | Stores & Inspection |
| `desk@hal.local` | Payment Desk |
| `hod@hal.local`, `gm@hal.local`, `cm@hal.local` | HOD (IMM) — the latter two are used in the noting supervision demos |
| `cppc@hal.local` | CPPC — releases the final payment |

`README.md` has the full account table with what each one sees.

---

## 3. Everyday commands

```bash
docker compose ps                 # container status
docker compose logs -f            # all logs
docker compose logs -f server     # API logs only
docker compose restart server     # restart the API (SQLite data survives; payment demo resets)
docker compose down               # stop, keep volumes
docker compose down -v            # stop AND wipe SQLite data + uploads (fresh demo)
```

### Back up / restore the SQLite data

```bash
docker cp hal_backend_server:/app/server/data ./backup-data      # copy out
docker cp ./backup-data/. hal_backend_server:/app/server/data    # copy back, then restart
```

### Reseed one module

```bash
docker compose exec server node noting/seed.js       # force-reseed noting
docker compose exec server node contracts/seed.js    # force-reseed contracts
# approvals / AI cases / requisitions: delete the file, it is rebuilt on boot
docker compose exec server rm data/approvals.db && docker compose restart server
docker compose exec server rm data/requisitions.db && docker compose restart server
```

---

## 4. Air-gapped / offline LAN server

On a machine with internet:

```bash
docker compose build
docker save -o hal_procurement_images.tar hal_procurement_portal-server hal_procurement_portal-client
```

On the offline server, copy the tar and `docker-compose.yml`, then:

```bash
docker load -i hal_procurement_images.tar
docker compose up -d
```

If Ollama is not available on that host, leave `OLLAMA_URL` as is; AI-case notes fall back
to the deterministic sections and mark the drafted paragraph unavailable.
