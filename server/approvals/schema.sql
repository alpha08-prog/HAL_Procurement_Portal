-- Module E — internal approval chains. Its own SQLite file, the same pattern as
-- server/noting/schema.sql and server/contracts/schema.sql, so live chains survive a
-- restart independently of the other stores. Idempotent: CREATE ... IF NOT EXISTS.

-- A filled indentor checklist. The answers are the input that decides who has to
-- approve, so they are stored as submitted rather than recomputed later.
CREATE TABLE IF NOT EXISTS checklist_submissions (
  id           INTEGER PRIMARY KEY,
  case_ref     TEXT,                            -- MPR/CAR/SPR ref this intake belongs to
  title        TEXT,
  division     TEXT NOT NULL,
  dept         TEXT,
  answers      TEXT NOT NULL,                   -- JSON: {"block:sl": "answer"}
  dop_level    TEXT,                            -- read from provisioning sl 11
  created_by   TEXT,                            -- auth user id
  created_by_name TEXT,
  created_at   TEXT NOT NULL
);

-- One approval chain = one note travelling inside one agency.
CREATE TABLE IF NOT EXISTS approval_chains (
  id            INTEGER PRIMARY KEY,
  file_id       TEXT NOT NULL,                  -- the eFile id the hops are stamped with
  note_id       TEXT NOT NULL,                  -- provisioning | tec_report | pnc_req ...
  label         TEXT,
  mode          TEXT NOT NULL,                  -- serial | committee
  agency        TEXT,                            -- Indenting | Tendering
  division      TEXT NOT NULL,
  dept          TEXT,
  case_ref      TEXT,
  submission_id INTEGER REFERENCES checklist_submissions(id),
  -- The resolved plan, frozen at creation: which positions must act, who each is, and
  -- every caveat about how confidently the directory named them. Snapshotted so a later
  -- change in the personnel sheet cannot silently rewrite a chain already in flight.
  plan          TEXT NOT NULL,                  -- JSON
  answers       TEXT,                            -- JSON, the answers this plan came from
  dop_level     TEXT,
  decision      TEXT,                            -- approve | reject | NULL
  closed        INTEGER NOT NULL DEFAULT 0,
  released      INTEGER NOT NULL DEFAULT 0,      -- passed the release gate
  created_by    TEXT,
  created_by_name TEXT,
  created_at    TEXT NOT NULL,
  closed_at     TEXT
);

-- Append-only. A query or a send-back ADDS a hop; it never rewrites one, which is how a
-- real HAL note reads (its N11 answers N10 in place, both printed).
CREATE TABLE IF NOT EXISTS approval_hops (
  id          INTEGER PRIMARY KEY,
  chain_id    INTEGER NOT NULL REFERENCES approval_chains(id),
  seq         INTEGER NOT NULL,
  note        TEXT NOT NULL,                    -- N1, N2, ...
  pb          TEXT,
  name        TEXT,
  designation TEXT,
  dept        TEXT,
  division    TEXT,
  grade_level INTEGER,
  slot_index  INTEGER,                           -- which planned position acted, if any
  action      TEXT NOT NULL,                     -- forward|concur|concur_with_rider|
                                                 -- examine|query|return_to|approve|reject
  comment     TEXT,
  hop_date    TEXT,
  txn_id      TEXT NOT NULL,                     -- per-HOP, as the real system stamps it
  two_factor  INTEGER NOT NULL DEFAULT 0,
  rider       TEXT,                              -- a condition binding a later stage
  acted_by    TEXT,                              -- auth user who pressed the button
  created_at  TEXT NOT NULL
);

-- Committee mode: stage 3 and the PNC are decided by a panel, not a queue.
CREATE TABLE IF NOT EXISTS approval_committees (
  id         INTEGER PRIMARY KEY,
  note_id    TEXT NOT NULL,
  division   TEXT NOT NULL,
  case_ref   TEXT,
  source     TEXT,                               -- the document the composition came from
  sourced    INTEGER NOT NULL DEFAULT 0,         -- 0 = composition not in sampleData
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- Every member signs, and since Annexure 21A Amendment 1 (29-01-2024) every member also
-- declares no conflict of interest. One missing declaration blocks the report.
CREATE TABLE IF NOT EXISTS approval_committee_members (
  id           INTEGER PRIMARY KEY,
  committee_id INTEGER NOT NULL REFERENCES approval_committees(id),
  spec         TEXT NOT NULL,                    -- "AGM(Fin) - Chairman"
  role         TEXT,
  pb           TEXT,
  name         TEXT,
  designation  TEXT,
  caveats      TEXT,                             -- JSON: how confidently they were named
  signed       INTEGER NOT NULL DEFAULT 0,
  coi_declared INTEGER NOT NULL DEFAULT 0,
  member_date  TEXT,
  remark       TEXT
);

CREATE INDEX IF NOT EXISTS idx_hops_chain ON approval_hops(chain_id, seq);
CREATE INDEX IF NOT EXISTS idx_members_committee ON approval_committee_members(committee_id);
