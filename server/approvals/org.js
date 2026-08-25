// Grade-aware approver resolution over the HAL personnel directory.
//
// server/noting/dummy_employees.json is the 1,354-row personnel sheet
// (sampleData/Dummy HAL Database of Personnals.xlsx). The noting module already seeds
// org_units and members from it; this module answers the question the approval chain
// needs on top of that: given a named authority — "GM(AOD)", "AGM(Fin)", "the Head of
// Division" — WHO is that, in this division?
//
// Two things the sheet does not contain, and this module refuses to invent:
//
//   * No head-of-unit flag and no reporting line. headOf() returns the highest grade in
//     the unit AND every person tied with them, flagged `ambiguous`. 88 of 272
//     division-department pairs are ties, so the caller must handle it.
//   * No rank for CEO / SCH A / SCH B. BOARD_TIER places them above Executive Director;
//     that ordering is an assumption, marked as one.
//
// Mirrors ai/org.py so the two stay comparable — approvals.check.mjs asserts the same
// numbers the Python check does.

import { readFileSync } from 'fs';

const EMPLOYEES_URL = new URL('../noting/dummy_employees.json', import.meta.url);

// Grades with no numeric prefix. ASSUMPTION: board posts sit above ED (grade 10).
export const BOARD_TIER = { CEO: 11, 'SCH B': 12, 'SCH A': 13 };

// Department spellings that mean one unit. Upper-casing and collapsing whitespace
// already merges Mat PLg/Mat Plg, SHOP/Shop, FINANCE/Finance, MARKETING/Marketing and
// TRANSPORT/Transport; these three need naming.
export const DEPT_ALIASES = {
  FIN: 'FINANCE',
  'MANUFACTURING SHHOP': 'MANUFACTURING SHOP',
  'PROJECT PLG': 'PROJECT PLANNING'
};

// Designation token -> grade. Ordered longest-first: "GENERAL MANAGER" is a substring
// of both "ADDL GENERAL MANAGER" and "DY GENERAL MANAGER", and "MANAGER" of nearly
// everything.
const DESIG_GRADE = [
  [['EXECUTIVE DIRECTOR', 'ED'], 10],
  [['ADDITIONAL GENERAL MANAGER', 'ADDL GENERAL MANAGER', 'ADDL. GENERAL MANAGER', 'AGM'], 8],
  [['DEPUTY GENERAL MANAGER', 'DY GENERAL MANAGER', 'DY. GENERAL MANAGER', 'DGM'], 7],
  [['GENERAL MANAGER', 'GM'], 9],
  [['CHIEF MANAGER', 'CM'], 6],
  [['SENIOR MANAGER', 'SR MANAGER', 'SM'], 5],
  [['DEPUTY MANAGER', 'DY MANAGER', 'DM'], 3],
  [['MANAGER', 'MGR'], 4],
  [['ASSISTANT ENGINEER', 'ASST ENGINEER'], 1],
  [['ENGINEER', 'OFFICER'], 2]
];

export const GRADE_LABEL = {
  1: 'Assistant Engineer / Officer', 2: 'Engineer / Officer', 3: 'Deputy Manager',
  4: 'Manager', 5: 'Senior Manager', 6: 'Chief Manager', 7: 'Deputy General Manager',
  8: 'Additional General Manager', 9: 'General Manager', 10: 'Executive Director',
  11: 'CEO', 12: 'Schedule B', 13: 'Schedule A'
};

const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function normDept(s) {
  const t = squash(s).toUpperCase();
  return DEPT_ALIASES[t] ?? t;
}

// The numeric rank of a grade string. The sheet writes "<n> - <title>", with its own
// inconsistencies ("9 -  General Manager" double space, "Assistant Finance Office"
// missing its r), so only the numeric prefix is trusted.
export function gradeLevel(label) {
  const t = squash(label).toUpperCase();
  const m = /^(\d+)\s*-/.exec(t);
  if (m) return Number(m[1]);
  return BOARD_TIER[t] ?? null;
}

// Grade implied by a designation such as "GM(AOD)" -> 9.
export function desigLevel(designation) {
  if (!designation) return null;
  const bare = squash(String(designation).toUpperCase().replace(/\(.*?\)/g, ' '));
  const head = ` ${bare} `;
  for (const [tokens, level] of DESIG_GRADE) {
    for (const tok of tokens) if (head.includes(` ${tok} `)) return level;
  }
  return null;
}

// The unit named in parentheses: "AGM(IMM-OH)" -> "IMM-OH".
export function desigUnit(designation) {
  const m = /\((.*?)\)/.exec(String(designation ?? ''));
  return m ? squash(m[1]).toUpperCase() : '';
}

