-- Module D — Contract Generation store (SQLite via node:sqlite).
-- Idempotent: every table is CREATE ... IF NOT EXISTS so boot-time init is safe.
-- Clause bodies are SNAPSHOTTED onto each contract at generation time — amending the
-- library never rewrites an already-generated contract.

-- The 8 contract types from the client's Contract Clauses Matrix.
CREATE TABLE IF NOT EXISTS contract_types (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort  INTEGER NOT NULL
);

-- The Standard Contract Terms & Conditions library (72 clauses from the client's docx set).
CREATE TABLE IF NOT EXISTS clauses (
  id             INTEGER PRIMARY KEY,
  matrix_no      INTEGER,                            -- clause no in the Matrix; NULL = Option Clause (docx-only)
  docx_no        INTEGER NOT NULL,                   -- source document number (audit trail to the client's set)
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  boilerplate    INTEGER NOT NULL DEFAULT 0,         -- Matrix "Boilerplate clauses" column
  guideline      TEXT,                               -- Matrix "Guideline/Reference clause" (circular refs)
  optional_extra INTEGER NOT NULL DEFAULT 0,         -- offered for every type regardless of matrix
  version        INTEGER NOT NULL DEFAULT 1,
  updated_by     TEXT,
  updated_at     TEXT
);

-- Amendment history: every admin edit files the SUPERSEDED text + who/when/why/reference doc.
CREATE TABLE IF NOT EXISTS clause_versions (
  id              INTEGER PRIMARY KEY,
  clause_id       INTEGER NOT NULL REFERENCES clauses(id),
  version         INTEGER NOT NULL,                  -- the version being superseded
  prior_body      TEXT NOT NULL,
  changed_by_name TEXT,
  changed_by_pb   TEXT,
  changed_at      TEXT NOT NULL,
  change_note     TEXT NOT NULL,
  reference_doc   TEXT NOT NULL                      -- legal-vetting / circular reference for the change
);

-- Matrix cells, verbatim from the client's xlsx: Y | N | TBD | free-text condition.
-- Interpretation (auto/offered/excluded) lives in matrix.js, not here.
CREATE TABLE IF NOT EXISTS clause_matrix (
  clause_id        INTEGER NOT NULL REFERENCES clauses(id),
  contract_type_id TEXT NOT NULL REFERENCES contract_types(id),
  value            TEXT NOT NULL,
  PRIMARY KEY (clause_id, contract_type_id)
);

-- The contract register. Denormalised on purpose: the register must answer every field
-- the client listed without joins, and party/generator details must survive fixture edits.
CREATE TABLE IF NOT EXISTS contracts (
  id                   INTEGER PRIMARY KEY,
  contract_no          TEXT NOT NULL UNIQUE,          -- HAL/AOD/CTR/<FY>/<po-serial>/<NN> (slashes → never a path segment)
  po_no                TEXT NOT NULL,
  po_date              TEXT,
  tender_no            TEXT NOT NULL,
  contract_type_id     TEXT NOT NULL REFERENCES contract_types(id),
  description          TEXT,
  classification       TEXT NOT NULL DEFAULT 'normal', -- normal|restricted|confidential|secret|top_secret
  status               TEXT NOT NULL DEFAULT 'draft',  -- draft|finalised
  currency             TEXT NOT NULL DEFAULT 'INR',
  basic_value          REAL,                           -- server-computed from items
  tax_total            REAL,
  landed_value         REAL,
  hal_division         TEXT,
  hal_address          TEXT,
  vendor_id            TEXT,
  vendor_name          TEXT,
  vendor_gstin         TEXT,
  vendor_address       TEXT,
  vendor_contact       TEXT,
  car_no               TEXT,
  cfa_dop_ref          TEXT,
  mode_of_tendering    TEXT,
  scope_of_work        TEXT,                           -- from the Provisioning Note
  tech_specs           TEXT,                           -- from the Tender Document
  period_from          TEXT,
  period_to            TEXT,
  validity             TEXT,
  generated_by_name    TEXT,
  generated_by_pb      TEXT,
  generated_by_desig   TEXT,
  generated_by_dept    TEXT,
  generated_by_division TEXT,
  finalised_at         TEXT,
  finalised_by_name    TEXT,
  finalised_by_pb      TEXT,
  finalised_by_desig   TEXT,
  content_hash         TEXT,                           -- SHA-256 of the canonical content, set at finalise
  qr_payload           TEXT,                           -- JSON string the QR encodes
  smart_contract       INTEGER NOT NULL DEFAULT 0,     -- user opted in to the (simulated) smart-contract anchor
  smart_contract_sim   TEXT,                           -- JSON of the simulated anchor, always simulated:true
  created_at           TEXT NOT NULL
);

-- Clause snapshot per contract: auto (matrix), extra (user-ticked STC), custom (user-written).
CREATE TABLE IF NOT EXISTS contract_clauses (
  id             INTEGER PRIMARY KEY,
  contract_id    INTEGER NOT NULL REFERENCES contracts(id),
  position       INTEGER NOT NULL,
  clause_id      INTEGER REFERENCES clauses(id),      -- NULL for custom clauses
  clause_no      INTEGER,                             -- matrix no (display order), NULL for custom
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,                       -- snapshot — never re-read from the library
  clause_version INTEGER,
  source         TEXT NOT NULL,                       -- auto|extra|custom
  matrix_value   TEXT                                 -- the matrix cell that justified inclusion
);

-- Item lines from the HAL PO; tax_amount/line_total are server-computed and stored.
CREATE TABLE IF NOT EXISTS contract_items (
  id          INTEGER PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  line_no     INTEGER NOT NULL,
  part_no     TEXT,
  description TEXT,
  hsn         TEXT,
  qty         REAL,
  uom         TEXT,
  unit_price  REAL,
  gst_type    TEXT,                                   -- IGST | CGST+SGST
  gst_pct     REAL,
  tax_amount  REAL,
  line_total  REAL
);

-- Standard proformas the user attached as annexures (from seed/formats.json).
CREATE TABLE IF NOT EXISTS contract_formats (
  id          INTEGER PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  format_id   TEXT NOT NULL,
  label       TEXT NOT NULL
);
