import { useEffect, useState } from 'react';
import { fetchClaimEnums, raiseClaim } from '../../lib/claimsApi.js';
import { apiFetch } from '../../lib/api.js';

// Raise a claim against a receipt voucher on record. The PO, vendor and item come from the
// RV on the server; this form only picks the RV and states the discrepancy.
export default function ClaimForm({ onRaised, onCancel, initialRvNo = '' }) {
  const [enums, setEnums] = useState(null);
  const [rvs, setRvs] = useState([]);
  const [form, setForm] = useState({ rvNo: initialRvNo, type: 'rejection', qty: 1, reason: '', actionSought: 'Replacement' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchClaimEnums().then(setEnums).catch(() => setEnums(null));
    apiFetch('/api/rvs')
      .then((r) => r.json())
      .then((rows) => setRvs(Array.isArray(rows) ? rows : []))
      .catch(() => setRvs([]));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const rv = rvs.find((r) => r.rvNo === form.rvNo);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await raiseClaim(form);
      onRaised?.(res.claim);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-section" onSubmit={submit}>
      <div className="form-section-title">Raise a discrepancy / warranty claim</div>
      <div className="req-form-grid">
        <label className="req-span-2">
          <span className="field-label">Receipt voucher *</span>
          <select className="field-input" value={form.rvNo} onChange={(e) => set({ rvNo: e.target.value })} required>
            <option value="">— pick the RV —</option>
            {rvs.map((r) => (
              <option key={r.rvNo} value={r.rvNo}>
                {r.rvNo} · {r.poNo} · {r.vendorName} · {r.description}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Nature of discrepancy</span>
          <select className="field-input" value={form.type} onChange={(e) => set({ type: e.target.value })}>
            {Object.entries(enums?.types || { rejection: 'Rejection at inward inspection', transit_damage: 'Transit damage', shortage: 'Shortage in consignment', warranty: 'Failure within warranty' }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Claim quantity</span>
          <input type="number" min="1" step="any" className="field-input" value={form.qty} onChange={(e) => set({ qty: e.target.value })} required />
        </label>
        <label>
          <span className="field-label">Action sought</span>
          <select className="field-input" value={form.actionSought} onChange={(e) => set({ actionSought: e.target.value })}>
            {(enums?.actionsSought || ['Replacement', 'Repair / rectification', 'Credit note', 'Free supply of shortage']).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="req-span-3">
          <span className="field-label">Reason / description *</span>
          <textarea className="field-input" rows={3} value={form.reason} onChange={(e) => set({ reason: e.target.value })} required />
        </label>
      </div>
      {rv && (
        <p className="field-hint">
          Against PO {rv.poNo} · {rv.vendorName} · RV value ₹{Number(rv.rvValue).toLocaleString('en-IN')} · payment status {rv.paStatus}. Raising the claim keeps the payment advice on hold until it is settled.
        </p>
      )}
      {error && <div className="banner banner-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy || !form.rvNo}>
          {busy ? 'Raising…' : 'Raise claim'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
