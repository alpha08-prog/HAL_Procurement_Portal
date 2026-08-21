# HAL Nashik Procurement Portal — Running it, and every flow in detail

This document covers two things: how to get the portal running, and exactly what happens
on each screen — who acts, what they may and may not do, and why the system refuses what
it refuses.

It is the guide to the **whole** portal. Two companion documents go deeper on the older
parts: `WORKFLOW_GUIDE.md` (e-File Noting and Contract Generation) and `ai/CASCADE.md`
(the responsibility cascade and its provenance).

---

## Part 1 — Running it

### 1.1 One-time setup

```bash
cd ~/github/hal/HAL_Procurement_Portal
npm install                                                    # client + server (workspaces)
conda run -n hal pip install pymupdf python-docx requests reportlab openpyxl
```

The Python side lives in a conda env called `hal`. Nothing in the **web app** needs
Python — that only matters for the CLI in Part 4.

**No database to install.** Every store is `node:sqlite`, created under `server/data/` on
first boot. The `pg` dependency is only used by the optional `server/database/migrate.js`;
you do not need PostgreSQL, and you do not need Docker.

### 1.2 Start the language model (optional)

```bash
ollama serve                  # in its own terminal, leave it running
ollama pull qwen2.5:3b        # one-time
```

Only the note *drafting* uses this. Without it everything still works — each note's
drafted section comes back marked `[SLM_UNAVAILABLE]` and the screen says so. Annexures,
figures, carry-forward, custody and every approval rule are unaffected, because none of
them ever went near the model.

### 1.3 Start the portal

```bash
cd ~/github/hal/HAL_Procurement_Portal
npm run dev
```

Wait for **both** lines before touching the browser:

```
[server] Mock API listening on http://localhost:3001
[client]   ➜  Local:   http://localhost:5173/
```

Then open **http://localhost:5173**.

> **The single most common mistake.** `http://localhost:3001` is the API. It serves no
> HTML, so it correctly answers `Cannot GET /`. The app is on **5173**, which proxies
> `/api` to 3001 for you. Never open 3001 directly.

`npm run dev` starts *both* halves. Do not also run `npm run dev:server` or
`npm run dev:client` — a second copy cannot bind the same port and you get `EADDRINUSE`.
One `Ctrl+C` stops both.

Vite is ready in about 200 ms and Express takes a second or two longer. If you submit the
login form in that gap you get `NetworkError when attempting to fetch resource` — just
reload once both lines are up.

### 1.4 Sign in

Every account uses the password **`hal@1234`** (four characters after the `@`).

| Email | Role | Cascade agency | What it is for |
|---|---|---|---|
| `indentor@hal.local` | `indentor` | **Indenting** | Raises requirements; opens AI cases |
| `maker@hal.local` | `purchase_maker` | **Tendering** | The purchase desk (IMM) |
| `officer@hal.local` | `purchase_officer` | **Tendering** | Routing and forwarding |
| `hod@hal.local` | `hod_imm` | **Tendering** | Approvals |
| `gm@hal.local` | `hod_imm` | **Tendering** | Division-wide supervision demo |
| `cm@hal.local` | `hod_imm` | **Tendering** | Direct-head visibility demo |
| `stores@hal.local` | `stores_inspection` | *none* | Read-only downstream position |
| `desk@hal.local` | `payment_desk` | *none* | Payment processing |
| `admin@hal.local` | `admin` | **both** | Sees every screen, acts as either agency |
| `test@hal.local` | `admin` | **both** | QA login |

**For demonstrating the portal, use two accounts, not admin.** Admin acts for both
agencies, so it is never blocked — and the blocking is the most interesting behaviour in
the system.

### 1.5 If something is already on a port

```bash
ss -ltnp | grep -E ':(3001|5173) '     # shows pid=NNNNN
kill <that pid>
```

