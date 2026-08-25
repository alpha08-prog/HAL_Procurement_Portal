// Shared procurement cases walking the cascade — many users, one file, custody enforced.
//
// The case object is stored as JSON and rehydrated on every read, so the notes table and
// the accumulated prose can never disagree: the notes rows are the audit trail, the JSON
// is the working document, and both are written in the same call.

import * as access from './access.js';
import * as graph from './cascadeGraph.js';
import { all, get, nowStamp, run } from './db.js';
import * as loadInputs from './loadInputs.js';
import * as pipeline from './pipeline.js';
import * as rules from './rules.js';
import { ALL_STAGES } from './stages.js';

const J = (v) => JSON.stringify(v ?? null);
const P = (v, f = null) => { try { return v == null ? f : JSON.parse(v); } catch { return f; } };

// -- creating -----------------------------------------------------------------
export function createCase({ caseRef, title, sourceCase = 'nvb', user }) {
  const facts = loadInputs.loadCase(sourceCase);
  const kase = pipeline.newCase();
  const stamp = nowStamp();

  const r = run(
    `INSERT INTO ai_cases
       (case_ref, title, source_case, is_fixture, node_id, holding_agency, status,
        case_object, handovers, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, 0, ?, ?, ?, ?)`,
    caseRef ?? facts.requisition?.car_no ?? '(no ref)',
    title ?? facts.requisition?.item_description ?? 'Procurement case',
    sourceCase, facts._fixture ? 1 : 0,
    graph.START, graph.CASCADE_NODES[graph.START].owner,
    J(kase), user?.id ?? null, user?.name ?? null, stamp, stamp
  );
  const id = Number(r.lastInsertRowid);
  event(id, 'created', {
    detail: `Case opened from ${facts._caseLabel}`,
    toAgency: graph.CASCADE_NODES[graph.START].owner, user
  });
  return loadCase(id, user);
}

