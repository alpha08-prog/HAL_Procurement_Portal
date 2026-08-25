# HAL Nashik — Procurement Portal: Document & Module Overview

This document explains every source document under `sampleData/`, the end-to-end
procurement process they describe, what should be AI-enabled vs. plainly automated,
and the payment-advice module that is already built in this repo.

> **Context:** Hindustan Aeronautics Ltd (HAL), Nashik Division. Public procurement
> run on the **GeM** (Government e-Marketplace) portal, governed by **DOP-2025**
> (Delegation of Powers) and **Purchase Manual (PM) Issue-4**. Backend of record is
> **IFS-ERP**.

---

## Glossary

| Term | Meaning |
|---|---|
| MPR / SPR / CAR / CPR | Requisition types — Material / Stores / Capital Acquisition Request / (Consumable) Purchase Requisition |
| BQ / LPP | Budgetary Quote / Last Purchase Price (basis for the cost estimate) |
| DOP | Delegation of Powers (2025) — who can approve what value |
| CFA / FCA | Competent Financial Authority / Financial Concurrence Authority |
| EMD | Earnest Money Deposit (bid security; waivable for MSEs in relevant category) |
| TEC | Technical Evaluation Committee |
| RA | Reverse Auction (on GeM) |
| PBO | Price Bid Opening |
| PJS / CST | Price Justification Statement / Comparative Statement |
| PNC | Price Negotiation Committee |
| PP / PO | Purchase Proposal / Purchase Order |
| DPC | Departmental Purchase Committee |
| SD / PBG | Security Deposit (5%) / Performance Bank Guarantee (10%) |
| LD | Liquidated Damages (0.5%/week, max 10%) |
| RV / RR | Receipt Voucher / Receipt Report (goods inward) |
| FTR / QC | Final Test Report / Quality Control acceptance |
| CPPC | Centralised payment processing cell (where payment is finally dispatched) |
| PRR / PPR | Payment proposal / release reference issued by CPPC |
| MII / MLC | Make in India / Minimum Local Content |

---

## 1. File inventory (`sampleData/`)

> ⚠️ **Duplicates:** every file exists twice — once in `sampleData/` root and once inside
> `NOTING/` or `PAYMENT ADVICING/`. They are identical. Keep the foldered copies as the
> source of truth and delete the root copies to avoid editing the wrong file.

| File | What it is |
|---|---|
| `NOTING/NOTING SEQUENCE/Noting Sequence.docx` | The index: defines the 7 core sequential notes + ~16 need-based notes |
| `NOTING/NOTING SEQUENCE/GENRALIZED FORMAT PROVISIONING NOTE.docx` | Blank fill-in template for the Provisioning Note |
| `NOTING/NOTING SEQUENCE/F1 … Provisioning Note … .pdf` | Real **approved** Provisioning Note (scanned example of the template) |
| `NOTING/NOTING SEQUENCE/F2 … EMD Stage Acceptance … .docx` | EMD-stage offer acceptance note |
| `NOTING/NOTING SEQUENCE/F3 TEC Req Note.docx` | Technical Evaluation request note |
| `NOTING/NOTING SEQUENCE/F4 Note for Price bid Opening.docx` | Price Bid Opening request note |
| `NOTING/NOTING SEQUENCE/F5 Note for PNC req.docx` | Price Negotiation request note |
| `NOTING/NOTING SEQUENCE/F6 Note for PNC Recommendation.docx` | PNC recommendation note |
| `NOTING/NOTING SEQUENCE/F7 Note for PP.docx` | Purchase Proposal approval note |
| `NOTING/Checklist for Indentor … .xlsx` | Standard T&C checklist — the structured intake form |
| `NOTING/Activities to be AI Enabled-Automated.xlsx` | The build backlog (what to automate) |
| `PAYMENT ADVICING/Procurement Flow chart.xlsx` | Master process map of the full lifecycle |
| `PAYMENT ADVICING/Payment Advice Portal — Screen Data … .docx` | Spec for the 6 payment-module screens |
| `PAYMENT ADVICING/Sample RV (RECEIPT VOUCHER).pdf` | Example Receipt Voucher (the trigger for payment) — scanned image |

---

## 2. The procurement lifecycle (`Procurement Flow chart.xlsx`)

Five phases. The left side of the chart lists exception/rejection branches; the right
side the phase headers.

1. **PROVISIONING** — Requirement (RRT/RMSO/Production/Warranty/Capital/Service) →
   MPR/CAR/SPR → price estimate (BQ/LPP) → Provisioning Note → DOP approval → Indent → Budget.
2. **TENDERING** — Tender (with addendum / due-date extension / retendering branches) →
   Tender Opening → **EMD stage verification**.
