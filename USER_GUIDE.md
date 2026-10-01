# HAL Nashik Procurement Portal — Running it, and every flow in detail

This document covers two things: how to get the portal running, and exactly what happens
on each screen — who acts, what they may and may not do, and why the system refuses what
it refuses.

It is the guide to the **whole** portal. `WORKFLOW_GUIDE.md` goes deeper on e-File Noting
and Contract Generation screen by screen, and `ai/CASCADE.md` on the responsibility
cascade and its provenance.

---

## Part 1 — Running it

### 1.1 One-time setup

```bash
cd HAL_Procurement_Portal
npm install                                    # client + server (npm workspaces)
cp server/.env.example server/.env             # optional — see 1.7
```

**Node.js 22.5 or newer is required** (development runs on Node 24): every persistent store
is the built-in `node:sqlite`, created and seeded under `server/data/` on first boot.
There is no database to install and no Docker needed for development.

The Python side (Module B, the CLI) lives in a conda env called `hal` and is optional:

```bash
conda create -n hal python=3.10 -y
conda run -n hal pip install pymupdf python-docx requests reportlab openpyxl
```

### 1.2 Start the language model (optional)

```bash
ollama serve                  # in its own terminal, leave it running
ollama pull qwen2.5:3b        # one-time
```

Only the note *drafting* uses this. Without it everything still works — each AI note's
drafted section comes back marked `[SLM_UNAVAILABLE]` and the screen says so. Annexures,
figures, carry-forward, custody, gates and every approval rule are unaffected, because
none of them ever went near the model.

### 1.3 Start the portal

```bash
npm run dev
```

Wait for **both** lines before touching the browser:

```
[server] HAL portal API listening on http://localhost:3001
[client]   ➜  Local:   http://localhost:5173/
```

Then open **http://localhost:5173**.

> **The single most common mistake.** `http://localhost:3001` is the API. It serves no
> HTML, so it correctly answers `Cannot GET /`. The app is on **5173**, which proxies
> `/api` to 3001 for you. Never open 3001 directly.

`npm run dev` starts *both* halves. Do not also run `npm run dev:server` or
`npm run dev:client` — a second copy cannot bind the same port and you get `EADDRINUSE`.
One `Ctrl+C` stops both.

### 1.4 Sign in

Every account uses the password **`hal@1234`**.

| Email | Role | Cascade agency | What it is for |
|---|---|---|---|
| `indentor@hal.local` | `indentor` | **Indenting** | Requisitions, the checklist, provisioning stage files, opening AI cases |
| `maker@hal.local` | `purchase_maker` | **Tendering** | The purchase desk (IMM): tender-stage notes, contracts, payment advices |
| `officer@hal.local` | `purchase_officer` | **Tendering** | Routing and forwarding; contract release and verification |
| `hod@hal.local` | `hod_imm` | **Tendering** | Approvals: chains, stage files, the HOD stamp on advices |
| `gm@hal.local` | `hod_imm` | **Tendering** | Division-wide supervision demo |
| `cm@hal.local` | `hod_imm` | **Tendering** | Gaurav Yadav, the tender initiator in the seeded storyline |
| `stores@hal.local` | `stores_inspection` | *none* | RV inbox, raising and dispatching claims; read-only elsewhere |
| `desk@hal.local` | `payment_desk` | *none* | Payment processing and the 23-point checklist |
| `cppc@hal.local` | `cppc` | *none* | Releases the final payment |
| `admin@hal.local`, `test@hal.local` | `admin` | **both** | Sees every screen, acts as either agency, gets the role switcher |

**For demonstrating the portal, use the named accounts, not admin.** Admin acts for both
agencies and passes every role check, so it is never blocked — and the blocking is the
most interesting behaviour in the system. The admin **role switcher** in the top bar
previews what another role *sees*; it never changes what the server *allows*.

### 1.5 Finding your way around

Every role lands on **`/portal`**, the Portal Hub: six tabs (Provisioning, Procurement,
Contract Management, Payment, Claim Management, KPI) holding the 80 items of HAL's portal
specification. The top bar offers a **module switcher** (Provisioning · Noting · Approvals
· AI Cases · Contracts · Payments · Claims · KPIs — only the modules your role can see) and,
under it, the screens of the current module. Both come from one file,
`client/src/config/roles.js`, and the same rules are enforced by the server.

### 1.6 If something is already on a port

