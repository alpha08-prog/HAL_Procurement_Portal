// Phase 7 — auto proposal-summary: a naive, deterministic condense of a note body so a
// member can skim instead of reading the whole note. Lead = first prose lines; facts =
// lines carrying money/percentages/statutory terms. No SLM — purely mechanical.
const KEY = /₹|%|\bL1\b|estimate|EMD|SD\b|PBG|indemnity|warranty|approval|CFA|DoP/i;

export function summarize(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('|'));
  return {
    lead: lines.slice(0, 2).join(' '),
    facts: lines.filter((l) => KEY.test(l)).slice(0, 5)
  };
}