3. **TECHNICAL** — TEC request of accepted offers → TEC query → bidder reply →
   TEC acceptance/rejection → update TEC report in GeM → TEC recommendation.
4. **COMMERCIAL** — Price Bid Opening → commercial evaluation → PJS/CST → PNC approval →
   PNC recommendation → **PP → PO → SD/PBG**.
5. **RECEIPT, CLAIM & PAYMENT** — Receipt of material / RR → claims → **payment**.
   *(This is the phase the built Payment Advice module covers — see §7.)*

Phases 1–4 are the **Noting** module; phase 5 is the **Payment Advising** module.
The boundary is the **Purchase Order**.

---

## 3. The noting sequence (`NOTING SEQUENCE/`)

`Noting Sequence.docx` defines **7 core sequential notes**:

1. Provisioning Note *(START of procurement)*
2. Technical Evaluation request Note
3. Technical Evaluation Report Note
4. Price Bid Opening request Note
5. Price Negotiation request Note
6. Price Negotiation Recommendation Note
7. Purchase Proposal Approval Note *(END of procurement)*

Plus ~16 **need-based notes**: clubbing of requirements, addendum issue, tender-date
extension, retendering, short closure, EMD-based acceptance, TEC query to bidders,
delivery-period extension & LD waiver, PO T&C change, banking-detail update, new vendor
creation in IFS, advance-payment sanction, PO cancellation, and other admin approvals.
These are the conditional branches from the flow chart's left column.

### File-noting conventions (important for the data model)

Inside each note:

- **`F1, F2, F3 …`** = references to **earlier notes/pages on the same e-file**.
- **`E1, E2, E3 …`** = **enclosures/exhibits** (tender doc, bids, TEC report, emails, certs).

### "Which note is for what" — mapping

| File | Core note | Decides |
|---|---|---|
| `GENRALIZED FORMAT …` | *(template)* | The blank Provisioning Note format |
| `F1 … .pdf` | **#1 Provisioning Note** | Admin + financial approval to start; purpose, requirement table, justification, budget head, DOP/PM compliance |
| `F2 … EMD Stage Acceptance` | EMD-stage acceptance *(need-based)* | Validates each bidder's EMD-waiver claim: is the bidder a **manufacturer of the offered product in the relevant NIC category?** |
| `F3 TEC Req Note` | **#2 TEC request** | Forwards EMD-accepted offers to the TEC |
| *(enclosure `E8`, no file)* | **#3 TEC Report** | TEC's own output — accept/reject per spec compliance |
| `F4 Note for Price bid Opening` | **#4 PBO request** | Approval to open price bids (PM 8.5.6 when few offers qualify) |
| `F5 Note for PNC req` | **#5 PNC request** | Approval to negotiate when L1 is over estimate / no RA participation; names the PNC |
| `F6 Note for PNC Recommendation` | **#6 PNC recommendation** | Records counter-offer (PM 8.20.1: counter-offer = negotiation) and recommends award |
| `F7 Note for PP` | **#7 Purchase Proposal** | DPC recommendation → CFA approval to place the PO; carries DOP header (Initiator/FCA/CFA/value) |

### Worked example in the samples — CAR/25/229, 5× Night Vision Binocular

- Estimate ₹15,94,065. GeM tender `GEM/2025/B/6638737`, HAL enquiry `E-31653`. **8 bids.**
- **EMD (F2):** all 8 sought waiver → 2 rejected (Anika Steel = steel maker; Hazzale = wrong
  category), **6 accepted**.
- **TEC (F3 → report):** 6 forwarded → only **2 accepted** (Precitex, Shobha); 4 rejected for
  spec non-compliance.
- **PBO (F4):** only 2 qualified → Level-I approval to open price bids.
- **PNC (F5):** no RA participation; L1 (Precitex) at ₹20,00,000 = **+25.47% over estimate** →
  negotiate.
- **PNC recommendation (F6):** counter-offer matches last purchase price ₹15,94,065 →
  **savings ₹4,05,935**.
- **PP (F7):** DPC → CFA (AGM IMM-OH, DOP Annex-3-B-2) approval to place the PO.

### 🔑 The key automation insight

F4, F5 and F7 are **~80% verbatim copies of the previous note** plus one new section
(F4 has the EMD table; F5 repeats it + price-bid results; F7 repeats everything + the
PP/CFA section). One procurement "case" object with **carry-forward** of prior-note prose
is therefore the single highest-value automation.

---

## 4. The Indentor checklist (`Checklist for Indentor … .xlsx`)

The structured intake form the user fills before procurement — effectively the data
dictionary for the provisioning and tender screens. Two blocks:

