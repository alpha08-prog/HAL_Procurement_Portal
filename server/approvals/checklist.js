// The Indentor Checklist as data, and the rule that makes it interesting:
// **the indentor's own answers decide who has to approve the file.**
//
// Nine of the 67 rows name an approving authority inside their own description text.
// Answer "yes" to short tendering and the Head of Division becomes mandatory. Answer
// "yes" to brand-specific procurement and a Committee does. The global-tender-exemption
// row reaches outside HAL entirely, to the Ministry. So there is no fixed approval
// ladder — the form builds the chain.
//
// Source of truth stays the client's workbook. server/approvals/seed/checklist.json is
// generated from it by ai/export_web.py (the server has no xlsx reader, the same reason
// server/contracts/seed/*.json exists). Each injection carries the sheet's own wording
// as `evidence`, so a screen can show the user WHY somebody was added by quoting the
// form they filled in.
//
// Mirrors ai/checklist.py.

import { readFileSync } from 'fs';

const SEED_URL = new URL('./seed/checklist.json', import.meta.url);

export const PROVISIONING = 'provisioning';
export const TENDER = 'tender';

let CACHE = null;

function seed() {
  if (!CACHE) CACHE = JSON.parse(readFileSync(SEED_URL, 'utf-8'));
  return CACHE;
}

export const rows = () => seed().rows;
export const counts = () => seed().counts;
export const materialClasses = () => seed().material_classes;
export const injections = () => seed().injections;
export const sourceNote = () => seed()._source;

export const block = (name) => rows().filter((r) => r.block === name);
export const find = (blockName, sl) =>
  rows().find((r) => r.block === blockName && r.sl === String(sl)) ?? null;
export const consumedBy = (key) => rows().filter((r) => r.consumed_by === key);
export const byCategory = (cat) =>
  rows().filter((r) => r.category === String(cat).toUpperCase());

// Answers that read as "not applicable / nothing sought here".
const NOT_APPLICABLE = new Set(['', 'NA', 'N/A', 'NIL', 'NO', 'NOT APPLICABLE', '-']);

// Does this answer read as a yes? The compliance column is a free-ish dropdown —
// "YES", "Yes", "YES-Included in MPR", "Yes-CPA is Level I", "Clause to be included in
// Tender T&C", "NA", "Composite", "Goods". Only an explicit yes counts.
export function isAffirmative(answer) {
  const t = String(answer ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (NOT_APPLICABLE.has(t)) return false;
  return t.startsWith('YES') || t === 'Y';
}

// The sheet's own filled-in column E, keyed "<block>:<sl>". The June-2026 revision
// ships a worked example, so a chain can be built with nothing hand-authored.
export const defaultAnswers = () => ({ ...seed().default_answers });

export const answerOf = (answers, blockName, sl) => answers?.[`${blockName}:${sl}`] ?? '';

// The DOP level the indentor recorded against provisioning sl 11 ("Yes-CPA is Level I").
// The value bands that would let this be *computed* are not in sampleData, so it stays a
// human-supplied fact — exactly how ai/rules.py treats it.
export function dopLevel(answers = null) {
  const a = answerOf(answers ?? defaultAnswers(), PROVISIONING, '11');
  const m = /LEVEL\s+([IVX]+)/.exec(String(a).toUpperCase());
  return m ? `Level ${m[1]}` : null;
}

// Which extra authorities this case's answers pull into the chain. Each result carries
// the row that caused it and the sheet's own wording.
export function injected(answers = null) {
  const ans = answers ?? defaultAnswers();
  const out = [];
  for (const spec of injections()) {
    const row = find(spec.block, spec.sl);
    if (!row) continue;
    const answer = answerOf(ans, spec.block, spec.sl);
    const yes = isAffirmative(answer);
    // sl 13 reads "Same requirement *not* Raised within Six Months", so a YES there
    // means compliant and needs nobody extra; anything else is a splitting risk.
    const fires = spec.trigger === 'affirmative' ? yes : !yes;
    if (!fires) continue;
    out.push({
      kind: spec.kind,
      authority: spec.authority,
      external: Boolean(spec.external),
      row: row.row,
      block: spec.block,
      sl: spec.sl,
      clause: row.clause,
      answer,
      trigger: spec.trigger,
      why: row.description || row.clause
    });
  }
  return out;
}

// Rows grouped for the intake form: the provisioning block, then the tender block, each
// carrying its category and what it feeds downstream so the screen can label them.
export function formSections() {
  return [
    {
      id: PROVISIONING,
      title: 'Provisioning file',
      hint: 'Becomes the Provisioning Note. Some answers here decide who must approve it.',
      rows: block(PROVISIONING)
    },
    {
      id: TENDER,
      title: 'Tender document clauses',
      hint: 'Becomes the Tender/RFQ. Column H of the sheet says which of these also feed '
        + 'the TEC Report and which feed the Commercial Evaluation.',
      rows: block(TENDER)
    }
  ];
}

// Which rows carry an authority, so the form can mark them before they are answered.
export function injectionIndex() {
  const idx = {};
  for (const spec of injections()) idx[`${spec.block}:${spec.sl}`] = spec;
  return idx;
}

export function summary() {
  const c = counts();
  return {
    ...c,
    materialClasses: materialClasses().length,
    injectionRows: injections().length,
    dopLevelFromDefaults: dopLevel(),
    source: sourceNote()
  };
}

export default {
  PROVISIONING, TENDER, rows, counts, block, find, consumedBy, byCategory,
  materialClasses, injections, injectionIndex, isAffirmative, defaultAnswers, answerOf,
  dopLevel, injected, formSections, summary, sourceNote
};
