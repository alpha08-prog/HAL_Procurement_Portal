// Auto proposal-summary (email point 22): a deterministic condense so a member can skim a
// note instead of reading it in full. Structured header (subject / ids / stage / who holds
// it / value / classification) + a lead + the money/statutory fact lines. No SLM — purely
// mechanical. Bodies are HTML, so they are flattened to text first.
import { htmlToText } from './html.js';
import { stageTitle } from './stages.js';

const KEY = /₹|%|\bL1\b|estimate|EMD|SD\b|PBG|indemnity|warranty|approval|CFA|DoP/i;
const CLS = {
  normal: 'Normal', restricted: 'Restricted', confidential: 'Confidential',
  secret: 'Secret', top_secret: 'Top Secret'
};
const VALUE = /₹\s?[\d,]+(?:\.\d+)?(?:\s?(?:crore|lakh|cr|L))?/i;

export function summarize(note, file, custodian) {
  const text = htmlToText(note?.body_text || note?.body || '');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('|'));
  const value = (text.match(VALUE) || [])[0] || null;
  const meta = [
    ['Subject', note?.title],
    ['Reference', note?.ref_no],
    ['File ID', file?.file_id],
    ['Stage', note?.stage_id ? stageTitle(note.stage_id) : null],
    ['Classification', CLS[note?.classification] || note?.classification],
    ['Pending with', custodian?.name],
    ['Status', note?.status],
    ['Estimated value', value]
  ].filter(([, v]) => v);
  return {
    lead: lines.slice(0, 2).join(' '),
    meta,
    facts: lines.filter((l) => KEY.test(l)).slice(0, 6)
  };
}
