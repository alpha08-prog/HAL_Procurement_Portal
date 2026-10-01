import { useEffect, useState } from 'react';
import { formatAmount } from '../../lib/currency.js';
import { ldCalc } from '../../lib/toolsApi.js';

// PAY-03 LD calculator. Every figure comes back from POST /api/payment-advices/ld-calc, which
// runs the same computeLd() as the payment advice; this component only collects inputs.
const DEFAULTS = { poValue: 1594065, rvValue: '', mode: 'weeks', delayWeeks: 3, deliveryDueDate: '', gateEntryDate: '', ldIcAmount: 0 };

export default function LdCalculator() {
  const [form, setForm] = useState(DEFAULTS);
  const [out, setOut] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const compute = async (f = form) => {
    setBusy(true);
    setError(null);
    try {
      const payload = { poValue: f.poValue, rvValue: f.rvValue || undefined, ldIcAmount: f.ldIcAmount || 0 };
      if (f.mode === 'weeks') payload.delayWeeks = f.delayWeeks;
      else {
        payload.deliveryDueDate = f.deliveryDueDate;
        payload.gateEntryDate = f.gateEntryDate;
      }
      setOut(await ldCalc(payload));
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

  const r = out?.result;
  const money = (v) => (v == null ? '—' : `₹${formatAmount(v)}`);

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>LIQUIDATED DAMAGES (LD) CALCULATOR</strong>
        <span>{out ? `${out.policy.ratePerWeek * 100}% / week or part, ceiling ${out.policy.capPct * 100}% of ${out.policy.capBase.toUpperCase()} value` : ''}</span>
      </div>

      <div className="ld-calc-grid no-print">
        <label>
          <span className="field-label">PO value (₹)</span>
          <input type="number" className="field-input" value={form.poValue} onChange={(e) => set({ poValue: e.target.value })} />
        </label>
        <label>
          <span className="field-label">RV value (₹, blank = PO value)</span>
          <input type="number" className="field-input" value={form.rvValue} onChange={(e) => set({ rvValue: e.target.value })} />
        </label>
        <label>
          <span className="field-label">I&amp;C delay LD (₹, manual)</span>
          <input type="number" className="field-input" value={form.ldIcAmount} onChange={(e) => set({ ldIcAmount: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Delay given as</span>
          <select className="field-input" value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="weeks">Weeks of delay</option>
            <option value="dates">Delivery due + gate entry dates</option>
          </select>
        </label>
        {form.mode === 'weeks' ? (
          <label>
            <span className="field-label">Supply delay (weeks)</span>
            <input type="number" min="0" className="field-input" value={form.delayWeeks} onChange={(e) => set({ delayWeeks: e.target.value })} />
          </label>
        ) : (
          <>
            <label>
              <span className="field-label">Delivery due date</span>
              <input type="date" className="field-input" value={form.deliveryDueDate} onChange={(e) => set({ deliveryDueDate: e.target.value })} />
            </label>
            <label>
              <span className="field-label">Gate entry date</span>
              <input type="date" className="field-input" value={form.gateEntryDate} onChange={(e) => set({ gateEntryDate: e.target.value })} />
            </label>
          </>
        )}
        <div className="ld-calc-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => compute()}>
            {busy ? 'Computing…' : 'Compute LD'}
          </button>
        </div>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {r && (
        <>
          <div className="ld-calc-cards">
            <div className="kpi-card-box">
              <div className="kpi-card-lbl">Weeks of delay</div>
              <div className="kpi-card-val">{r.ldWeeks}</div>
              <span className="kpi-card-sub">{out.daysLate} days late (part-week rounded up)</span>
            </div>
            <div className="kpi-card-box">
              <div className="kpi-card-lbl">Supply-delay LD</div>
              <div className="kpi-card-val">{money(r.ldSupplyAmount)}</div>
              <span className="kpi-card-sub">{out.policy.ratePerWeek * 100}% × RV value × {r.ldWeeks} wk</span>
            </div>
            <div className="kpi-card-box" style={{ borderColor: r.ldCapApplied ? 'var(--danger-fg)' : 'var(--border)' }}>
              <div className="kpi-card-lbl">Ceiling ({out.policy.capPct * 100}%)</div>
              <div className="kpi-card-val" style={{ color: r.ldCapApplied ? 'var(--danger-fg)' : 'var(--accent)' }}>{money(r.ldCap)}</div>
              <span className="kpi-card-sub">{r.ldCapApplied ? 'Cap applied' : 'Within ceiling'}</span>
            </div>
            <div className="kpi-card-box" style={{ background: 'var(--success-bg)' }}>
              <div className="kpi-card-lbl" style={{ color: 'var(--success-fg)' }}>LD deductible</div>
              <div className="kpi-card-val" style={{ color: 'var(--success-fg)' }}>{money(r.ldAmount)}</div>
              <span className="kpi-card-sub" style={{ color: 'var(--success-fg)' }}>Net payable {money(r.finalPayment)}</span>
            </div>
          </div>
          <p className="field-hint">
            {out.source}. Ceiling base: {out.policy.capBase.toUpperCase()} value ({out.policy.status.replaceAll('_', ' ')} — server/config/ldPolicy.json).
          </p>
        </>
      )}
    </div>
  );
}