Do **not** use `pkill 3001` — `pkill` matches process *names*, never ports, so it silently
does nothing. When a server runs under `node --watch`, kill the **parent** (`node --watch
index.js`), or the watcher just restarts the child and the port stays busy.

### 1.6 Resetting data

```bash
rm server/data/ai_cases.db      # AI cases
rm server/data/approvals.db     # approval chains and committees
node server/noting/seed.js      # re-seed the noting demo
node server/contracts/seed.js   # re-seed the contracts demo
```

Each store rebuilds on the next request.

---

## Part 2 — The pipeline at a glance

```
 ┌──────────────┐   ┌───────────────┐   ┌────────────┐   ┌────────────┐   ┌──────────┐
 │ 1  INTAKE    │──▶│ 2  APPROVAL   │   │ 3  AI      │──▶│ 4  BIDS    │──▶│ 5 CONTRACT│──▶ PAYMENT
 │ the checklist│   │    CHAIN      │   │    CASES   │   │            │   │           │
 │ decides WHO  │   │ WHO signs,    │   │ WHAT the   │   │ WHO is     │   │ the PO    │
 │ must sign    │   │ + release gate│   │ note says  │   │ eliminated │   │ becomes a │
 └──────────────┘   └───────────────┘   └────────────┘   └────────────┘   │ contract  │
        │                   ▲                                             └──────────┘
        └───────────────────┘
```

Modules 1–2 and module 3 are deliberately **independent** today. The approval chain governs
*who signs a note*; AI Cases governs *what the note says*. Joining them — so raising a note
in AI Cases spawns its approval chain automatically — is not built yet.

---

## Part 3 — Every flow, in detail

### 3.1 Indent Intake — the checklist decides who signs

**`Approvals ▸ Indent Intake`** · visible to indentor, maker, officer, HOD, admin

**What it is.** The 67-row Indentor Checklist from the client's workbook, filled in the
browser: 25 provisioning-file rows and 42 tender-document rows.

**Why it matters, and this is the point of the screen.** There is **no fixed approval
ladder.** Nine rows of the checklist name an approving authority inside their own
description text, so the answers decide who must sign. The right-hand panel recomputes
after every keystroke.

**Who does what.**

| Actor | Action |
|---|---|
| Indentor | Fills the checklist, picks division + requisitioning department |
| — | Presses **Resolve the chain** to preview, or **Start the file** to commit |

**Walk it.**

1. Set **Requisition ref**, **Subject**, **Division** (`DIV9`), **Requisitioning
   department** (`FIRE & SEC`). The Start button stays disabled until a department is
   chosen, because the chain cannot be resolved without one.
2. Expand *Provisioning file*. Each row shows its category (**Technical** / **Commercial**,
   from column G of the sheet) and what it feeds downstream (**TEC Report** /
   **Commercial Eval** / **Provisioning**, from column H).
3. Change **sl 22 — Short Tender** from `NA` to `YES`. Watch the right panel go from **4
   obliged authorities to 5**; the new one is the Head of Division, and the card quotes the
   clause that requires them.
4. **Resolve the chain** — 14 to 16 positions appear, each with the person the directory
   resolved and any caveat about how confidently.
5. **Start the file** — persists the answers and creates the chain.

**The nine rows that pull in an authority.**

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

**One subtlety worth knowing.** Row 13 reads *"Same requirement **not** raised within six
months"*, so answering **YES** means compliant and pulls in **nobody**. It is the only
inverted trigger, and it is marked as such in the code.

### 3.2 Approval Files — the chain, and the gate

**`Approvals ▸ Approval Files`** · visible to everyone

**What it is.** Files travelling their internal approval chain. The list is a queue: how
many are open, and how many are approved but still held by the gate.

**Where the chain shape comes from.** Not invented. `sampleData` contains a genuine
approved Provisioning Note that prints its own routing table — **14 hops, 10 people, 7
departments, 34 days**, all before the file reaches IMM. The chain is modelled on it, and
`ai/approval_run.py --replay-f1` replays that trail through the model and checks 8 of 8
properties.