let CACHE = null;

export function load() {
  if (CACHE) return CACHE;
  const raw = JSON.parse(readFileSync(EMPLOYEES_URL, 'utf-8'));
  CACHE = raw.map((r) => {
    const grade = squash(r.grade);
    return {
      pb: squash(r.pb),
      name: squash(r.name),
      division: squash(r.division),
      deptRaw: squash(r.department),
      dept: normDept(r.department),
      grade,
      gradeLevel: gradeLevel(grade),
      designation: squash(r.designation),
      // How a person reads in a routing table.
      short: `${squash(r.name)} (${grade}) ${squash(r.department)} / ${squash(r.division)}`
    };
  });
  return CACHE;
}

export function divisions() {
  const seen = [];
  for (const p of load()) if (!seen.includes(p.division)) seen.push(p.division);
  return seen;
}

export function unitTree() {
  const tree = {};
  for (const p of load()) {
    tree[p.division] ??= new Set();
    tree[p.division].add(p.dept);
  }
  return Object.fromEntries(Object.entries(tree).map(([d, s]) => [d, [...s].sort()]));
}

export function people({ division, dept, minGrade, maxGrade } = {}) {
  const want = dept ? normDept(dept) : null;
  return load().filter((p) => {
    if (division && p.division !== division) return false;
    if (want && p.dept !== want) return false;
    if (minGrade != null && (p.gradeLevel ?? 0) < minGrade) return false;
    if (maxGrade != null && (p.gradeLevel ?? 0) > maxGrade) return false;
    return true;
  });
}

export const byPb = (pb) => load().find((p) => p.pb === String(pb)) ?? null;

const byPbAsc = (a, b) => (a.pb < b.pb ? -1 : a.pb > b.pb ? 1 : 0);

function resolution(winners, unit, extra = {}) {
  const c = [...winners].sort(byPbAsc);
  return {
    person: c.length === 1 ? c[0] : null,
    candidates: c,
    ambiguous: c.length > 1,
    unit,
    poolSize: c.length,
    widened: false,
    note: '',
    ...extra
  };
}

const EMPTY = (unit, note = '') => ({
  person: null, candidates: [], ambiguous: false, unit, poolSize: 0, widened: false, note
});

function topOf(pool) {
  if (!pool.length) return [];
  const top = Math.max(...pool.map((p) => p.gradeLevel ?? 0));
  return pool.filter((p) => (p.gradeLevel ?? 0) === top);
}

// Who heads a department. The sheet has no head column, so this is the highest grade in
// the unit — and when more than one person holds it the answer is genuinely unknown.
export function headOf(division, dept) {
  const pool = people({ division, dept });
  const r = resolution(topOf(pool), `${normDept(dept)} / ${division}`);
  r.poolSize = pool.length;
  return r;
}

// The senior-most person in a whole division — the checklist's "Head of Division".
export function headOfDivision(division) {
  const pool = people({ division });
  const r = resolution(topOf(pool), division);
  r.poolSize = pool.length;
  return r;
}

// A parenthesised unit hint mapped onto a department this division really has.
// "" when the hint names something that is not a department here — "AOD" is a
// *division* in the note texts, and the GM who signs for it sits in "GM office".
export function matchDept(hint, division) {
  const want = normDept(hint);
  if (!want) return '';
  const have = unitTree()[division] ?? [];
  if (have.includes(want)) return want;

  const toks = (s) => new Set(String(s).split(/[^A-Z0-9]+/).filter(Boolean));
  const mine = toks(want);
  // Same words, different order — "SEC & FIRE" is "FIRE & SEC".
  for (const d of [...have].sort()) {
    const t = toks(d);
    if (mine.size && t.size === mine.size && [...mine].every((x) => t.has(x))) return d;
  }
  const head = want.split(/[-/&,]/)[0].trim();
  for (const d of [...have].sort()) {
    if (head && (d === head || d.startsWith(head) || head.startsWith(d))) return d;
  }
  for (const d of [...have].sort()) {
    if ([...mine].some((x) => toks(d).has(x))) return d;
  }
  return '';
}

// Find the person behind a named authority such as "GM(AOD)" or "AGM(IMM-OH)".
// If the unit hint names a real department but nobody there holds that grade, the search
// widens to the division and SAYS SO — silently dropping the unit constraint would make
// the answer look better sourced than it is.
export function resolveAuthority(spec, division, dept = null) {
  const want = desigLevel(spec);
  const unit = matchDept(dept ?? desigUnit(spec), division);
  let pool = [];
  let widened = false;
  if (unit) pool = people({ division, dept: unit, minGrade: want, maxGrade: want });
  if (!pool.length) {
    widened = Boolean(unit);
    pool = people({ division, minGrade: want, maxGrade: want });
  }
  const r = resolution(topOf(pool), `${unit || 'any dept'} / ${division}`, {
    widened,
    sought: { designation: spec, gradeLevel: want }
  });
  r.poolSize = pool.length;
  return r;
}