function event(caseId, kind, { fromAgency = null, toAgency = null, detail = '', user = null } = {}) {
  run(
    `INSERT INTO ai_case_events (case_id, kind, from_agency, to_agency, detail, actor, actor_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    caseId, kind, fromAgency, toAgency, detail, user?.id ?? null, user?.name ?? null, nowStamp()
  );
}

// -- reading ------------------------------------------------------------------

// The options the sheet allows at this node, each annotated with whether a rules.js
// predicate advises it. Advisory only: every edge stays selectable.
function optionsAt(nodeId, data) {
  const node = graph.CASCADE_NODES[nodeId];
  if (!node) return [];
  return node.options.map((o) => {
    const meta = graph.STAGE_META[o.noteId] ?? {};
    let advice = null;
    if (o.recommend) {
      const r = rules.evaluate(o.recommend, data);
      advice = {
        rule: o.recommend,
        advised: r.value === true,
        undecided: r.undecided,
        missing: r.missing,
        note: r.undecided
          ? `${o.recommend}() cannot be judged yet — ${r.missing.join(', ')} not on file`
          : `${o.recommend}() = ${r.value}`
      };
    }
    return {
      noteId: o.noteId,
      label: o.label,
      next: o.next,
      terminal: o.next === null,
      title: meta.title ?? o.noteId,
      phase: meta.phase,
      needBased: Boolean(meta.needBased),
      formats: meta.formats ?? [],
      advice
    };
  });
}

// Block 3's "Required for", checked before a note is raised. Warn only — a format owned by
// the other agency is exactly the hand-over the sheet models.
function prereqWarnings(noteId, formatsOnFile) {
  const own = new Set(graph.STAGE_META[noteId]?.formats ?? []);
  return (graph.PREREQ_FORMATS[noteId] ?? [])
    .filter((p) => !formatsOnFile[p.id] && !own.has(p.id))
    .map((p) => ({
      id: p.id,
      title: graph.FORMAT_TITLE[p.id] ?? p.id,
      owner: graph.FORMAT_OWNER[p.id] ?? '?',
      required: p.required
    }));
}

export function loadCase(id, user = null) {
  const row = get('SELECT * FROM ai_cases WHERE id = ?', id);
  if (!row) return null;

  const kase = P(row.case_object, pipeline.newCase());
  const notes = all('SELECT * FROM ai_case_notes WHERE case_id = ? ORDER BY seq', id).map((n) => ({
    seq: n.seq, stageId: n.stage_id, title: n.note_title, nodeId: n.node_id,
    agency: n.agency, raisedByName: n.raised_by_name, raisedByRole: n.raised_by_role,
    newSection: n.new_section, carryFrom: n.carry_from, carryChars: n.carry_chars,
    fullOutput: n.full_output, deltaKeys: P(n.delta_keys, []),
    formatsBuilt: P(n.formats_built, []), slmOk: Boolean(n.slm_ok), slmError: n.slm_error,
    overridden: n.overridden, createdAt: n.created_at
  }));
  const events = all('SELECT * FROM ai_case_events WHERE case_id = ? ORDER BY id', id).map((e) => ({
    kind: e.kind, fromAgency: e.from_agency, toAgency: e.to_agency, detail: e.detail,
    actorName: e.actor_name, createdAt: e.created_at
  }));

  const node = graph.CASCADE_NODES[row.node_id] ?? null;
  const base = {
    id: row.id,
    caseRef: row.case_ref,
    title: row.title,
    sourceCase: row.source_case,
    isFixture: Boolean(row.is_fixture),
    nodeId: row.node_id,
    node: node && {
      id: row.node_id, stageNo: node.stageNo, owner: node.owner, title: node.title,
      description: node.description ?? null, checklist: Boolean(node.checklist)
    },
    holdingAgency: row.holding_agency,
    status: row.status,
    closedReason: row.closed_reason,
    handovers: row.handovers,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes,
    events,
    formatsOnFile: Object.entries(kase.formats ?? {}).map(([fid, f]) => ({
      id: fid, title: f.format ?? fid, owner: graph.FORMAT_OWNER[fid] ?? null, fields: f
    })),
    path: kase.path ?? [],
    skipped: kase.skipped ?? [],
    data: kase.data ?? {},
    options: row.status === 'closed' ? [] : optionsAt(row.node_id, kase.data ?? {}),
    responsibilitySplit: (kase.path ?? []).reduce((acc, sid) => {
      const a = graph.STAGE_META[sid]?.agency ?? '?';
      acc[a] = (acc[a] ?? 0) + 1;
      return acc;
    }, {})
  };
  base.permissions = access.permissions(user, base, node?.owner ?? null);
  return base;
}

export function listCases(user = null) {
  const rows = all(
    `SELECT c.id, c.case_ref, c.title, c.node_id, c.holding_agency, c.status,
            c.is_fixture, c.handovers, c.created_by_name, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM ai_case_notes n WHERE n.case_id = c.id) AS notes,
            (SELECT stage_id FROM ai_case_notes n WHERE n.case_id = c.id ORDER BY seq DESC LIMIT 1) AS last_stage
     FROM ai_cases c ORDER BY c.id DESC`
  );
  const mine = access.agenciesFor(user?.role);
  return rows.map((r) => ({
    id: r.id,
    caseRef: r.case_ref,
    title: r.title,
    nodeId: r.node_id,
    nodeTitle: graph.CASCADE_NODES[r.node_id]?.title ?? r.node_id,
    stageNo: graph.CASCADE_NODES[r.node_id]?.stageNo ?? null,
    holdingAgency: r.holding_agency,
    status: r.status,
    isFixture: Boolean(r.is_fixture),
    handovers: r.handovers,
    notes: r.notes,
    lastNote: r.last_stage ? (graph.STAGE_META[r.last_stage]?.title ?? r.last_stage) : null,
    createdByName: r.created_by_name,
    updatedAt: r.updated_at,
    // The whole point of the list: is this one waiting on me?
    withMe: r.status === 'open' && mine.includes(r.holding_agency),
    actionable: r.status === 'open' && mine.includes(r.holding_agency)
  }));
}

// The editable form for a note, pre-filled from the case facts where known.
export function noteForm(id, noteId) {
  const row = get('SELECT * FROM ai_cases WHERE id = ?', id);
  if (!row) return { ok: false, error: 'No such case' };
  if (!ALL_STAGES[noteId]) return { ok: false, error: `Unknown note "${noteId}"` };
  const kase = P(row.case_object, pipeline.newCase());
  const seeded = loadInputs.toStageInputs(loadInputs.loadCase(row.source_case))[noteId] ?? {};
  const cfg = ALL_STAGES[noteId];
  return {
    ok: true,
    noteId,
    title: graph.STAGE_META[noteId]?.title ?? cfg.note,
    phase: cfg.phase,
    agency: cfg.resp,
    carryFrom: cfg.carry,
    conditional: cfg.cond,
    formats: cfg.formats,
    fields: pipeline.fieldsFor(noteId, seeded, kase.data ?? {}),
    prereqWarnings: prereqWarnings(noteId, kase.formats ?? {}),
    hint: 'Fields are pre-filled from the case facts. Semicolons separate list items. '
      + 'Only these fields are sent to the language model — the carried-forward prose and '
      + 'the annexure tables are assembled in code.'
  };
}

// -- acting -------------------------------------------------------------------

// Raise a note. Enforces custody (the sheet's row 23) and the node's option list before
// anything is generated, so a refusal costs nothing.
export async function raiseNote(id, noteId, { fields = {}, override = false, user }) {
  const row = get('SELECT * FROM ai_cases WHERE id = ?', id);
  if (!row) return { ok: false, code: 404, error: 'No such case' };
  if (row.status === 'closed') {
    return { ok: false, code: 422, error: 'The file is closed — no further action on this requisition.' };
  }

  const node = graph.CASCADE_NODES[row.node_id];
  const option = graph.optionAt(row.node_id, noteId);
  if (!option) {
    return {
      ok: false, code: 422,
      error: `The sheet does not allow a ${graph.STAGE_META[noteId]?.title ?? noteId} at `
        + `"${node?.title ?? row.node_id}". Allowed here: `
        + `${node.options.map((o) => o.label).join(', ')}.`
    };
  }

  // Custody — this is the hard one, from row 23 "Note Can only be Generated by".
  if (!access.canActAs(user?.role, row.holding_agency)) {
    return {
      ok: false, code: 403,
      error: `This note can only be raised by the ${row.holding_agency} Agency. `
        + `Your position (${access.ROLE_LABEL[user?.role] ?? user?.role}) acts for `
        + `${access.agenciesFor(user?.role).join(' / ') || 'no agency'}. The file must be handed over first.`
    };
  }
  if (node.owner !== row.holding_agency) {
    return {
      ok: false, code: 409,
      error: `The file is with ${row.holding_agency} but this stage belongs to ${node.owner}. Hand it over first.`
    };
  }

  // Advisory rules. Overridable, but the override is recorded on the note.
  let overridden = null;
  const advised = node.options.filter((o) => {
    if (!o.recommend) return false;
    const kaseData = P(row.case_object, {}).data ?? {};
    return rules.evaluate(o.recommend, kaseData).value === true;
  });
  if (advised.length && !advised.some((o) => o.noteId === noteId)) {
    const names = advised.map((o) => `${o.label} (${o.recommend})`).join(', ');
    if (!override) {
      return {
        ok: false, code: 428,
        error: `The rules advise ${names} at this stage. Raise ${option.label} anyway?`,
        needsOverride: true, advised: names
      };
    }
    overridden = names;
  }

  // Generate for real: annexures in code, prose from the model, prior note carried in.
  const kase = P(row.case_object, pipeline.newCase());
  const seeded = loadInputs.toStageInputs(loadInputs.loadCase(row.source_case))[noteId] ?? {};
  const input = { ...seeded, ...pipeline.parseFields(noteId, fields) };
  const out = await pipeline.runStage(kase, noteId, input);
  if (!out.ok) return { ok: false, code: 422, error: out.error };

  const stamp = nowStamp();

  if (out.skipped) {
    run('UPDATE ai_cases SET case_object = ?, updated_at = ? WHERE id = ?', J(kase), stamp, id);
    event(id, 'blocked', {
      detail: `${option.label} skipped — ${out.branch?.rule}() = false`, user
    });
    return { ok: true, skipped: true, branch: out.branch, kase: loadCase(id, user) };
  }

  const seq = (get('SELECT COUNT(*) AS c FROM ai_case_notes WHERE case_id = ?', id)?.c ?? 0) + 1;
  run(
    `INSERT INTO ai_case_notes
       (case_id, seq, stage_id, note_title, node_id, agency, raised_by, raised_by_name,
        raised_by_role, new_section, carry_from, carry_chars, full_output, delta_keys,
        formats_built, slm_ok, slm_error, overridden, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, seq, noteId, graph.STAGE_META[noteId]?.title ?? out.note, row.node_id,
    row.holding_agency, user?.id ?? null, user?.name ?? null, user?.role ?? null,
    out.newSection, out.carryFrom, out.carryChars, out.fullOutput,
    J(out.deltaKeys), J(out.formatsBuilt), out.slm.ok ? 1 : 0, out.slm.error,
    overridden, stamp
  );

  // Advance the file. A terminal option closes it.
  const terminal = option.next === null;
  const nextNode = terminal ? row.node_id : option.next;
  const nextOwner = terminal ? row.holding_agency : graph.CASCADE_NODES[nextNode].owner;

  run(
    `UPDATE ai_cases SET case_object = ?, node_id = ?, status = ?, closed_reason = ?,
       updated_at = ?, closed_at = ? WHERE id = ?`,
    J(kase), nextNode, terminal ? 'closed' : 'open', terminal ? noteId : null,
    stamp, terminal ? stamp : null, id
  );

  event(id, 'note', {
    fromAgency: row.holding_agency, detail: `${option.label} raised`, user
  });
  if (terminal) {
    event(id, 'closed', { detail: graph.SHORT_CLOSURE_MESSAGE, user });
  }

  const loaded = loadCase(id, user);
  return {
    ok: true,
    skipped: false,
    result: {
      noteId, title: out.note, newSection: out.newSection, fullOutput: out.fullOutput,
      carryFrom: out.carryFrom, carryChars: out.carryChars, deltaKeys: out.deltaKeys,
      promptChars: out.promptChars, formatsBuilt: out.formatsBuilt,
      annexureNames: out.annexureNames, slm: out.slm, overridden
    },
    handoverNeeded: !terminal && nextOwner !== row.holding_agency ? nextOwner : null,
    kase: loaded
  };
}