**The positions, in order.**

| Position | Who it resolves to | From the real note |
|---|---|---|
| Originator | grade 3–4 in the requisitioning department | N1, Manager (Security) |
| Section check | the next rung up, same department | N2, Chief Manager |
| Department head | highest grade in that department | N3, DGM |
| Concurrences ×5 | HR, Planning, Plant Maintenance, QA/QC/QE, Projects | N4–N8 |
| Finance, two tiers | AGM (Finance), then DGM (Finance) | N9–N13 |
| *injected* | whatever the checklist obliged | — |
| CFA | via the DOP level | N14, GM(AOD) |

**Who does what.** Whoever holds the note picks from the hop types open to them:

| Hop | What it means | In the real note |
|---|---|---|
| **Forward** | pass it along | N2, *"forwarded for approval pl."* |
| **Concur & forward** | agree and move on | N3, N4, N6, N7 |
| **Concur with a rider** | agree, but bind a **later stage** to a condition | N8, *"remove brand/make before releasing the RFQ"* |
| **Send down to examine** | delegate to a junior in your own unit, expecting it back | N9 → N10, AGM(Fin) writes *"Pl examine"* |
| **Query the originator** | bounce a question back — **not** a rejection | N10 → N11 |
| **Approve / Reject** | CFA only | N14, *"Approved / मंजूर"* |

**What the system refuses.**

- Approving from any desk but the CFA → *"Only the CFA (name, grade) may approve this note"*
- A rider hop with no condition typed → refused; a rider that binds nothing is not a rider
- **Releasing the file on a CFA signature alone** — every obliged authority must have acted

**The release gate** is the heart of it. It reports exactly what is outstanding, for
example *"Concurrence — QA has not acted"*. A CFA approval with concurrences pending does
**not** free the file.

**Grade is not used to police the order.** The real chain runs
`4 → 6 → 7 → 7 → 6 → 7 → 8 → 8 → 8 → 7 → 4 → 7 → 8 → 9` — it descends twice. Grade decides
*authority* (who heads a unit, who is the CFA), never *who may come next*.

### 3.3 AI Cases — the notes get written

**`AI Cases`** · visible to everyone · **this is where generation happens**

**What it is.** A case is one procurement file walking the eight-stage responsibility
cascade. It is **shared, with custody**: the file sits with either the Indenting or the
Tendering agency, and only positions belonging to that agency may raise its next note.
Everyone else sees the same file, read-only.

That is the spreadsheet's row 23 — *"Note Can only be Generated by"* — turned into an
authorisation check, enforced server-side.

**Who does what.**

| Position | May do |
|---|---|
| `indentor@` (Indenting) | Open a case; raise the Provisioning Note (stage 1) and the TEC Report / TEC Query (stage 3) |
| `maker@` `officer@` `hod@` (Tendering) | Everything from tender opening to PO + Contract |
| `admin@` (both) | Any note, but still has to move the file across at each boundary |
| `stores@` `desk@` (neither) | Read any file. Raise nothing. Take custody of nothing. |

**Walk it — and use two accounts, or you will not see the interesting part.**

**As `indentor@hal.local`:**

1. **AI Cases** → **Open the file**. Set the requisition ref and subject, and choose which
   case seeds the facts:
   - *Night Vision Binoculars — CAR/25/229* — real, from `sampleData`
   - *250W LED High Bay — E-33046* — **fabricated bids**, and labelled as such everywhere
2. Click the requisition number to open the case.
3. Under **"Notes the sheet allows here"**, only the notes that stage permits appear. Press
   **Raise this note** on the Provisioning Note.
4. A pre-filled form appears — the fields are seeded from the case facts, and semicolons
   separate list items. Press **Generate the note**.
