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
| `gm@hal.local`       | HOD (payment side)  | GM (AOD) in the noting module — division-wide supervision demo |
| `cm@hal.local`       | HOD (payment side)  | CM (Purchase) in the noting module — direct-head "Secret" grade + top-secret participant demo |

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
A forward comment that is empty **or symbols-only** (`.` `,` `*`) is auto-replaced with
"Concurred & Forwarded" at send time. After a Purchase Order is approved and the case
closes, the cabinet offers a need-based **PO Amendment** note that reopens the case (its
own approval closes it again); amendment counts appear in the lifecycle report.

The seed (`node server/noting/seed.js` force-reseeds) ships a full demo storyline: an
in-progress NVB case with a cabinet next-stage prompt, an unopened hop for the Retract demo
(officer@ on the furniture file, test@ on the SYS file), line-wise child PPs, a predecessor-era
file, a rejected case, a closed PO case offering a PO Amendment, a confidential case with an
active need-to-know grant (`?grant=demo-grant-active-desk` for desk@) plus a revoked re-shared
grant and its leak alert (visible to officer@), and a top-secret case visible only to maker@ and cm@.

## Module D — Contract Generation (`/contracts/*`)

Generates a full HAL contract from a Purchase Order. The user supplies only the
Requisition/HAL IFS **tender no** (try `GEM/2025/B/6638737`, or `GEM/2025/B/7104412`
for a tender with two POs); the app prompts for the PO, **crawls the Standard Contract
Terms & Conditions automatically from the Contract Clauses Matrix** (71 clauses × 8
contract types, seeded verbatim from the client's xlsx + 72 clause documents), and pulls
value, item lines (with server-computed GST and landed value) and party details from the
HAL PO, and the scope of work from the Provisioning Note.

- **Generate Contract** — tender → PO dropdown → type of purchase (auto clauses locked,
  conditional clauses tickable, extra STC + user-written "Additional Clauses" + standard
  proformas to annex), 5-level classification (Normal / Restricted / Confidential /
  Secret / Top Secret). Visible to the purchase chain + admin.
- **Contract Register** — every generated contract with number, parties, value, CAR,
  tender, CFA & DOP reference, mode of tendering and the generator's name/PB/designation/
  dept/division; CSV export. Visible to all.
- **Contract view** — cover page, table of contents, numbered clauses, price-schedule
  annexure (amount in words), signature block. Drafts can be edited and **finalised**:
  finalisation locks the content, computes a SHA-256 integrity hash and stamps a
  scannable **QR code** (contract no + hash + date-time + signer credentials); printing
  adds a classification watermark and a running footer on every page. "Verify integrity"
  recomputes the hash; an optional smart-contract toggle anchors the hash to a clearly
  labelled **simulated** blockchain (demo stub). Print via the browser's Save-as-PDF
  (enable "Headers and footers" for page numbers).
- **Clause Library** — the 72 STC + the matrix grid. Read-only for everyone; **amending
  a clause is admin-only** (server-enforced on the real account role) and every amendment
  records the superseded text, who changed it, a change note and the legal-vetting
  reference doc. Amendments never alter already-generated contracts (clause bodies are
  snapshotted at generation).

Store: SQLite at `server/data/contracts.db` (`node server/contracts/seed.js` force-reseeds
the demo — one finalised "Restricted" NVB contract, one draft, one pre-seeded clause
amendment). PO/tender source data: `server/mock/pos.json`. Checks:
`node server/contracts/contracts.check.mjs`.

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
