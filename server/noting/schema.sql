-- Module C — e-File Noting Workflow store (SQLite via node:sqlite).
-- Idempotent: every table is CREATE ... IF NOT EXISTS so boot-time init is safe.
-- One store, separate from Module A's in-memory mock; the AI pipeline is never written to.

-- Organisation tree: Corporate > Complex > Division > Department > Section (self-referencing).
CREATE TABLE IF NOT EXISTS org_units (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  kind      TEXT NOT NULL,                         -- corporate|complex|division|department|section
  code      TEXT,                                  -- e.g. dept/section no
  parent_id INTEGER REFERENCES org_units(id)
);

-- People. `pb` (personnel/badge no) is the real HAL identity the email keys everything on.
CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY,
  pb            TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  email         TEXT,
  designation   TEXT,
  app_role      TEXT,                              -- maps to client roles.js id, when the member can log in
  section_id    INTEGER REFERENCES org_units(id),  -- current posting (a leaf unit)
  heads_unit_id INTEGER REFERENCES org_units(id)   -- unit this member heads (section/dept/division), else NULL
);

-- Posting history — powers tenure / predecessor / post-transfer visibility (Phase 7).
CREATE TABLE IF NOT EXISTS postings (
  
  id           INTEGER PRIMARY KEY,
  member_id    INTEGER NOT NULL REFERENCES members(id),
  org_unit_id  INTEGER NOT NULL REFERENCES org_units(id),
  role_in_unit TEXT,                               -- member|head
  from_date    TEXT NOT NULL,
  to_date      TEXT                                -- NULL = current
);

-- The parent e-file. One MPR/CAR/SPR/CPR can spawn many child files (Phase 6 tree).
CREATE TABLE IF NOT EXISTS files (
  id                 INTEGER PRIMARY KEY,
  file_id            TEXT NOT NULL UNIQUE,          -- connected File ID e.g. AOD/IMM/2026/0001
  title              TEXT NOT NULL,
  kind               TEXT NOT NULL,                 -- MPR|CAR|SPR|CPR|standalone
  car_no             TEXT,                          -- NULL for standalone
  standalone         INTEGER NOT NULL DEFAULT 0,
  initiator_id       INTEGER REFERENCES members(id),
  initiator_unit_id  INTEGER REFERENCES org_units(id),
  parent_file_id     INTEGER REFERENCES files(id),
  line_no            TEXT,                          -- line-wise L1 label on a child PP file
  status             TEXT NOT NULL DEFAULT 'open',  -- open|closed
  provisioning_start TEXT,
  tendering_start    TEXT,
  created_at         TEXT NOT NULL,
  closed_at          TEXT
);

-- Notes N1..Nn on a file, each with a unique+connected reference/txn id.
CREATE TABLE IF NOT EXISTS notes (
  id             INTEGER PRIMARY KEY,
  file_pk        INTEGER NOT NULL REFERENCES files(id),
  seq            INTEGER NOT NULL,                  -- 1=N1, 2=N2 ...
  ref_no         TEXT NOT NULL,                     -- connected reference
  txn_id         TEXT NOT NULL UNIQUE,              -- unique transaction id
  title          TEXT NOT NULL,
  stage_id       TEXT,                              -- maps to ai/stages.py (provisioning, tec_req ...)
  source         TEXT NOT NULL DEFAULT 'manual',    -- ai|manual
  body           TEXT,
  classification TEXT NOT NULL DEFAULT 'normal',    -- normal|restricted|confidential|secret|top_secret
  status         TEXT NOT NULL DEFAULT 'draft',     -- draft|in_check|routed|approved|rejected|closed
  initiator_id   INTEGER REFERENCES members(id),
  custodian_id   INTEGER REFERENCES members(id),    -- who currently holds it
  decision       TEXT,                              -- approved|rejected
  decided_by     INTEGER REFERENCES members(id),
  created_at     TEXT NOT NULL,
  closed_at      TEXT
);

-- The dynamic routing chain (the fundamentally different, user-driven model).
CREATE TABLE IF NOT EXISTS routing_steps (
  id             INTEGER PRIMARY KEY,
  note_id        INTEGER NOT NULL REFERENCES notes(id),
  seq            INTEGER NOT NULL,
  from_member_id INTEGER REFERENCES members(id),
  to_member_id   INTEGER NOT NULL REFERENCES members(id),
  purpose        TEXT NOT NULL DEFAULT 'forward',   -- forward|check|approve
  state          TEXT NOT NULL DEFAULT 'sent',      -- sent|opened|actioned|sent_back|retracted
  action         TEXT,                              -- forward|send_back|approve|reject|concur
  comment        TEXT,
  sent_at        TEXT,
  opened_at      TEXT,                              -- NULL until receiver opens (gates retraction)
  actioned_at    TEXT
);

-- Clarification = a threaded side-window visible only to asker + initiator/asked member.
CREATE TABLE IF NOT EXISTS clarifications (
  id          INTEGER PRIMARY KEY,
  note_id     INTEGER NOT NULL REFERENCES notes(id),
  asked_by_id INTEGER NOT NULL REFERENCES members(id),
  asked_to_id INTEGER NOT NULL REFERENCES members(id),
  status      TEXT NOT NULL DEFAULT 'open',         -- open|answered
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clarification_messages (
  id               INTEGER PRIMARY KEY,
  clarification_id INTEGER NOT NULL REFERENCES clarifications(id),
  author_id        INTEGER NOT NULL REFERENCES members(id),
  body             TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

-- Typed attachments with per-type permissions (Phase 5).
CREATE TABLE IF NOT EXISTS attachments (
  id             INTEGER PRIMARY KEY,
  note_id        INTEGER NOT NULL REFERENCES notes(id),
  kind           TEXT NOT NULL,                     -- doc|stamping|dop|pm
  name           TEXT NOT NULL,
  ref            TEXT,                              -- reference string for dop/pm
  uploaded_by_id INTEGER REFERENCES members(id),
  created_at     TEXT NOT NULL
);

-- Need-to-know share links + anti-leak revocation (Phase 3).
CREATE TABLE IF NOT EXISTS access_grants (
  id            INTEGER PRIMARY KEY,
  note_id       INTEGER NOT NULL REFERENCES notes(id),
  token         TEXT NOT NULL UNIQUE,
  granted_by_id INTEGER NOT NULL REFERENCES members(id),
  granted_to_id INTEGER REFERENCES members(id),
  state         TEXT NOT NULL DEFAULT 'active',     -- active|revoked
  created_at    TEXT NOT NULL,
  revoked_at    TEXT,
  revoke_reason TEXT
);
CREATE TABLE IF NOT EXISTS access_alerts (
  id           INTEGER PRIMARY KEY,
  note_id      INTEGER NOT NULL REFERENCES notes(id),
  grant_id     INTEGER REFERENCES access_grants(id),
  custodian_id INTEGER REFERENCES members(id),
  offender_pb  TEXT,
  message      TEXT,
  created_at   TEXT NOT NULL
);

-- Per-member cabinet: closed files land here (Phase 2), retrievable by approver (Phase 2).
CREATE TABLE IF NOT EXISTS cabinet (
  id        INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id),
  file_pk   INTEGER NOT NULL REFERENCES files(id),
  reason    TEXT NOT NULL,                          -- initiator|router|approver
  placed_at TEXT NOT NULL
);