5. It takes a few seconds. Then a green banner:
   > **Provisioning Note raised.** The model drafted 326 characters; this note starts a
   > fresh chain. 1 annexure(s) computed. The next stage belongs to the **Tendering** Agency.

**As `maker@hal.local`**, open the same case:

6. **No raise buttons.** Only a banner — *"The file is with the Indenting Agency. Take it
   over to act."* — and a **Take the file over** button.
7. Take it. The hand-over is counted.
8. Raise **EMD Stage Acceptance**, then **TEC Request**. On that second one the banner
   reports *"745 characters of the previous note were carried forward in code"* — the prior
   prose is moved, not re-drafted.
9. Continue to **PO + HAL Contract**, or take a branch: **Retender**, or **Short Closure**
   (which closes the file permanently).

**As `stores@hal.local`:** the same file is readable, with no buttons at all.

**What happens inside a generation, in order.**

1. **Ingest** — the entered and seeded fields land on the case
2. **Branch** — a conditional note asks a rule; the answer is recorded either way
3. **Annexures** — built deterministically in code from the case
4. **Delta** — only the fields this note declares as new
5. **Carry-forward** — the prior note's prose is fetched **and never sent to the model**
6. **Draft** — the model sees the delta and the annexure *names*, nothing else
7. **Store** — drafted section, carried prose, annexures, path

Step 5 is why this is cheap and exact: each later note is roughly 80% a copy of the one
before, that 80% moves in code, and no figure can be re-invented in transit.

**What the system refuses.**

- Raising a note from the wrong agency → **403**, naming the agency that may
- Raising a note the sheet does not list at this stage → **422**, listing what is allowed
- Raising anything when the stage has crossed but the file has not → **409**, *"Hand it over first"*
- Opening a case as a Tendering position → **403**; a case starts with the indent
- Any action by `stores@` / `desk@` → **403**

**Advisory rules are overridable, and the override is recorded.** Two preferences come from
the Purchase Manual and the sample notes rather than the sheet — `pnc_required()` (L1 above
estimate, or no reverse-auction participation) and `retender_required()` (nil bids, or no
EMD-accepted bidder). Choosing against one returns **428** with a confirmation; proceeding
stamps *"override"* on the note. The spreadsheet holds no conditional logic of its own, so
no branch is ever hard-blocked.

**Hand-overs are the model working, not a nuisance.** A file on the normal route crosses
three times: Indenting raises the indent, Tendering runs the tender, Indenting does the TEC,
Tendering carries it to PO. The count is on the file.

### 3.4 Bid Evaluation — who is eliminated, and on what

**`Approvals ▸ Bid Evaluation`** · visible to everyone

**What it is.** The two gates that actually eliminate suppliers, recomputed from the
returned technical-bid compliance sheets. HAL's real sheet in `sampleData` is blank — it is
what HAL *issues*. The filled version is a fixture with fabricated bidders (`DV1`–`DV6`)
and every screen says so.

**Gate 1 — EMD.** A bidder may skip the deposit only if it **manufactures the offered
product in the relevant NIC category**. The bidder's own claim is not evidence: the server
reads Nature-of-Firm and the NIC code and decides.

> `DV5 Dummy Vendor 5 Trading Company` — **OUT at EMD**. Claimed an MSE waiver, but its NIC
> 46592 is wholesale trade, not manufacture of lighting equipment (27400).

That is the same test HAL applied to two bidders in the real Night Vision Binocular case.

**Gate 2 — TEC.** The rows the bidder marked `NO`, cited by specification line number so
the rejection can be defended.

> `DV2` — **OUT at TEC**, specification sl no 2 and 7: 110 lm/W against 130 required,
> IP 54 against IP 66.

**Then the price bid.** L1, variance against the estimate (+17.86%), reverse-auction
result, whether negotiation is therefore required, the negotiated saving (11.11%), and SD
at 5% and PBG at 10% of basic. Every figure is computed server-side; the screen calculates
nothing.