- **Provisioning-file clauses (rows A–C, 1–22)** → become the Provisioning Note: reason,
  requirement type, material classification, estimate basis (LPP/3-quote/GeM), budget head,
  HSN, GST%, DOP clause, GeM non-availability report, e-tender/limited-tender waivers,
  indigenisation, MII, short tender, etc. *(Orange rows are provisioning-file only — not the tender.)*
- **Tender-document clauses (rows 1–41)** → become the Tender/RFQ: tender type, bid system,
  delivery terms (FOR HAL Nasik), delivery period, warranty (12 months), LD (0.5%/week,
  max 10%), payment (100% on receipt, no advance), EMD / SD (5%) / PBG (10%) / indemnity bond,
  MSE reservations (25% / 4% SC-ST / 3% women), MII Class-I/II preference, land-border cert,
  arbitration, etc.

`Sheet2` is the material-classification dropdown (Capital, Project/Production Material,
Overhead, Tools & Gauges, GHE/GSE/BSE, Maintenance/Vehicle Spares, Civil, Welfare, Medicines, Misc).

---

## 5. AI-enablement backlog (`Activities to be AI Enabled-Automated.xlsx`)

10 chronological activities, each mapping to a note/format above:

| # | Activity | Maps to | Prereqs (per sheet) |
|---|---|---|---|
| 1 | Online Provisioning Note generation | F1 + template + checklist | customer/HAL req, BQ/LPP, cost estimate, qty, MPR/CAR/SPR, budget, DOP |
| — | Online Tender Spec, T&C & MPR checklist | `Checklist for Indentor` | qty, timelines, specs, commercial/statutory clauses |
| 2 | Online Tender Document generation | tender output | #1 |
| 3 | Online EMD / SD / PBG | F2 | bidder offer docs |
| 4 | Online TEC forwarding + recommendation | F3 + TEC report | 2 & 3 |
| 5 | Online PBO note generation | F4 | 4 |
| 6 | Online Commercial Evaluation | in F4/F5 | 5 |
| 7 | Online Comparative Statement + Price Justification | CST + PJS | 1 & 6 |
| 8 | Online PNC req + PNC recommendation | F5 + F6 | 1, 4 & 7 |
| 9 | Online PP note generation | F7 | 1–8 |
| 10 | Online PO / Contract generation | PO output | all |

Plus **11 standard PM formats** to template: MPR/SPR/CAR, TEC, Commercial Eval Statement,
Comparative Statement, Price Justification, PNC Agenda, PNC Recommendation, PP, PO,
HAL Std Contract, and other annexures.

### What is plain automation vs. genuine AI

**Deterministic automation (highest value, do first):**
- One procurement **case object** + template rendering with **carry-forward** of prior-note
  prose (kills the F4→F5→F7 copy-paste).
- Rule engines (no LLM): LD calculation, price-variance % and savings, **CFA/DOP-level
  determination**, MSE reservation thresholds, EMD/SD/PBG amount math.
- The 11 PM standard-format generators.

**Genuine AI (LLM) — where it earns its place:**
- **Bidder-document extraction & classification** — the F2 EMD decision (read Udyam cert +
  offer → extract NIC code → "manufacturer of offered product in *relevant* category?").
- **TEC spec-compliance mapping** — match offers against the HAL spec sheet, flag
  non-compliant clause numbers.
- **Narrative drafting** — justification, recommendation, PJS, PNC agenda in HAL house style.
- **Checklist validation** — flag missing mandatory clauses, suggest values, cite the
  right PM/DOP clause.
- **Variance / anomaly flagging** — e.g. "L1 +25.47% vs last purchase within 3 months →
  negotiate" (the human trigger in F5).

**Suggested build order:** provisioning intake → Provisioning Note → tender doc →
note-chain F2→F7 with carry-forward → PO → (hands off to the payment module).

---

## 6. Payment Advice spec (`Payment Advice Portal … .docx`)

Six screens; red fields auto-fetched from IFS-ERP, black fields user-entered.

1. **RV — Payment Status** — pending RVs from IFS (gate entry, PO, GeM contract, vendor, RV
   value, MSE category, pending days, PA-created status). Button per row → generate PA.
2. **Payment Advice Created** — maker verifies; fills invoice, LD (a = supply delay auto,
   b = I&C manual), attaches SD/PBG/EMD/indemnity, computes **Final Payment = RV value − LD**.
3. **Officer for Forwarding** — purchase officer verifies the advice, stamps and forwards
   to the payment desk.
4. **Processing Payment** — payment desk checks; accepts → forwards to CPPC, or returns with
   remarks. Captures CPPC PPR no/date.
