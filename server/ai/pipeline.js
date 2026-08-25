// Running one note — a port of ai/pipeline.py's run_stage().
//
// Seven steps, in this order, and the order is the whole design:
//
//   1 ingest      the entered/seeded fields land in case.data
//   2 branch      if the note is conditional, ask rules.js — and record the answer
//   3 formats     build the deterministic annexures from case.data
//   4 delta       take ONLY the fields this note declares as new
//   5 carry       fetch the prior note's full prose (NOT sent to the model)
//   6 draft       the model sees the delta + annexure NAMES, nothing else
//   7 store       generated + carry_forward + formats + path
//
// Step 5 is what makes the whole thing cheap and exact. Each later note is ~80% a copy of
// the one before it; that 80% is moved in code, so the prompt stays small and no figure
// can be re-hallucinated on the way through.

import * as formats from './formats.js';
import * as rules from './rules.js';
import * as slm from './slm.js';
import { ALL_STAGES } from './stages.js';

const clean = (v) => v != null && v !== '' && !(Array.isArray(v) && !v.length)
  && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

// A fresh case object. Mirrors ai/case_object.py.
export const newCase = () => ({
  data: {}, deltas: {}, generated: {}, carryForward: {}, formats: {},
  path: [], skipped: [], log: []
});

export const fullOutput = (kase, stageId) => {
  const cf = kase.carryForward[stageId] ?? '';
  const gen = kase.generated[stageId] ?? '';
  return cf ? `${cf}\n\n${gen}`.trim() : String(gen).trim();
};

const deltaOf = (stageId, data) => {
  const out = {};
  for (const k of ALL_STAGES[stageId]?.neu ?? []) if (clean(data[k])) out[k] = data[k];
  return out;
};

// Execute one note. Returns { ok, skipped, stageId, delta, carry, generated, formats, ... }
// and never throws for an unavailable model — the note is still produced, with the drafted
// section marked so the UI can show it plainly.
export async function runStage(kase, stageId, input = {}, { maxTokens = 800 } = {}) {
  const cfg = ALL_STAGES[stageId];
  if (!cfg) return { ok: false, error: `Unknown note "${stageId}"` };

  // 1 — ingest
  kase.deltas[stageId] = input ?? {};
  for (const [k, v] of Object.entries(input ?? {})) if (v != null) kase.data[k] = v;

  // 2 — branch. Conditional notes ask rules.js; the answer is recorded either way.
  let branch = null;
  if (cfg.cond) {
    const r = rules.evaluate(cfg.cond, kase.data);
    branch = { rule: cfg.cond, ...r };
    if (!r.undecided && r.value === false) {
      kase.skipped.push(stageId);
      kase.log.push({ stageId, event: 'skipped', detail: `${cfg.cond}() = false` });
      return { ok: true, skipped: true, stageId, branch, note: cfg.note };
    }
  }

  // 3 — deterministic annexures
  const built = [];
  for (const fid of cfg.formats ?? []) {
    kase.formats[fid] = formats.build(fid, kase.data);
    built.push(fid);
  }

  // 4 — the delta: only what this note genuinely adds
  const delta = deltaOf(stageId, kase.data);

  // 5 — carry-forward. '$last' means the most recently raised note, since the need-based
  // ones are reached out of order. A skipped predecessor falls back to the last raised.
  let carry = '';
  let carrySrc = null;
  if (cfg.carry === '$last') {
    carrySrc = kase.path.length ? kase.path[kase.path.length - 1] : null;
    carry = carrySrc ? fullOutput(kase, carrySrc) : '';
  } else if (cfg.carry) {
    carrySrc = kase.skipped.includes(cfg.carry)
      ? (kase.path.length ? kase.path[kase.path.length - 1] : null)
      : cfg.carry;
    carry = carrySrc ? fullOutput(kase, carrySrc) : '';
  }

  // 6 — draft. The model receives the delta and the annexure NAMES. Never the tables,
  // never the carried prose.
  const refNames = cfg.ref ? Object.values(kase.formats).map((f) => f.format).filter(Boolean) : [];
  const prompt = slm.buildPrompt(stageId, delta, refNames);
  let drafted = { text: '', ok: false, error: `no prompt defined for "${stageId}"` };
  if (prompt) drafted = await slm.generate(prompt, { maxTokens });

  // 7 — store
  kase.generated[stageId] = drafted.text;
  kase.carryForward[stageId] = carry;
  kase.path.push(stageId);
  kase.log.push({
    stageId, event: 'raised', deltaKeys: Object.keys(delta), formats: built,
    carryFrom: carrySrc, carryChars: carry.length, slmOk: drafted.ok
  });

  return {
    ok: true,
    skipped: false,
    stageId,
    note: cfg.note,
    branch,
    delta,
    deltaKeys: Object.keys(delta),
    formatsBuilt: built.map((fid) => ({ id: fid, ...kase.formats[fid] })),
    annexureNames: refNames,
    carryFrom: carrySrc,
    carryChars: carry.length,
    promptChars: prompt ? prompt.length : 0,
    newSection: drafted.text,
    slm: { ok: drafted.ok, error: drafted.error, model: slm.MODEL },
    fullOutput: fullOutput(kase, stageId)
  };
}

// The fields a note needs, pre-filled from the case where known, so a screen can render
// an editable form rather than demanding everything be typed.
export function fieldsFor(stageId, seeded = {}, data = {}) {
  const cfg = ALL_STAGES[stageId];
  if (!cfg) return [];
  return (cfg.neu ?? []).map((key) => {
    const v = seeded[key] ?? data[key] ?? '';
    return {
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      value: Array.isArray(v) ? v.join('; ') : (v ?? ''),
      list: Array.isArray(v) || Array.isArray(seeded[key]),
      seeded: clean(seeded[key])
    };
  });
}

// Turn the form back into typed values: fields declared as lists split on ';'.
export function parseFields(stageId, submitted = {}) {
  const cfg = ALL_STAGES[stageId];
  const out = {};
  for (const key of cfg?.neu ?? []) {
    const raw = submitted[key];
    if (raw == null || raw === '') continue;
    out[key] = typeof raw === 'string' && raw.includes(';')
      ? raw.split(';').map((s) => s.trim()).filter(Boolean)
      : raw;
  }
  return out;
}

export default { newCase, fullOutput, runStage, fieldsFor, parseFields };