// The next rung above someone — the section-check slot. Lowest grade strictly above
// theirs in the same department, so a Manager is checked by a Chief Manager rather than
// jumping to the AGM.
export function nextUp(person, withinDept = true) {
  if (!person || person.gradeLevel == null) return EMPTY('');
  const pool = people({
    division: person.division,
    dept: withinDept ? person.deptRaw : null,
    minGrade: person.gradeLevel + 1
  });
  const unit = `${person.dept}/${person.division}`;
  if (!pool.length) return EMPTY(unit);
  const step = Math.min(...pool.map((p) => p.gradeLevel ?? 99));
  const r = resolution(pool.filter((p) => p.gradeLevel === step), unit);
  r.poolSize = pool.length;
  return r;
}

// Resolve a slot INSIDE a department and never leave it. resolveAuthority widens to the
// division when the sought grade is absent, which is right for a named post like
// GM(AOD) but wrong for a functional concurrence — an AGM from HR is not the Finance
// concurrence. Tries each acceptable department name in order, then prefers the exact
// grade, then the lowest rung at or above minGrade, then that department's senior-most —
// saying so in `note` when it had to settle.
export function inDept(division, depts, { want = null, minGrade = null } = {}) {
  const names = Array.isArray(depts) ? depts : [depts];
  const tried = [];
  for (const d of names) {
    const pool = people({ division, dept: d });
    if (!pool.length) {
      tried.push(normDept(d));
      continue;
    }
    const unit = `${normDept(d)}/${division}`;
    if (want != null) {
      const exact = pool.filter((p) => p.gradeLevel === want);
      if (exact.length) return resolution(exact, unit);
    }
    if (minGrade != null) {
      const ok = pool.filter((p) => (p.gradeLevel ?? 0) >= minGrade);
      if (ok.length) {
        const step = Math.min(...ok.map((p) => p.gradeLevel));
        return resolution(ok.filter((p) => p.gradeLevel === step), unit);
      }
    }
    const top = Math.max(...pool.map((p) => p.gradeLevel ?? 0));
    const sought = want ?? minGrade;
    return resolution(pool.filter((p) => (p.gradeLevel ?? 0) === top), unit, {
      note: `no grade-${sought} post in ${normDept(d)}; took its senior-most (grade ${top})`
    });
  }
  return EMPTY(`${tried.join(' / ')} in ${division}`,
    `none of ${tried.join(', ')} exists in ${division}`);
}

// Collapse a resolution to one person. Returns { person, chose } where `chose` is true
// when the tie was broken HERE rather than by the data — callers must record that,
// because it is a guess, not a fact.
export function pick(res, preferPb = null) {
  if (res?.person) return { person: res.person, chose: false };
  const c = res?.candidates ?? [];
  if (!c.length) return { person: null, chose: false };
  if (preferPb) {
    const hit = c.find((p) => p.pb === String(preferPb));
    if (hit) return { person: hit, chose: false };
  }
  return { person: c[0], chose: true };
}

// Everything about a resolution that is weaker than a fact.
export function caveatsOf(res, chose) {
  const out = [];
  if (chose) out.push('tie broken here, not by the data');
  if (res?.widened) out.push(`no such post in ${res.unit}; widened to the division`);
  if (res?.note) out.push(res.note);
  return out;
}

export function summary() {
  const ppl = load();
  const tree = unitTree();
  return {
    people: ppl.length,
    units: Object.keys(tree).length,
    deptsRaw: new Set(ppl.map((p) => p.deptRaw)).size,
    deptsCanonical: new Set(ppl.map((p) => p.dept)).size,
    gradeLabels: new Set(ppl.map((p) => p.grade)).size,
    ambiguousHeads: Object.entries(tree)
      .flatMap(([d, ds]) => ds.map((x) => headOf(d, x)))
      .filter((r) => r.ambiguous).length,
    unitDeptPairs: Object.values(tree).reduce((n, ds) => n + ds.length, 0)
  };
}

export default {
  load, divisions, unitTree, people, byPb, headOf, headOfDivision, matchDept,
  resolveAuthority, nextUp, inDept, pick, caveatsOf, gradeLevel, desigLevel, desigUnit,
  normDept, summary, GRADE_LABEL
};