// Take the file across. Only a position from the other agency may pull it — that is the
// hand-over the sheet forces when the next note is not yours.
export function handOver(id, { user, toAgency = null }) {
  const row = get('SELECT * FROM ai_cases WHERE id = ?', id);
  if (!row) return { ok: false, code: 404, error: 'No such case' };
  if (row.status === 'closed') return { ok: false, code: 422, error: 'The file is closed.' };

  const mine = access.agenciesFor(user?.role);
  if (!mine.length) {
    return {
      ok: false, code: 403,
      error: `${access.ROLE_LABEL[user?.role] ?? user?.role} is a downstream position and cannot take custody of a procurement file.`
    };
  }
  const target = toAgency ?? (mine.includes(graph.otherAgency(row.holding_agency))
    ? graph.otherAgency(row.holding_agency)
    : mine[0]);

  if (target === row.holding_agency) {
    return { ok: false, code: 422, error: `The file is already with the ${target} Agency.` };
  }
  if (!mine.includes(target)) {
    return { ok: false, code: 403, error: `Your position cannot act for the ${target} Agency.` };
  }

  run('UPDATE ai_cases SET holding_agency = ?, handovers = handovers + 1, updated_at = ? WHERE id = ?',
    target, nowStamp(), id);
  event(id, 'handover', {
    fromAgency: row.holding_agency, toAgency: target,
    detail: `File taken over by the ${target} Agency`, user
  });
  return { ok: true, kase: loadCase(id, user) };
}

export default {
  createCase, loadCase, listCases, noteForm, raiseNote, handOver
};
