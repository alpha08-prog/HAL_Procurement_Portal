import { useEffect, useState } from 'react';
import { formatAmount } from '../../lib/currency.js';
import { priceEstimate } from '../../lib/toolsApi.js';

// PRV-06 pre-tender price estimate. All arithmetic is POST /api/requisitions/estimate
// (server/requisitions/estimate.js); this component only collects inputs and draws lines.
const DEFAULTS = { basis: 'LPP', reference: '', qty: 5, unitRate: 270180, escalationPct: 5, gstPct: 18, freight: 15000 };
const BASES = [
  ['LPP', 'Last Purchase Price (LPP)'],
  ['BQ', 'Budgetary quotations (min 3)'],
  ['GEM', 'GeM portal indicative rate'],
  ['INHOUSE', 'In-house cost estimate']
];

export default function PriceEstimator() {
  const [form, setForm] = useState(DEFAULTS);
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const compute = async (f = form) => {
    setBusy(true);
    setError(null);
    try {
      setOut(await priceEstimate(f));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    compute(DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>PRICE ESTIMATION SHEET (PRE-TENDER)</strong>
        <span>server-computed · {out ? out.basisLabel : ''}</span>
      </div>
      <div className="ld-calc-grid no-print">
        <label>
          <span className="field-label">Basis of estimation</span>
          <select className="field-input" value={form.basis} onChange={(e) => set({ basis: e.target.value })}>
            {BASES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Reference (LPP PO / quotation nos.)</span>
          <input type="text" className="field-input" value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Quantity</span>
          <input type="number" min="1" className="field-input" value={form.qty} onChange={(e) => set({ qty: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Unit basic rate (₹)</span>
          <input type="number" className="field-input" value={form.unitRate} onChange={(e) => set({ unitRate: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Escalation index (%)</span>
          <input type="number" className="field-input" value={form.escalationPct} onChange={(e) => set({ escalationPct: e.target.value })} />
        </label>
        <label>
          <span className="field-label">GST rate (%)</span>
          <input type="number" className="field-input" value={form.gstPct} onChange={(e) => set({ gstPct: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Freight &amp; insurance (₹)</span>
          <input type="number" className="field-input" value={form.freight} onChange={(e) => set({ freight: e.target.value })} />
        </label>
        <div className="ld-calc-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => compute()}>
            {busy ? 'Computing…' : 'Compute estimate'}
          </button>
        </div>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {out && (
        <div className="note-print-area">
          <table className="portal-mini-table">
            <thead>
              <tr>
                <th>Element</th>
                <th>Formula</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {out.lines.map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td>{l.formula}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(l.amount)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: 'var(--accent-soft)' }}>
                <td>Total estimated cost</td>
                <td>{out.basisLabel}{out.reference ? ` — ${out.reference}` : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--accent)', fontSize: 15 }}>{formatAmount(out.totals.total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="fmt-note">Rupees {out.totalWords}</p>
          <p className="field-hint">{out.note}</p>
        </div>
      )}
    </div>
  );
}