### 3.5 Committees — where a panel decides

**`Approvals ▸ Committees`** · visible to indentor, maker, officer, HOD, admin

Some stages are not a chain. **Every member signs, and since Annexure 21A Amendment 1 of
29-01-2024, every member also declares no conflict of interest with any bidder.** Order
does not matter; completeness does. One missing declaration blocks the report.

- **PNC** — its composition is real, named in the sample note F5. Leave the members box
  blank to use it.
- **TEC** — **no document in `sampleData` states who sits on a TEC.** The server refuses to
  generate a composition and asks for the members by name. That refusal is deliberate.

### 3.6 Personnel Directory

**`Approvals ▸ Directory`** · visible to everyone

1,354 officers across 19 units and 47 departments. Authority comes from grade:
`4 Manager → 6 Chief Manager → 7 DGM → 8 AGM → 9 GM → 10 ED`.

The useful part is the **"who heads this unit?"** lookup, because it is where the source
data runs out. The HR extract has no head-of-unit column, so where several officers share
the top grade the answer genuinely is not in the data — and the screen says so, listing the
candidates, rather than picking one. That is the case for **88 of 272** division-department
pairs.

### 3.7 e-File Noting and Contract Generation

Unchanged, and documented in detail in `WORKFLOW_GUIDE.md`. In brief:

- **Noting** (`/noting/*`) — any member initiates a file, routes notes member-to-member,
  raises clarifications, and a competent authority approves or rejects. Access is
  *positional*: exactly one member holds a note and only they can act.
- **Contracts** (`/contracts/*`) — an approved PO becomes a contract with its clause set
  auto-crawled from the 71 × 8 Contract Clauses Matrix, then finalised with a SHA-256
  integrity hash and a scannable QR code.

### 3.8 Payment

`RV Inbox → Payment Advice → Forward Advice → Process Payment → HOD Approval → CPPC`,
with the register and cycle-time metrics at the end. The state machine stamps the actor
server-side; the role switcher is not trusted. See `PROJECT_OVERVIEW.md` §7.

---

## Part 4 — The command-line side (optional)

The Python module in `ai/` is the original of the note pipeline. The web app no longer needs
it — the runtime was ported to Node in `server/ai/` — but the CLI is still the best way to
see the whole flow narrated.

```bash
conda activate hal            # then plain `python` works
cd ~/github/hal/HAL_Procurement_Portal
```

| What | Command | Ollama? |
|---|---|---|
| Narrated walkthrough, act by act | `./ai/demo.sh --pause` | optional |
| Same, skipping note drafting | `./ai/demo.sh --quick` | no |
| Replay the real 14-hop chain | `python ai/approval_run.py --replay-f1` | no |
| Build a chain and walk it | `python ai/approval_run.py --auto` | no |
| Bids in → EMD/TEC verdicts out | `python ai/bid_sheet.py` | no |
| The nine notes, NVB case | `python ai/run.py --auto` | **yes** |
| The nine notes, LED fixture | `python ai/run.py --auto --case ai/fixtures/case_input_E33046.json` | **yes** |
| Rebuild the server's seed JSON | `python ai/export_web.py` | no |

Only `ai/demo.sh` is executable. The `.py` files are modules — `ai/run.py --auto` gives
*Permission denied*; it is `python ai/run.py --auto`.

`ai/run.py` writes to `ai/outputs/`, which is what the **AI Documents** screen reads. That
screen is read-only and separate from **AI Cases**, which is the live one.

---

## Part 5 — Verification

```bash
node server/approvals/approvals.check.mjs     #  94/94  the approval layer vs its sources
node server/noting/noting.check.mjs           #         the noting workflow
node server/contracts/contracts.check.mjs     #         the contracts module
node server/ld.check.mjs                      #         the LD calculation
python ai/approval_check.py                   # 125/125 the Python layer vs its sources
```