```bash
# Linux / macOS
ss -ltnp | grep -E ':(3001|5173) '     # shows pid=NNNNN
kill <that pid>
# Windows (PowerShell)
netstat -ano | findstr ":3001 "        # last column is the PID
taskkill /PID <pid> /F
```

When a server runs under `node --watch`, kill the **parent** (`node --watch index.js`),
or the watcher just restarts the child and the port stays busy.

### 1.7 Environment (`server/.env`, template `server/.env.example`)

| Variable | Purpose |
|---|---|
| `PORT` | API port (3001) |
| `JWT_SECRET` | Token signing secret (dev fallback when unset) |
| `STORAGE_PATH` | Where uploaded attachments go (`server/uploads`) |
| `NOTING_DB` `CONTRACTS_DB` `APPROVALS_DB` `AI_CASES_DB` `REQUISITIONS_DB` | SQLite file overrides; the check scripts use them for throwaway DBs |
| `CONTRACT_ENCRYPTION_KEY` | 32-byte key for the contract payload encryption. Unset → a fixed demo key, and every verify result says "built-in DEMO key" |
| `OLLAMA_URL` `SLM_MODEL` | The local model (`http://localhost:11434`, `qwen2.5:3b`) |
| `OTP_DEMO_ENDPOINT` | `true` exposes `GET /api/auth/otp-demo`, which returns the signed-in user's current one-time code |

### 1.8 Resetting data

```bash
node server/noting/seed.js          # force-reseed the noting demo
node server/contracts/seed.js       # force-reseed contracts
rm server/data/requisitions.db      # requisitions — reseeded on next boot
rm server/data/approvals.db         # approval chains and committees — rebuilt on boot
rm server/data/ai_cases.db          # AI cases — rebuilt on boot
# payment advices, RVs and claims are in memory: restart the server
```

Seed order matters once: the requisition seed back-fills `requisition_id` on the seeded
NVB contract, so if you reseed contracts, delete `requisitions.db` as well.

---

## Part 2 — The pipeline at a glance

```
 G REQUISITION ──▶ E CHAIN + C PROVISIONING ──▶ F AI CASE ──▶ C PURCHASE PROPOSAL ──▶ F PO NOTE
 CAR/25/229        the checklist decides        EMD … PP       + its own E chain          validated
                   who signs; the stage         drafted in                                against the
                   file waits for the gate      code + SLM                                PO fixture
                                                                                             │
 KPIs · claims · trackers ◀── A PAYMENT ADVICE ◀── A RECEIPT VOUCHER ◀── D CONTRACT ◀────────┘
                               LD · securities      SEC/26/031           finalise · release
                               CPPC release
```

The modules are joined by stored links and by gates:

| Hand-off | Link | Gate |
|---|---|---|
| Requisition → noting file | `files.requisition_id` | a cascade stage other than provisioning cannot start a new file |
| Noting stage → approval chain | `notes.approval_chain_id` (provisioning and purchase-proposal stages, per `server/noting/approvalPolicy.json`) | the stage cannot be **approved** until its chain is **released** |
| Noting file ↔ AI case | `files.ai_case_id` / `ai_cases.noting_file_pk` | the **PO note** cannot be raised until the Purchase Proposal is approved on the noting side (override recorded) |
| PO note → requisition | `tender_no`, `po_no` on the requisition | the PO number must exist in the PO fixture unless the case is the fabricated one |
| PO → contract | `contracts.requisition_id`, `po_no` | a contract is generated only from a PO; release only after finalisation |
| PO → RV → payment advice | joined at read time by PO number | credit note required before a PA when the invoice exceeds the RV |

A requisition's **status is derived** from those links, never typed:
`Registered → Checklist submitted → Provisioning → Tendering → PP approved → PO placed →
Contracted → Received → Paid`, or `Short-closed` / `Rejected`.

---

## Part 3 — Every flow, in detail

### 3.1 Portal Hub (`/portal`)

Six tabs, 80 items, three kinds of item — and none of them is a placeholder:

- **Routes** open a screen, usually deep-linked: PRV-01 opens the requisition register,
  PRO-02 … PRO-18 open the noting Initiate screen at that stage, CON-01 the "PP approved"
  contract queue, CLM-01 the claim form, PAY-04 the payment advice.
- **Format modals** render one of the 36 standard formats on the server, pre-filled from a
  requisition, PO, contract or RV you pick, and print it (**Print / Save as PDF**).
  Eight formats HAL has not yet supplied open with a *"Template not on file"* banner and a
  working draft of the fields.
