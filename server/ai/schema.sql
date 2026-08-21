-- Module F — AI-generated procurement cases walking the responsibility cascade.
--
-- The important design point: a case is SHARED, not a per-user session. One row here is
-- one procurement file, and `holding_agency` is custody — the file sits with either the
-- Indenting or the Tendering agency, and only signed-in users belonging to that agency
-- may raise the next note. Everyone else sees the same file read-only.
--
-- That mirrors how the paper process actually works: the file physically moves, and a
-- hand-over is an event worth recording (the sheet's row 23 is what forces it).
--
-- Its own SQLite file, same pattern as server/noting/schema.sql. Idempotent.

CREATE TABLE IF NOT EXISTS ai_cases (
  id              INTEGER PRIMARY KEY,
  case_ref        TEXT NOT NULL,                 -- MPR/CAR/SPR reference
  title           TEXT NOT NULL,
  source_case     TEXT NOT NULL DEFAULT 'nvb',   -- which case_input seeded the facts
  is_fixture      INTEGER NOT NULL DEFAULT 0,    -- seeded from fabricated data

  -- Where the file is in the cascade, and who holds it.
  node_id         TEXT NOT NULL,                 -- a key of cascadeGraph.CASCADE_NODES
  holding_agency  TEXT NOT NULL,                 -- Indenting | Tendering
  status          TEXT NOT NULL DEFAULT 'open',  -- open | closed
  closed_reason   TEXT,                          -- e.g. short_closure

  -- The accumulating case object (ai/case_object.py's shape), as JSON:
  -- data, deltas, generated, carryForward, formats, path, skipped, log.
  case_object     TEXT NOT NULL,

  handovers       INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_by_name TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  closed_at       TEXT
);

-- One row per note actually raised, with the position that raised it. Append-only.
CREATE TABLE IF NOT EXISTS ai_case_notes (
  id            INTEGER PRIMARY KEY,
  case_id       INTEGER NOT NULL REFERENCES ai_cases(id),
  seq           INTEGER NOT NULL,                -- 1, 2, 3 ... in the order raised
  stage_id      TEXT NOT NULL,                   -- provisioning | emd | tec_req ...
  note_title    TEXT NOT NULL,
  node_id       TEXT NOT NULL,                   -- the node it was raised at
  agency        TEXT NOT NULL,                   -- which agency raised it
  raised_by     TEXT,                            -- auth user id
  raised_by_name TEXT,
  raised_by_role TEXT,

  new_section   TEXT,                            -- what the model drafted for this note
  carry_from    TEXT,                            -- which note's prose was carried in
  carry_chars   INTEGER NOT NULL DEFAULT 0,
  full_output   TEXT,                            -- carry + new section, as it reads on file
  delta_keys    TEXT,                            -- JSON: the fields this note added
  formats_built TEXT,                            -- JSON: annexures produced here
  slm_ok        INTEGER NOT NULL DEFAULT 0,
  slm_error     TEXT,
  overridden    TEXT,                            -- the advisory rule ignored, if any
  created_at    TEXT NOT NULL
);

-- Hand-overs and other custody events, so the trail explains why a file moved.
CREATE TABLE IF NOT EXISTS ai_case_events (
  id          INTEGER PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES ai_cases(id),
  kind        TEXT NOT NULL,                     -- created | handover | note | closed | blocked
  from_agency TEXT,
  to_agency   TEXT,
  detail      TEXT,
  actor       TEXT,
  actor_name  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_notes_case ON ai_case_notes(case_id, seq);
CREATE INDEX IF NOT EXISTS idx_ai_events_case ON ai_case_events(case_id, id);
CREATE INDEX IF NOT EXISTS idx_ai_cases_custody ON ai_cases(holding_agency, status);
