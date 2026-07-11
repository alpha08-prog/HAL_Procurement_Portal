# HAL Nashik — Procurement Portal (Prototype)

Clickable prototype of the HAL Nashik public-procurement portal, for client demos and
feedback. Mock data only — no real integrations. Access is gated by a **login page** with
JWT auth; each account maps to one role, which decides the screens and row actions visible.

## Stack

- **Client** — React + Vite (`client/`), plain JSX and CSS
- **Server** — Node + Express serving mock JSON fixtures (`server/`)

## Run

```bash
npm install   # installs client + server (npm workspaces)
npm run dev   # starts mock API on :3001 and Vite on :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api` to Express.

## Test credentials

All accounts share the password **`hal@1234`**. Each maps to one role; sign in to see only
that role's screens. The **Admin** accounts (`admin@hal.local` and the `test@hal.local` QA
login) see every screen and get a role-switcher dropdown in the top bar to preview other
roles live during a demo.

| Email                | Role                | Sees |
|----------------------|---------------------|------|
| `test@hal.local`     | Admin (QA login)    | **everything** (+ role switcher) |
| `admin@hal.local`    | Admin               | everything (+ role switcher) |
| `maker@hal.local`    | Purchase Maker      | RV Inbox, Payment Advice, Register |
| `officer@hal.local`  | Purchase Officer    | Forward Advice, Register |
| `desk@hal.local`     | Payment Desk        | Process Payment, Register |
| `hod@hal.local`      | HOD (IMM)           | HOD Approval, Register |
| `stores@hal.local`   | Stores & Inspection | Register |
| `indentor@hal.local` | Indentor            | Register |

Accounts are seeded in `server/mock/users.json` (plaintext passwords, bcrypt-hashed in memory
on boot). The JWT signing secret is read from `JWT_SECRET` (a dev fallback is used if unset).

## Module C — e-File Noting: roles & rights

The noting module (`/noting/*`) does **not** use the payment job-titles above. Any HAL user
can initiate a note; authorization is **positional** — decided by the real signed-in member's
relationship to each note (who holds it, who has routed it, who supervises the initiating
unit), enforced in `server/noting/workflow.js`. The six positions and their edit (E) /
forward (F) / view (V) rights, taken straight from the access-rights spec:

| Capability | HAL User | Initiator | Routing Member (holding) | Recipient / Checker | CFA / Decider | Supervisory Head |
|---|---|---|---|---|---|---|
| Initiate N1 / standalone | E | — | — | — | — | — |
| Set classification / edit draft | — | E | E (holding draft) | — | — | — |
| Send draft for check | — | F | F | — | — | — |
| Comment (auto "Concurred & Forwarded") | — | E+F | E+F | — | E+F | — |
| Raise / answer clarification | — | E | E | E | E | — |
| Attach reference doc | — | E | E | — | E | — |
| Attach **stamping** doc / add **DoP** ref | — | E (only) | — | — | — | — |
| Send back to user / previous member | — | F | F | — | F | — |
| Add self / next member / member twice | — | F | F | — | F | — |
| Retract just-sent (before open) | — | F | F | — | F | — |
| Approve / Reject | — | — | — | — | E (only) | — |
| Retrieve from cabinet after decision | — | — | — | — | F (decider) | — |
| Share restricted link to a person | — | F | F | — | F | — |
| View note — Normal | V | V | V | V | V | V |
| View note — Restricted (graded) | ✗ | V | V | grantee | V | V (tenure) |
| View subordinates' / predecessor files | — | — | — | — | — | V (tenure) |
| Reports + lifecycle summary | own files | own files | own files | — | — | V (subtree) |
| Create next-stage note (N2..final) | — | E (case owner) | E (participant) | — | — | — |

PM references are automatic. Restricted levels are graded: Confidential (participants + any
supervising head) < Secret (+ the direct unit/dept head only) < Top Secret (participants +
explicit grant only). Supervisory visibility is tenure-bounded via the `postings` table (a
sitting head sees his subtree's whole history; a former head only his tenure window).

## Layout

```
client/public/           logos (HAL, IIIT Dharwad)
client/src/components/   shared UI (DataGrid, StatusPill, Header, RoleSwitcher, RequireAuth)
client/src/screens/      one folder per screen (incl. Login)
client/src/context/      AuthContext (JWT session) + RoleContext (role/gating)
client/src/config/       field/column configs, roles, status colours
client/src/lib/          api (auth fetch wrapper), currency (₹ lakh/crore), date (DD/MM/YYYY)
server/auth/             users seed loader + JWT helpers
server/middleware/       authMiddleware (verifies Bearer JWT on data routes)
server/mock/             JSON fixtures (RVs, payment advices, vendors, users)
server/routes/           Express API routes (incl. auth: login, me)
```