Each check re-reads the client's own spreadsheets and asserts the encoding against them —
including the sheets' own typos (`ACCPETANCE`, `Indnetor`, `Evalaution`), so a silent
rewrite fails the check rather than passing quietly.

### Known issue, carried from an upstream commit

```bash
python ai/cascade_check.py     # KeyError: 'tender_doc'
```

`ai/cascade_check.py:125` asserts a `tender_doc` cascade node that the *tendering indenting
flow* refactor deliberately removed — `ai/stages.py` kept `tender_doc` in `STAGES`,
relabelled it *"Tender Document (Checklist + 72 Clauses)"*, and dropped it from `ORDER`.
`./ai/demo.sh` act 9 fails on the same line. Either delete the stale assertion or restore
the node, depending on the intent. **Nothing in the web app depends on it** — the server
reads exported JSON, not the Python.

---

## Part 6 — What the system deliberately will not do

Stated plainly, and surfaced in the API and on screen rather than hidden:

- **It will not compute a CFA level from an amount.** The DOP-2025 Annexure-3 value-band
  table is not in `sampleData`, so the level is read from the checklist and marked
  *human-supplied*.
- **It will not name the head of a unit when the data cannot.** Ties at the top grade are
  reported with all candidates (88 of 272 units).
- **It will not invent a TEC committee.** No source document states its composition.
- **It will not present fabricated data as real.** The LED case, its six bidders and every
  price are labelled fabricated on every screen and in every API response.
- **It will not let a file leave an agency early.** A CFA signature alone is not release.
- **It will not let the language model touch a figure.** LD, SD, PBG, variance, savings and
  the DOP level are computed in code; the model drafts prose and nothing else.

---

## Appendix — API reference

All routes require a Bearer JWT. Base `/api`.

**Approvals** (`/api/approvals`)

```
GET  /meta                                  notes, units, hop vocabulary, stated limits
GET  /directory?division&dept&minGrade&q    the personnel directory
GET  /head?division&dept                    who heads a unit — or that it is unknowable
GET  /checklist                             the intake form, both blocks
POST /checklist/preview                     answers in → obliged authorities out
POST /checklist/submissions                 persist a filled checklist
GET  /checklist/submissions[/:id]
POST /plan                                  resolve a chain without starting it
GET  /chains                                every file in flight
POST /chains                                start one
GET  /chains/:id
POST /chains/:id/hops                       act (428 = an advisory points elsewhere)
GET  /committees                            TEC / PNC panels
POST /committees
GET  /committees/:id
POST /committees/:id/members/:memberId/sign
GET  /bids                                  the EMD and TEC verdicts
```

**AI cases** (`/api/ai`)

```
GET  /me                       your cascade agency, and the role→agency mapping
GET  /slm                      is the model reachable, and is it pulled
GET  /cascade                  the responsibility graph and stage metadata
GET  /checklist-block1         the pre-tender input checklist and who owns each line
GET  /cases/sources            which case files can seed the facts
GET  /cases                    every case, flagged with whether it waits on you
POST /cases                    open one (Indenting only)
GET  /cases/:id
GET  /cases/:id/form/:noteId   the pre-filled form for a note
POST /cases/:id/notes          raise it — this is the generation call
POST /cases/:id/handover       take the file across
GET  /notes                    read-only: what the Python CLI wrote
GET  /pdf/:name                read-only: a generated PDF
```

**Where the code lives**

```
server/ai/            the note runtime ported to Node — stages, rules, formats, slm,
                      pipeline, cascadeGraph, access, caseStore
server/approvals/     the approval chain — org, checklist, chain, bids, store
server/routes/        approvals/index.js · aiCases.js · ai.js
client/src/screens/   Approvals/ · AiCases/
client/src/config/    approvalColumns.jsx · aiCaseColumns.jsx · roles.js
ai/                   the original Python module and its CLI
```