- **Tools** — the eight trackers (CON-02, 04–07, 09, 10, PAY-06), the **LD calculator**
  (PAY-03) and **price estimation sheet** (PRV-06), the **DOP-2025 lookup** (PRV-11) and the
  sixteen **KPI detail views** — all read from the server.

The counter on the hub shows how many formats are transcribed and how many are pending.

### 3.2 Provisioning workspace — the requisition register (`/provisioning`)

**Visible to everyone; creating and editing needs indentor, the purchase chain, HOD or admin.**

Three tabs: **Requisitions**, **Certificates** (the proprietary, single-tender, brand and
adequacy formats, rendered for the selected requisition), **Manuals** (DOP-2025, Purchase
Manual Issue-4, the works manual reference).

**Walk it, as `indentor@hal.local`.**

1. The register lists the ten seeded requisitions (MPR/CAR/CPR/SPR) with their derived
   status and **Linked records** — the noting file, AI case, approval chain, contract, PO.
   `CAR/25/229` (Night Vision Binocular) is the storyline case.
2. **+ New requisition** — kind, title, item, part no, quantity, UOM, delivery period,
   tendering type, budget, DoP clause, technical specification, scope of work, then the
   **estimate**: basis (LPP / budgetary quotation / GeM / in-house), reference, quantity,
   unit basic rate, escalation, GST, freight. **Preview estimate** asks the server for the
   basic, escalation, GST and landed totals with the amount in words; nothing is computed
   in the browser.
3. Click a row to open the detail panel: every field, the estimate, the linked records,
   **Edit** (refused with 409 once a noting file is linked — the requisition is then
   frozen), **Tender document** (the compiled tender document from the checklist answers
   and the standard clauses), and **Initiate note** — which opens the noting wizard with the
   requisition locked in — or **Open note** once one exists.

**What the system refuses.**

- Editing a requisition that already has a noting file → 409
- Starting a noting file for an unknown requisition → 422; for one that already has a file → 409

### 3.3 Indent Intake — the checklist decides who signs (`/approvals/intake`)

**Visible to indentor, maker, officer, HOD, admin.**

The 67-row Indentor Checklist from the client's workbook, filled in the browser: 25
provisioning-file rows and 42 tender-document rows. There is **no fixed approval ladder.**
Nine rows name an approving authority inside their own description text, so the answers
decide who must sign. The right-hand panel recomputes after every keystroke.

1. Set **Requisition ref**, **Subject**, **Division** (`DIV9`), **Requisitioning
   department** (`FIRE & SEC`). The Start button stays disabled until a department is
   chosen, because the chain cannot be resolved without one.
2. Change **sl 22 — Short Tender** from `NA` to `YES`. The right panel goes from **4
   obliged authorities to 5**; the new one is the Head of Division, and the card quotes the
   clause that requires them.
3. **Resolve the chain** previews the 14–16 positions with the person the directory
   resolved for each; **Start the file** persists the answers and creates the chain.

| Row | Answer | Adds |
|---|---|---|
| prov sl 10 / 11 | CPA level | the CFA at that level |
| prov sl 12 | proprietary / single-tender certificate | the DOP-2025 authority |
| prov sl 13 | requirement repeated within six months | Head of Division |
| prov sl 15 | e-tender waiver above ₹2 lakh | Head of Division |
| prov sl 16 | limited tender, under 5 sources | Head of Division (PM 6.8.2) |
| prov sl 18 | brand or make specific | Committee / CPA |
| prov sl 19 | global tender exemption | **the Ministry — outside HAL** |
| prov sl 21 | indigenisation check | Indigenisation Cell |
| prov sl 22 | short tender, under 3 weeks | Head of Division |

Row 13 reads *"Same requirement **not** raised within six months"*, so answering **YES**
means compliant and pulls in nobody. It is the only inverted trigger.

### 3.4 Approval Files — the chain, and the gate (`/approvals/chains`)

**Visible to everyone; acting needs indentor, the purchase chain, HOD or admin.**

