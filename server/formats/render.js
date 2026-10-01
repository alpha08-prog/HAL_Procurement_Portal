// Renders a library format into display blocks. The client only draws what comes back:
// every {{key}} is substituted here, every rupee figure is computed here (server/ai/rules.js
// for SD/PBG/indemnity, server/lib/amountWords.js for words), and the STC list for a tender
// document comes from the Contract Clauses Matrix (server/contracts/matrix.js).
//
// Field resolution, per field in declaration order:
//   computed  → always computed (never overridable — money is not a user input)
//   input     → the caller's `fields[key]`
//   from      → first non-blank of the context path(s): contract.*, po.*, vendor.*, rv.*, user.*
//   default   → literal
// A field that ends blank is listed in `missing` and prints as a rule line (BLANK).
import { sd, pbg, indemnity } from '../ai/rules.js';
import { amountInWords } from '../lib/amountWords.js';
import { getFormat } from './library.js';
import { clausesForType } from '../contracts/matrix.js';

export const BLANK = '__________';
const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const dig = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fromCtx = (spec, ctx) => {
  for (const p of [].concat(spec)) {
    const v = dig(ctx, p);
    if (!isBlank(v)) return v;
  }
  return undefined;
};

const FN = {
  sd: (v) => sd(v),
  pbg: (v) => pbg(v),
  indemnity: (v) => indemnity(v),
  words: (v) => (isBlank(v) || !Number.isFinite(Number(v)) ? '' : amountInWords(Number(v))),
  today: () => new Date().toISOString().slice(0, 10)
};
export const COMPUTED_FNS = Object.keys(FN);

export function compute(spec, values) {
  const [fn, arg] = String(spec).split(':');
  const f = FN[fn];
  if (!f) throw new Error(`Unknown computed function "${fn}"`);
  const v = f(arg ? values[arg] : undefined);
  return v == null ? '' : v;
}

export function resolveFields(format, input = {}, ctx = {}) {
  const values = {};
  const sources = {};
  const missing = [];
  for (const f of format.fields) {
    let v;
    let s;
    if (f.computed) {
      v = compute(f.computed, values);
      s = 'computed';
    } else {
      v = input[f.key];
      s = 'input';
      if (isBlank(v) && f.from) { v = fromCtx(f.from, ctx); s = 'context'; }
      if (isBlank(v) && f.default != null) { v = f.default; s = 'default'; }
    }
    if (isBlank(v)) {
      v = '';
      s = null;
      missing.push(f.key);
    } else if (f.type === 'money' || f.type === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) v = n;
    }
    values[f.key] = v;
    sources[f.key] = s;
  }
  return { values, sources, missing };
}

function display(f, v) {
  if (isBlank(v)) return BLANK;
  if (f.type === 'money') return typeof v === 'number' ? `₹ ${inr.format(v)}` : String(v);
  if (f.type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
  }
  if (Array.isArray(v)) return v.join('\n');
  return String(v);
}

const linesOf = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (isBlank(v)) return [];
  return String(v).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
};
const padRow = (cells, n) => {
  const out = cells.slice(0, n);
  while (out.length < n) out.push('');
  return out;
};
const keyOf = (tpl) => {
  const m = /^\{\{([a-z0-9_]+)\}\}$/.exec(String(tpl ?? '').trim());
  return m ? m[1] : null;
};

function safePlan(typeId) {
  try {
    return clausesForType(typeId);
  } catch {
    return { auto: [], offered: [], excluded: [] };
  }
}

function renderBlock(b, sub, values) {
  switch (b.type) {
    case 'heading':
    case 'para':
    case 'note':
      return { type: b.type, text: sub(b.text) };
    case 'list': {
      const items = b.itemsFrom ? linesOf(values[b.itemsFrom]) : (b.items ?? []).map(sub);
      return { type: 'list', title: b.title ? sub(b.title) : null, ordered: Boolean(b.ordered), items, empty: Boolean(b.itemsFrom) && items.length === 0 };
    }
    case 'fields':
      return {
        type: 'fields',
        rows: b.rows.map(([label, tpl, hint]) => {
          const key = keyOf(tpl);
          return { label: sub(label), value: sub(tpl), hint: hint ? sub(hint) : null, key, missing: key ? isBlank(values[key]) : false };
        })
      };
    case 'table': {
      const n = b.columns ?? (b.header ?? []).length;
      const rows = b.rowsFrom
        ? linesOf(values[b.rowsFrom]).map((l) => padRow(l.split('|').map((s) => s.trim()), n))
        : (b.rows ?? []).map((r) => r.map(sub));
      return { type: 'table', title: b.title ? sub(b.title) : null, header: (b.header ?? []).map(sub), rows, empty: rows.length === 0 };
    }
    case 'signature':
      return { type: 'signature', parties: b.parties.map((p) => ({ label: sub(p.label), lines: (p.lines ?? []).map(sub) })) };
    case 'stc': {
      const typeId = sub(b.contractType);
      const plan = safePlan(typeId);
      return {
        type: 'list',
        title: `Standard Terms & Conditions auto-applicable to contract type "${typeId}" (Contract Clauses Matrix)`,
        ordered: true,
        items: plan.auto.map((c) => `${c.clauseNo ?? '—'}. ${c.title}`),
        empty: plan.auto.length === 0,
        note: plan.offered?.length ? `Offered case-by-case for this type: ${plan.offered.map((c) => c.title).join('; ')}.` : null
      };
    }
    case 'enclosures':
      return {
        type: 'list',
        title: null,
        ordered: true,
        items: b.ids.map((id) => {
          const f = getFormat(id);
          return f ? `${f.code} — ${f.title}${f.verified ? '' : ' (template pending from HAL)'}` : id;
        }),
        empty: false
      };
    default:
      return { type: 'para', text: `[unknown block type "${b.type}"]` };
  }
}

export function render(idOrFormat, input = {}, ctx = {}) {
  const format = typeof idOrFormat === 'string' ? getFormat(idOrFormat) : idOrFormat;
  if (!format) {
    const e = new Error(`Unknown format "${idOrFormat}"`);
    e.status = 404;
    throw e;
  }
  const { values, sources, missing } = resolveFields(format, input ?? {}, ctx ?? {});
  const disp = Object.fromEntries(format.fields.map((f) => [f.key, display(f, values[f.key])]));
  const sub = (s) => String(s ?? '').replace(/\{\{([a-z0-9_]+)\}\}/g, (_, k) => disp[k] ?? BLANK);
  return {
    id: format.id,
    code: format.code,
    title: format.title,
    kind: format.kind,
    category: format.category,
    verified: Boolean(format.verified),
    source: format.source ?? null,
    note: format.note ?? null,
    contractAnnex: Boolean(format.contractAnnex),
    fields: format.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      options: f.options ?? null,
      computed: Boolean(f.computed),
      value: values[f.key],
      display: disp[f.key],
      source: sources[f.key]
    })),
    values,
    missing,
    blocks: format.body.map((b) => renderBlock(b, sub, values)),
    renderedAt: new Date().toISOString()
  };
}
