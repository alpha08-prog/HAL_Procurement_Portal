-- Requisition register (MPR / CAR / CPR / SPR) — the intake that every other module's records
-- hang off. SQLite via node:sqlite, CREATE ... IF NOT EXISTS (later columns go through
-- ensureColumn in db.js). Status is NOT stored: status.js derives it from the linked noting
-- file, AI case, contract, RV and payment advice every time it is read.
CREATE TABLE IF NOT EXISTS requisitions (
  id                     INTEGER PRIMARY KEY,
  req_no                 TEXT NOT NULL UNIQUE,      -- <KIND>/<YY>/<NNN>, e.g. CAR/25/229 (slashes → query params, never path segments)
  kind                   TEXT NOT NULL,             -- MPR|CAR|CPR|SPR
  req_date               TEXT NOT NULL,
  reference_no           TEXT,                      -- indentor's own reference (e.g. KS/1060/NVB/2025/124)
  title                  TEXT NOT NULL,
  item_description       TEXT,
  part_no                TEXT,
  quantity               REAL,
  uom                    TEXT,
  delivery_period        TEXT,
  tendering_type         TEXT,                      -- Open (GeM) | Limited | Single | Proprietary | Rate contract
  budget_year            TEXT,
  budget_type            TEXT,                      -- Capital Budget | Revenue Budget
  budget_head            TEXT,
  budget_sl              TEXT,
  indentor_member_id     INTEGER,                   -- noting members.id when the indentor is a seeded member
  indentor_name          TEXT,
  indentor_pb            TEXT,
  indentor_dept          TEXT,
  indentor_division      TEXT,
  tech_specs             TEXT,
  scope_of_work          TEXT,
  proprietary            INTEGER NOT NULL DEFAULT 0,
  single_tender          INTEGER NOT NULL DEFAULT 0,
  brand_specific         INTEGER NOT NULL DEFAULT 0,
  estimate_basis         TEXT,                      -- LPP|BQ|GEM|INHOUSE
  estimate_inputs        TEXT,                      -- JSON: the inputs given to estimate.js
  estimate_basic         REAL,                      -- server-computed (estimate.js)
  estimate_gst           REAL,
  estimate_total         REAL,
  estimate_words         TEXT,
  dop_clause             TEXT,                      -- e.g. Annexure III B, Sl No 1a (from the indentor)
  dop_level              TEXT,
  dop_level_source       TEXT,                      -- checklist | pending_bands
  source_case            TEXT,                      -- nvb | led (AI pipeline case this requisition mirrors), NULL otherwise
  noting_file_pk         INTEGER,                   -- reverse pointers, maintained by links.js
  ai_case_id             INTEGER,
  approval_chain_id      INTEGER,
  checklist_submission_id INTEGER,
  contract_id            INTEGER,
  tender_no              TEXT,
  po_no                  TEXT,
  created_by             TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT
);

CREATE TABLE IF NOT EXISTS requisition_events (
  id             INTEGER PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id),
  kind           TEXT NOT NULL,                     -- registered | updated | estimated | linked
  detail         TEXT,
  actor          TEXT,
  created_at     TEXT NOT NULL
);