Files travelling their internal approval chain. Chains are created here from the checklist,
and **automatically** when a provisioning or purchase-proposal stage file opens in noting
(the noting note shows an *Approval chain #n* strip linking here).

**Where the chain shape comes from.** `sampleData` contains a genuine approved Provisioning
Note that prints its own routing table — **14 hops, 10 people, 7 departments, 34 days** —
and the chain is modelled on it (`ai/approval_run.py --replay-f1` replays that trail).

| Position | Who it resolves to |
|---|---|
| Originator | grade 3–4 in the requisitioning department |
| Section check, Department head | the next rung up, then the highest grade in that department |
| Concurrences ×5 | HR, Planning, Plant Maintenance, QA/QC/QE, Projects |
| Finance, two tiers | AGM (Finance), then DGM (Finance) |
| *injected* | whatever the checklist obliged |
| CFA | via the DOP level |

**Acting on a hop.** The person the slot resolved to (or an admin acting for them) picks a
hop: **Forward**, **Concur & forward**, **Concur with a rider** (binds a later stage to a
condition), **Send down to examine**, **Query the originator** (not a rejection), **Send
back to an earlier hop**, and for the CFA only **Approve** / **Reject**. Each hop asks for
the **6-digit one-time password**; **Get demo code** fetches the current one from the
server (`OTP_DEMO_ENDPOINT`). The hop's date is stamped by the server.

**Positions the directory cannot resolve** (a unit with several officers at the top grade)
show a **Name** button: name the holder, and the hop is recorded as an `assign`. **Riders**
list under the chain with **Record as discharged**; an undischarged rider blocks release.

**What the system refuses.**

- A hop from an account that is not the slot's holder → 403 (admin excepted)
- Approving from any desk but the CFA → *"Only the CFA … may approve this note"*
- A rider with no condition typed; a wrong or missing OTP
- **Releasing the file on a CFA signature alone** — the **release gate** lists exactly what
  is outstanding (*"Concurrence — QA has not acted"*, *"rider not discharged"*, *"position
  not named"*)

Grade decides *authority*, never *who may come next*: the real chain descends in grade twice.

### 3.5 AI Cases — the notes get written (`/ai-cases`)

**Visible to everyone; raising notes needs a position in the holding agency.**

A case is one procurement file walking the eight-stage responsibility cascade under
**custody**: it sits with the Indenting or the Tendering agency, and only positions of that
agency may raise its next note. That is the spreadsheet's row 23 — *"Note Can only be
Generated by"* — enforced server-side (`server/ai/access.js`).

| Position | May do |
|---|---|
| `indentor@` (Indenting) | Open a case; raise the Provisioning Note and the TEC Report / TEC Query |
| `maker@` `officer@` `hod@` (Tendering) | Everything from tender opening to PO + Contract |
| `admin@` (both) | Any note, but still has to move the file across at each boundary |
| `stores@` `desk@` `cppc@` (neither) | Read any file. Raise nothing. |

**Walk it with two accounts.** As `indentor@`: **Open the file**, choose the case that
seeds the facts — *Night Vision Binoculars — CAR/25/229* (real) or *250W LED High Bay —
E-33046* (**fabricated bids**, labelled everywhere) — then **Raise this note** on the
Provisioning Note, check the pre-filled form and generate. As `maker@`: the same case shows
no raise buttons, only **Take the file over**; take it, raise **EMD Stage Acceptance** and
**TEC Request** (the banner reports how many characters were carried forward in code), and
carry on to **PO + HAL Contract**, **Retender** or **Short Closure**.

**What happens inside a generation.** Ingest → branch rule (recorded either way) →
annexures built in code → the delta of new fields → the prior prose fetched **and never
sent to the model** → the model drafts the new section from the delta and the annexure
names → everything stored with the case path. That is why each later note is ~80% a copy
moved in code, and no figure can be re-invented in transit.

**Gates and advisories.**

- Wrong agency → **403**; a note the sheet does not list here → **422**; stage crossed but
  file not handed over → **409** *"Hand it over first"*; opening a case as Tendering → 403.
- `pnc_required()` (L1 above estimate, or no reverse-auction participation) and
  `retender_required()` only **advise**; choosing against one returns **428** and **Raise it
  anyway (recorded as an override)** stamps the override on the note.
- The **PO note** has a hard gate: the linked noting proposal's Purchase Proposal must be
  **approved** with its approval chain **released**. Otherwise 428 with the reason; a
  purchase officer may still override, and the note records `gate post_pp: …`.
- The PO number is validated against `server/mock/pos.json` (422 if unknown) unless the
  case is the fabricated fixture; raising it writes the tender and PO numbers onto the
  linked requisition.
- Rejecting an AI-sourced stage on the noting side **rolls the case back** to the state
  before that note (the note is voided, the event logged).

Each case view prints with **Download PDF**.

### 3.6 Bid Evaluation, Committees, Directory (`/approvals/bids`, `/committees`, `/directory`)

**Bid Evaluation** recomputes the two gates that eliminate suppliers from the returned
technical-bid sheets. HAL's own sheet in `sampleData` is blank; the filled version is a
fixture with fabricated bidders (`DV1`–`DV6`) and every screen says so. **Gate 1 — EMD**: a
bidder may skip the deposit only if it manufactures the offered product in the relevant NIC
category; the claim is not evidence, the server reads Nature-of-Firm and the NIC code.
**Gate 2 — TEC**: the rows marked `NO`, cited by specification line. Then L1, variance
against the estimate, reverse-auction result, whether negotiation is required, the
negotiated saving, SD at 5% and PBG at 10% — all server-computed.

**Committees.** Every member signs, and every member declares no conflict of interest with
any bidder (Annexure 21A Amendment 1, 29-01-2024). The **PNC** composition is real (sample
note F5). For the **TEC**, **no document in `sampleData` states who sits on it**, so the
server refuses to invent a composition and asks for the members by name.

**Directory.** 1,354 officers across 19 units and 47 departments; authority comes from
grade. The **"who heads this unit?"** lookup answers honestly: where several officers share
the top grade the answer is not in the data, and the screen lists the candidates instead
of picking one (88 of 272 division-department pairs).

### 3.7 e-File Noting (`/noting/*`)

`WORKFLOW_GUIDE.md` covers every screen and button. The essentials:

- **A proposal is a chain of stage files** — Provisioning, EMD, TEC Request, TEC Report,
  Price Bid Opening, PNC Request, PNC Recommendation, Purchase Proposal, PO — plus
  need-based notes (Retender, Short Closure, TEC Query, Advance Payment, PO Amendment, and
  the off-cascade TEC Representation, Bank Detail Insertion, Vendor ID Creation, Vendor
  Registration, Due-Date Extension, Addendum, Misc). Each stage file has its own routing
  trail and minutes N1…Nx.
- **Custody, not roles.** Exactly one member holds a note; only they (or their active
  **delegate**, from the Inbox's **Delegate Authority** panel) can act. Everyone who ever
  held it can read it. The **planned routing** set at initiation is enforced hop by hop
  unless the holder deviates with a reason.
- **Authority.** A stage is decided by its planned approving authority. Provisioning and
  Purchase Proposal stages also carry a Module E chain and return **409** on approve until
  it is released.
- **Classification per note** (normal → restricted → confidential → secret → top secret)
  with need-to-know links that revoke on re-share; **clarifications** are two-party threads
  in their own accordion on the note.
- **Formats on file.** Any holder can **Render & attach** a standard format from the
  library to a note; AI annexures arrive as computed attachments, never as fake files.
- **Initiate** collects the routing plan, approver, priority, DoP row, stamping setup, files
  and the **one-time password** (verified by the server) in one wizard; the Portal Hub's
  note items and the requisition register deep-link into it.

### 3.8 Contracts (`/contracts/*`)

- **CON-01 PP approved list** (`/contracts/register?filter=approved_pp`) — requisitions
  whose Purchase Proposal is approved with a released chain and no contract yet; each row
  opens **Generate Contract** pre-filled with its tender, PO and requisition.
- **Generate** builds the draft from the PO fixture and the 71 × 8 clause matrix (auto,
  offered and excluded clauses classified server-side), with additional clauses and annexed
  standard formats rendered from the library.
- **Finalise & stamp** freezes the content, computes SHA-256 and the QR payload, and (with
  the smart-contract toggle) encrypts the canonical payload — with a **fixed demo key**
  unless `CONTRACT_ENCRYPTION_KEY` is set, and the verify result says which.
- **Release to IFS** (CON-02) records the release with an optional GeM contract number;
  status becomes `released`. **Verify integrity** recomputes the hash and the simulated
  anchor and names the key source. **Decrypt (admin, demo)** proves the round trip.
- Every draft edit, finalisation, release and verification is written to the contract's
  audit trail.

### 3.9 Payment (`/rv-inbox` → `/payment-advice` → `/forward-advice` → `/process-payment` → `/hod-approval` → CPPC)

`RV Inbox` shows every receipt voucher with its linked **requisition and contract**, aging
badges and pending-days SLA. Vouchers whose invoice exceeds the accepted value need a
**credit note** first: **Upload Credit Note** (maker) takes the number, remarks and **the
document itself** (stored with a SHA-256 digest) before a payment advice can be generated.

**Payment Advice** (maker): LD is computed by the server from the PO due date and gate
entry (0.5% of RV value per week or part, capped at 10% — cap base pending HAL's
confirmation in `server/config/ldPolicy.json`); securities and attachments are **real
uploads** (RV copy, invoice, FTR, warranty, bank change, SD/PBG/EMD/indemnity copies, CA
approval, vendor request, SSL intimation) with **Upload / Replace / View**; **Fetch from IFS
/ EMD portal** shows the fixture facts the advice was built from, labelled as such. The
creator's name comes from the signed-in account.

Then the state machine: officer **Forward** (or send back), desk **Forward to HOD** with the
23-point checklist note, HOD **Stamp & forward** / **Return**, desk **Forward to CPPC** with
the PPR, and `cppc@` **Record payment released**. Each actor is checked against the JWT role
on the server; the register and **Payment KPIs** derive every cycle time from the history.

### 3.10 Claims (`/claims`)

Tabs: **Claim status (all)**, **Units dispatched under claim**, **Item received against
claim**, **Claims closed**, **+ Raise a claim**, **Discrepancies without a claim** (the RVs
whose credit note or bank verification is still open in Module A).

Stores or the purchase maker **raise** a claim on an RV/PO (rejection at inward inspection,
transit damage, shortage, warranty…; action sought: replacement, repair, credit note, free
supply). Stores **dispatch** it to the vendor with a returnable gate pass, **receive** the
replacement, and stores or the maker **close & settle**. Claim numbers are
`CLM/<financial year>/NNN`. The store is in memory, like the payment module.

### 3.11 KPIs, trackers, calculators (`/kpis`, `/payment-kpis`, hub tools)

- **Procurement KPIs & MIS** — the sixteen KPIs of the specification, computed over the
  last 3 / 6 / 12 months from the requisitions, notes, cases, contracts, POs, RVs and
  advices actually in the stores, each with its series, target, source and a note.
  KPI-11/12 (SC/ST and women entrepreneurs) read the `mseScSt` / `mseWomen` flags in the
  vendor fixture — fixture values until HAL's vendor master supplies the real ones — and
  name that source. **Print MIS report** prints the page.
- **Payment Desk KPIs** — cycle times, stage timeline, pipeline, monthly trend, vendor
  breakdown, officer performance and SLA distribution, all from advice history over the
  chosen window; where there is no data the tile says "No data source in prototype".
- **Trackers** (hub) — PO due, DP expired (with LD from `ld.js`), live PO status, PO
  receipts, EMD/SD/PBG securities, balance outstanding, e-release and GeM sync, each
  stating its source (`pos.json` + `rvs.json` + contracts) and as-of time.
- **LD calculator** and **price estimation sheet** post their inputs to the server and
  render the result.

---

## Part 4 — The integrated storyline, account by account

The seeded data is the real Night Vision Binocular case. To walk it end to end:

1. **`indentor@`** — Provisioning → `CAR/25/229` → **Initiate note** (or open the seeded
   file `AOD/IMM/2026/0001`). The Provisioning stage opens with its approval chain.
2. **The chain** — Approvals → Approval Files → the chain for that file: concurrences,
   finance, CFA, each with the OTP; release gate green.
3. **`hod@`** — Noting → Inbox → the Provisioning stage → **Approve & File** (refused with
   409 while the chain is not released).
4. **`indentor@`** — Cabinet → **Send to Tender Initiator** → Gaurav Yadav (`cm@`).
5. **`cm@` / `maker@`** — Cabinet → **Generate EMD Stage Acceptance Note** → **Draft & Raise
   with AI →** through TEC Request, TEC Report (Indenting), Price Bid Opening, PNC, and the
   **Purchase Proposal** — which gets its own chain; approve it once released.
6. **`maker@`** — AI Cases → the case → **PO + HAL Contract**: gated on that approval,
   pre-filled with `IMM/PO/25-26/0533`, validated against the PO fixture.
7. **`maker@`** — Contracts → **PP approved list** → Generate → **Finalise & stamp** →
   `officer@` **Release to IFS** → **Verify integrity**.
8. **`stores@`** — RV Inbox → `SEC/26/031` shows the requisition and the contract.
9. **`maker@`** — Payment Advice: LD ₹7,970 for the late gate entry, uploads, forward.
   `officer@` → `desk@` → `hod@` → `desk@` → **`cppc@` Record payment released**.
10. **KPIs** — `/kpis` and `/payment-kpis` move; Provisioning shows `CAR/25/229` as **Paid**.

---

## Part 5 — The command-line side (optional)

The Python module in `ai/` is the original of the note pipeline. The web app runs the Node
port in `server/ai/`, but the CLI is still the best way to see the whole flow narrated.

```bash
conda activate hal
```

| What | Command | Ollama? |
|---|---|---|
| Narrated walkthrough, act by act (acts 0–10) | `./ai/demo.sh --pause` | optional |
| Same, skipping note drafting | `./ai/demo.sh --quick` | no |
| Replay the real 14-hop chain | `python ai/approval_run.py --replay-f1` | no |
| Build a chain and walk it | `python ai/approval_run.py --auto` | no |
| Bids in → EMD/TEC verdicts out | `python ai/bid_sheet.py` | no |
| The nine notes, NVB case | `python ai/run.py --auto` | **yes** |
| The nine notes, LED fixture | `python ai/run.py --auto --case ai/fixtures/case_input_E33046.json` | **yes** |
| Rebuild the server's seed JSON | `python ai/export_web.py` | no |

`ai/run.py` writes to `ai/outputs/`, which is what the **AI Documents** screen
(`/noting/ai-documents`) reads. That screen is read-only and separate from **AI Cases**.

---

## Part 6 — Verification

```bash
npm run check                                  # all of the below
node server/ld.check.mjs                       # LD math
node server/server.check.mjs                   # routers, nav/hub config, no inline columns or MOCK_ data in screens
node server/noting/noting.check.mjs            # noting workflow, access, chain gate
node server/contracts/contracts.check.mjs      # contracts, release, verify, decrypt
node server/approvals/approvals.check.mjs      # 113/113 the approval layer vs its sources
node server/ai/ai.check.mjs                    # rules, post_pp gate, rollback
node server/formats/formats.check.mjs          # 36 formats, every hub modal mapped
node server/trackers/trackers.check.mjs
node server/requisitions/requisitions.check.mjs
node server/claims/claims.check.mjs
node server/kpis/kpis.check.mjs

conda run -n hal python ai/cascade_check.py    # the cascade vs the spreadsheet
conda run -n hal python ai/approval_check.py   # the Python approval layer vs its sources
conda run -n hal python ai/validate.py         # generated notes vs gold facts
```

Each check re-reads the client's own spreadsheets and asserts the encoding against them —
including the sheets' own typos (`ACCPETANCE`, `Indnetor`, `Evalaution`), so a silent
rewrite fails the check rather than passing quietly.

---

## Part 7 — What the system deliberately will not do

- **It will not compute a CFA level from an amount.** The DOP-2025 Annexure-3 value bands
  are not in `sampleData`; `ai/dop2025.json` holds the empty table, and the level is read
  from the checklist and marked pending.
- **It will not name the head of a unit when the data cannot.** Ties are reported with all
  candidates, and a chain slot stays unfilled until someone names the holder.
- **It will not invent a TEC committee.**
- **It will not present fabricated data as real.** The LED case, its six bidders and every
  price are labelled fabricated on every screen and in every API response.
- **It will not let a file leave an agency early**, approve a stage before its chain is
  released, or raise a PO note before the Purchase Proposal is approved — without a recorded
  override where the sheet allows one.
- **It will not let the language model touch a figure.**
- **It will not pretend to integrate.** Every IFS/GeM value is fixture data and labelled so;
  the contract "blockchain" is a simulation and says so; the OTP is a demo scheme.

---

## Appendix — API reference

All routes require a Bearer JWT except `/api/auth/login` and `/api/health`. Base `/api`.

**Auth** — `POST /auth/login` · `GET /auth/me` · `GET /auth/otp-demo`

**Requisitions** (`/api/requisitions`)

```
GET  /kinds  /estimate/bases         MPR/CAR/CPR/SPR and the estimate bases
POST /estimate                       stateless price estimate
GET  /                               register (?kind &status)
POST /                               create (indentor, purchase chain, HOD, admin)
GET  /:id   PATCH /:id               detail with links; edit until a file is linked (409)
POST /:id/estimate                   store an estimate
GET  /:id/tender-doc                 the compiled tender document
```

**Noting** (`/api/noting`)

```
GET  /stages /me /org /members /overview /sentbox /upcoming /dashboard
GET  /delegation   POST /delegation   POST /delegation/cancel
POST /files                          new file + N1 (?requisitionId; cascade stages refused)
POST /files/:filePk/notes            next stage file
GET  /files        GET /inbox        GET /cabinet    GET /cabinet/:filePk/stage-history
POST /files/:filePk/tender-initiator POST /cabinet/:filePk/generate-next-stage
GET  /notes/:txnId                   detail (note, file, entries, plannedRouting, approvalChain, proposal)
POST /notes/:txnId/{entries,draft,send-check,forward,send-back,retract,decision,retrieve}
GET  /notes/:txnId/{history,summary,grants,clarifications,attachments}
POST /notes/:txnId/{grant,clarifications,attachments}     GET /alerts
POST /clarifications/:id/messages    GET /notes/:txnId/attachments/:attachmentId/download
GET  /notes/:txnId/ai-cascade        POST /notes/:txnId/ai-link
GET  /notes/:txnId/ai-form/:noteId   POST /notes/:txnId/ai-raise   POST /notes/:txnId/ai-handover
GET  /reports/{lifecycle,stage-time,tree,live-status}
```

**Approvals** (`/api/approvals`)

```
GET  /meta /directory /head /checklist          POST /checklist/preview
POST /checklist/submissions   GET /checklist/submissions[/:id]     POST /plan
GET  /chains   POST /chains   GET /chains/:id
POST /chains/:id/hops                           act (OTP verified; 428 = advisory)
POST /chains/:id/slots/:index/assign            name an unresolved position
GET  /committees  POST /committees  GET /committees/:id  POST /committees/:id/members/:memberId/sign
GET  /bids
```

**AI** (`/api/ai`)

```
GET  /me /slm /cascade /checklist-block1 /cases/sources /cases
POST /cases         GET /cases/:id      GET /cases/:id/form/:noteId
POST /cases/:id/notes                   raise (403/422/409; 428 advisory or post_pp gate)
POST /cases/:id/handover
GET  /notes         GET /pdf/:name      the Python CLI's outputs (read-only)
```

**Contracts** (`/api/contracts`)

```
GET  /tenders /lookup /lookup/po /clause-plan /formats /pp-approved
GET  /            POST /            GET /:id      PATCH /:id (draft only)
POST /:id/finalise   GET /:id/verify   POST /:id/release   GET /:id/decrypt (admin)
GET  /library   GET /library/clauses/:id/history   PUT /library/clauses/:id (admin)
```

**Payments** (`/api/rvs`, `/api/payment-advices`)

```
GET  /rvs                       POST /rvs/credit-note-decision
GET  /payment-advices           (?state ?pa)    POST /payment-advices    POST /payment-advices/update
POST /payment-advices/transition                POST /payment-advices/ld-calc
POST /payment-advices/credit-note (JSON or multipart)   POST /payment-advices/credit-note-waiver
GET  /payment-advices/attachments?pa=   POST /payment-advices/attachments (multipart paNo,key,file)
GET  /payment-advices/attachments/download?pa=&key=
GET  /payment-advices/register  GET /payment-advices/history   GET /payment-advices/kpis?months=
```

**Formats, trackers, claims, KPIs**

```
GET  /formats  GET /formats/dop  GET /formats/:id  POST /formats/:id/render {fields, requisitionId|contractId|poNo|rvNo}
GET  /trackers  GET /trackers/:name      po-due dp-expired live-po po-receipts securities balance-outstanding erelease gem-sync
GET  /claims/enums  GET /claims/discrepancies  GET /claims?tab=  POST /claims  POST /claims/transition
GET  /kpis?months=  GET /kpis/:code
```

**Where the code lives**

```
server/requisitions/  register, derived status, cross-module links
server/noting/        workflow, access, delegation, approvalLink, stages, seed
server/approvals/     org, checklist, chain, bids, store
server/ai/            the note runtime ported to Node — stages, rules, formats, gates, slm, pipeline, cascadeGraph, access, caseStore
server/contracts/     matrix, generate, money, poSource, seed
server/formats/  server/trackers/  server/claims/  server/kpis/
server/routes/        one router per module
client/src/config/    roles.js, portalStructure.js and every column config
ai/                   the original Python module and its CLI
```
