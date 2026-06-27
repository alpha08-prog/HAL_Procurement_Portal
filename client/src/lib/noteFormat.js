// Turns AI-generated note prose into renderable blocks. The pipeline emits pipe-
// delimited rows (e.g. "M/s ABC | UDYAM-XX | Micro | NIC 12345") and occasional
// markdown tables; this groups consecutive pipe rows into table blocks so the UI can
// render real <table>s instead of raw text. Pure + dependency-free.

const SEP_CELL = /^:?-{2,}:?$/; // markdown header separator cell, e.g. --- or :--:

// Split a pipe line into trimmed cells, dropping the leading/trailing border cells.
function toCells(line) {
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length && parts[0] === '') parts.shift();
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

const isRowCandidate = (line) => line.includes('|') && toCells(line).filter(Boolean).length >= 2;
const isSeparatorRow = (cells) => cells.length > 0 && cells.every((c) => SEP_CELL.test(c));

// Build one table block from a run of consecutive pipe lines. A header is used ONLY
// when a markdown separator row is present — bidder blocks have none, so they stay
// headerless (otherwise the first data row would be mistaken for column headers).
function makeTable(lines) {
  const raw = lines.map(toCells);
  const sepIdx = raw.findIndex(isSeparatorRow);
  let header = null;
  let rows = raw;
  if (sepIdx > 0) {
    header = raw[sepIdx - 1];
    rows = raw.filter((_, i) => i !== sepIdx && i !== sepIdx - 1);
  }
  // Keep only real data rows — drop separators and any all-empty rows so an empty
  // markdown-table skeleton (header + --- with no data) never renders as a blank box.
  rows = rows.filter((r) => !isSeparatorRow(r) && r.some((c) => c !== ''));
  const width = Math.max(header ? header.length : 0, ...rows.map((r) => r.length), 0);
  const pad = (r) => Array.from({ length: width }, (_, i) => r[i] ?? '');
  return { type: 'table', header: header ? pad(header) : null, rows: rows.map(pad) };
}

// Inline cleanup mirroring ai/tools/pdf_writer.py:_clean — drop **bold** + leading #.
const cleanInline = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*#+\s*/, '').trim();

export function parseNote(text) {
  const blocks = [];
  const lines = String(text || '').split('\n').map((l) => l.replace(/\s+$/, ''));
  let run = [];
  const flush = () => {
    if (run.length) {
      const table = makeTable(run);
      if (table.rows.length) blocks.push(table); // skip empty / skeleton tables
    }
    run = [];
  };
  for (const line of lines) {
    if (isRowCandidate(line)) {
      run.push(line);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    if (/^\s*#+\s/.test(line)) blocks.push({ type: 'heading', text: cleanInline(line) });
    else blocks.push({ type: 'para', text: cleanInline(line) });
  }
  flush();
  return blocks;
}