5. **HOD-IMM Approval** — HOD clears the advice for dispatch to CPPC.
6. **Payment Record & History Register** — full audit register with cycle-time metrics.

---

## 7. The payment module as built (this repo)

A clickable React prototype with mock data — **no real IFS integration, no auth**
(a role switcher in the top bar stands in for login).

### Stack & run
- **Client** — React + Vite (`client/`), plain JSX/CSS.
- **Server** — Node + Express serving mock JSON fixtures (`server/mock/*.json`).
- npm workspaces. `npm run dev` → Express on `:3001`, Vite on `:5173` (proxies `/api`).
- Helpers: currency in ₹ lakh/crore, dates DD/MM/YYYY. **All money math is server-side.**

### Roles (`client/src/config/roles.js`)
`indentor`, `purchase_maker` (default), `purchase_officer`, `stores_inspection`,
`payment_desk`, `hod_imm`, `admin`. Each screen's `visibleTo` drives both the nav and route guards.

### Screens → routes
| Screen | Route | Visible to |
|---|---|---|
| 1 RV — Payment Status | `/rv-inbox` | purchase_maker, admin |
| 2 Payment Advice | `/payment-advice` | purchase_maker, admin |
| 3 Forward Payment Advice | `/forward-advice` | purchase_officer, admin |
| 4 Process Payment | `/process-payment` | payment_desk, admin |
| 5 HOD-IMM Approval | `/hod-approval` | hod_imm, admin |
| 6 Payment Record & History Register | `/payment-register` | all roles |

### Lifecycle state machine (`server/stateMachine.js`)
```
rv_pending → pa_created → forwarded_to_officer → at_payment_desk
           → sent_to_hod → stamped_by_hod → sent_to_cppc → paid
```
| Action | From → To | By | Rule |
|---|---|---|---|
| `forward_to_officer` | pa_created → forwarded_to_officer | maker | invoice no + date required |
| `officer_forward` | forwarded_to_officer → at_payment_desk | officer | — |
| `desk_send_back` | at_payment_desk → pa_created | desk | remark required |
| `desk_forward_hod` | at_payment_desk → sent_to_hod | desk | — |
| `hod_stamp` | sent_to_hod → stamped_by_hod | hod | — |
| `hod_return` | sent_to_hod → pa_created | hod | remark required |
| `desk_forward_cppc` | stamped_by_hod → sent_to_cppc | desk | PPR no + date required |
| `cppc_pay` | sent_to_cppc → paid | cppc | — |

The actor (`by`) is **stamped server-side** from the transition definition — the role
switcher is not trusted. Each move appends a history entry and syncs `rv.paStatus`.
The desk↔HOD loop: the desk **forwards to HOD**, HOD **stamps and returns it to the desk**,
the desk **forwards to CPPC** (capturing the PPR), and **CPPC releases the final payment**.
Read-only advices render in the two HAL hand-off document formats
(`client/src/components/paDocuments/`).

### LD calculation (`server/ld.js`)
- **(a) supply delay** — 0.5% of RV value × weeks (or part thereof, `ceil`) late between
  PO delivery-due date and gate-entry date. Auto-computed.
- **(b) installation & commissioning delay** — manual maker entry (`ldIcAmount`), judged
  against FTR date.
- **LD total = a + b**, capped at **10% of PO order value** *(base flagged for client
  confirmation — RV vs PO value)*. **Final payment = RV value − LD total.**

### Screen 2 form (`client/src/config/paFormFields.jsx`)
Sections render straight from config (client feedback edits the config, not components):
Advice & References · RV & PO Details · Vendor · Invoice (maker entry) · Payment Computation
(LD) · Securities & Holds · Attachments. Each field is tagged `ifs` (read-only, ERP-fetched),
`maker` (input), or `computed` (server-computed, read-only).

### API (`server/routes/paymentAdvices.js`, `rvs.js`)
- `GET /api/payment-advices` — list; `?state=` (comma-separated lifecycle filter), `?pa=`.
- `POST /api/payment-advices` — generate a PA from a pending RV (Screen 1).
- `POST /api/payment-advices/update` — save maker fields (locked once past `pa_created`).
- `POST /api/payment-advices/transition` — all lifecycle moves go through the state machine.
- `GET /api/payment-advices/register` — Screen 6: flattened rows + server-side cycle-times +
  summary cards + filter options (`?fy ?status ?officer ?q`).
- `GET /api/payment-advices/history` — ordered timeline for one PA.

Cycle-time metrics (advised-from-RV, processed-from-forwarding, RV-to-payment,
gate-entry-to-payment) are derived **server-side** from history dates — never in the UI.
