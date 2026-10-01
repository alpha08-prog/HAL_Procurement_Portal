import { useEffect, useState } from 'react';
import { REQUISITION_KINDS, REQUISITION_KIND_LABEL } from '../../config/requisitionColumns.jsx';
import { formatAmount } from '../../lib/currency.js';
import { createRequisition, fetchRequisitionKinds, patchRequisition } from '../../lib/requisitionsApi.js';
import { priceEstimate } from '../../lib/toolsApi.js';

// Register or edit a requisition. The estimate preview and the stored estimate are both
// computed by the server (estimate.js); this form only collects the inputs.
const EMPTY = {
  kind: 'MPR', title: '', reference_no: '', item_description: '', part_no: '', quantity: '', uom: 'Nos', delivery_period: '',
  tendering_type: 'Open (GeM)', budget_year: '2026-27', budget_type: 'Revenue Budget', budget_head: '', budget_sl: '',
  tech_specs: '', scope_of_work: '', proprietary: false, single_tender: false, brand_specific: false, dop_clause: '',
  estimate: { basis: 'LPP', qty: '', unitRate: '', escalationPct: 0, gstPct: 18, freight: 0, reference: '' }
};

export default function RequisitionForm({ initial = null, onSaved, onCancel }) {
  const [enums, setEnums] = useState(null);
  const [form, setForm] = useState(() => (initial ? fromRow(initial) : EMPTY));
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchRequisitionKinds().then(setEnums).catch(() => setEnums(null));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setEst = (patch) => setForm((f) => ({ ...f, estimate: { ...f.estimate, ...patch } }));

  const previewEstimate = async () => {
    setError(null);
    try {
      setPreview(await priceEstimate(form.estimate));
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, quantity: form.quantity === '' ? null : Number(form.quantity) };
      if (!(form.estimate.qty && form.estimate.unitRate)) delete payload.estimate;
      const res = initial ? await patchRequisition(initial.id, payload) : await createRequisition(payload);
      onSaved?.(res.requisition);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section req-form" onSubmit={submit}>
      <div className="form-section-title">{initial ? `Edit ${initial.req_no}` : 'Register a requisition'}</div>
      <div className="req-form-grid">
        <label>
          <span className="field-label">Kind</span>
          <select className="field-input" value={form.kind} onChange={(e) => set({ kind: e.target.value })} disabled={Boolean(initial)}>
            {REQUISITION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k} — {REQUISITION_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="req-span-2">
          <span className="field-label">Title / subject *</span>
          <input className="field-input" value={form.title} onChange={(e) => set({ title: e.target.value })} required />
        </label>
        <label>
          <span className="field-label">Indentor reference no</span>
          <input className="field-input" value={form.reference_no} onChange={(e) => set({ reference_no: e.target.value })} />
        </label>
        <label className="req-span-2">
          <span className="field-label">Item description</span>
          <input className="field-input" value={form.item_description} onChange={(e) => set({ item_description: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Part no</span>
          <input className="field-input" value={form.part_no} onChange={(e) => set({ part_no: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Quantity</span>
          <input type="number" min="0" step="any" className="field-input" value={form.quantity} onChange={(e) => set({ quantity: e.target.value, estimate: { ...form.estimate, qty: form.estimate.qty || e.target.value } })} />
        </label>
        <label>
          <span className="field-label">UOM</span>
          <input className="field-input" value={form.uom} onChange={(e) => set({ uom: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Delivery period</span>
          <input className="field-input" value={form.delivery_period} onChange={(e) => set({ delivery_period: e.target.value })} placeholder="e.g. 90 days from date of Purchase Order" />
        </label>
        <label>
          <span className="field-label">Tendering</span>
          <select className="field-input" value={form.tendering_type} onChange={(e) => set({ tendering_type: e.target.value })}>
            {(enums?.tenderingTypes || ['Open (GeM)', 'Limited', 'Single', 'Proprietary', 'Rate contract']).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Budget year</span>
          <input className="field-input" value={form.budget_year} onChange={(e) => set({ budget_year: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Budget type</span>
          <select className="field-input" value={form.budget_type} onChange={(e) => set({ budget_type: e.target.value })}>
            {(enums?.budgetTypes || ['Capital Budget', 'Revenue Budget']).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Budget head</span>
          <input className="field-input" value={form.budget_head} onChange={(e) => set({ budget_head: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Budget sl no</span>
          <input className="field-input" value={form.budget_sl} onChange={(e) => set({ budget_sl: e.target.value })} />
        </label>
        <label>
          <span className="field-label">DoP clause (from the indentor checklist)</span>
          <input className="field-input" value={form.dop_clause} onChange={(e) => set({ dop_clause: e.target.value })} placeholder="e.g. Annexure III B, Sl No 1a" />
        </label>
        <label className="req-span-3">
          <span className="field-label">Technical specification</span>
          <textarea className="field-input" rows={3} value={form.tech_specs} onChange={(e) => set({ tech_specs: e.target.value })} />
        </label>
        <label className="req-span-3">
          <span className="field-label">Scope of work</span>
          <textarea className="field-input" rows={2} value={form.scope_of_work} onChange={(e) => set({ scope_of_work: e.target.value })} />
        </label>
        <div className="req-span-3 req-flags">
          {[
            ['proprietary', 'Proprietary article (PAC required)'],
            ['single_tender', 'Single tender (STE certificate required)'],
            ['brand_specific', 'Brand / make specific']
          ].map(([k, label]) => (
            <label key={k} className="clause-tick">
              <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => set({ [k]: e.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-section-title" style={{ marginTop: 'var(--space-4)' }}>Pre-tender estimate (computed on the server)</div>
      <div className="req-form-grid">
        <label>
          <span className="field-label">Basis</span>
          <select className="field-input" value={form.estimate.basis} onChange={(e) => setEst({ basis: e.target.value })}>
            {Object.entries(enums?.bases || { LPP: 'Last Purchase Price (LPP)', BQ: 'Budgetary quotations (minimum 3)', GEM: 'GeM portal indicative rate', INHOUSE: 'In-house cost estimate' }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Reference (LPP PO / quotations)</span>
          <input className="field-input" value={form.estimate.reference} onChange={(e) => setEst({ reference: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Quantity</span>
          <input type="number" min="0" step="any" className="field-input" value={form.estimate.qty} onChange={(e) => setEst({ qty: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Unit basic rate (₹)</span>
          <input type="number" min="0" step="any" className="field-input" value={form.estimate.unitRate} onChange={(e) => setEst({ unitRate: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Escalation (%)</span>
          <input type="number" step="any" className="field-input" value={form.estimate.escalationPct} onChange={(e) => setEst({ escalationPct: e.target.value })} />
        </label>
        <label>
          <span className="field-label">GST (%)</span>
          <input type="number" step="any" className="field-input" value={form.estimate.gstPct} onChange={(e) => setEst({ gstPct: e.target.value })} />
        </label>
        <label>
          <span className="field-label">Freight &amp; insurance (₹)</span>
          <input type="number" step="any" className="field-input" value={form.estimate.freight} onChange={(e) => setEst({ freight: e.target.value })} />
        </label>
        <div className="ld-calc-actions">
          <button type="button" className="btn btn-secondary" onClick={previewEstimate} disabled={!(form.estimate.qty && form.estimate.unitRate)}>
            Preview estimate
          </button>
        </div>
        {preview && (
          <div className="req-span-2 req-estimate-preview">
            <div>
              Basic ₹{formatAmount(preview.totals.basic)} · GST ₹{formatAmount(preview.totals.gst)} · Freight ₹{formatAmount(preview.totals.freight)}
            </div>
            <strong>Total ₹{formatAmount(preview.totals.total)}</strong>
            <div className="field-hint">{preview.totalWords}</div>
          </div>
        )}
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Register requisition'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <span className="action-note">The requisition no is allotted by the server; the estimate is recomputed there from these inputs.</span>
      </div>
    </form>
  );
}

function fromRow(r) {
  const e = r.estimate_inputs || {};
  return {
    kind: r.kind,
    title: r.title || '',
    reference_no: r.reference_no || '',
    item_description: r.item_description || '',
    part_no: r.part_no || '',
    quantity: r.quantity ?? '',
    uom: r.uom || '',
    delivery_period: r.delivery_period || '',
    tendering_type: r.tendering_type || 'Open (GeM)',
    budget_year: r.budget_year || '',
    budget_type: r.budget_type || 'Revenue Budget',
    budget_head: r.budget_head || '',
    budget_sl: r.budget_sl || '',
    tech_specs: r.tech_specs || '',
    scope_of_work: r.scope_of_work || '',
    proprietary: Boolean(r.proprietary),
    single_tender: Boolean(r.single_tender),
    brand_specific: Boolean(r.brand_specific),
    dop_clause: r.dop_clause || '',
    estimate: { basis: e.basis || r.estimate_basis || 'LPP', qty: e.qty ?? '', unitRate: e.unitRate ?? '', escalationPct: e.escalationPct ?? 0, gstPct: e.gstPct ?? 18, freight: e.freight ?? 0, reference: e.reference || '' }
  };
}
