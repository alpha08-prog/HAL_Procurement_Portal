import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { CONTRACT_CLASSIFICATIONS, ITEM_COLUMNS } from '../../config/contractColumns.jsx';
import { formatINR } from '../../lib/currency.js';
import {
  fetchClausePlan, fetchFormats, fetchLibrary, fetchTenders, generateContract, lookupPo, lookupTender
} from '../../lib/contractsApi.js';

// The Contract Generation window. The user supplies only the Requisition/HAL IFS tender
// no; the app prompts for the PO under it, crawls the STC from the Contract Clauses
// Matrix for the chosen type, and pulls value/party details from the HAL PO and the
// scope of work from the Provisioning Note. Everything shown here is read-only IFS
// context — the server recomputes all money and snapshots all clauses on generation.
const ALLOWED_PROFORMA_IDS = new Set([
  'pbg_bg',
  'sd_bg',
  'adv_bg',
  'indemnity_bond',
  'warranty_cert',
  'service_level'
]);

export default function Generate() {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState([]);
  const [formats, setFormats] = useState([]);
  const [tenderNo, setTenderNo] = useState('');
  const [tender, setTender] = useState(null); // { tender, pos } | null
  const [tenderError, setTenderError] = useState(null);
  const [poNo, setPoNo] = useState('');
  const [preview, setPreview] = useState(null); // { tender, po, vendor, items, totals }
  const [typeId, setTypeId] = useState('');
  const [types, setTypes] = useState([]);
  const [plan, setPlan] = useState(null); // { auto, offered, excluded }
  const [showExcluded, setShowExcluded] = useState(false);
  const [extras, setExtras] = useState(() => new Set());
  const [customs, setCustoms] = useState([]);
  const [pickedFormats, setPickedFormats] = useState(() => new Set());
  const [form, setForm] = useState({ classification: 'normal', description: '', validity: '', periodFrom: '', periodTo: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTenders().then((d) => setTenders(d.tenders)).catch(() => setTenders([]));
    fetchFormats().then((d) => setFormats((d.formats || []).filter((f) => ALLOWED_PROFORMA_IDS.has(f.id)))).catch(() => setFormats([]));
    fetchLibrary().then((d) => setTypes(d.contractTypes)).catch(() => setTypes([]));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Step 1 → 2: resolve the tender, offer its POs in a dropdown.
  const resolveTender = async (value) => {
    setTenderNo(value);
    setTender(null);
    setTenderError(null);
    setPoNo('');
    setPreview(null);
    if (!value.trim()) return;
    try {
      setTender(await lookupTender(value));
    } catch (e) {
      setTenderError(e.message);
    }
  };

  // Step 2 → 3: pick the PO, pull the full IFS preview, prefill type + description.
  const pickPo = async (value) => {
    setPoNo(value);
    setPreview(null);
    if (!value) return;
    try {
      const p = await lookupPo(tenderNo, value);
      setPreview(p);
      set({ description: p.po.description });
      if (p.po.suggestedType) await pickType(p.po.suggestedType);
    } catch (e) {
      setError(e.message);
    }
  };

  // Step 3: the crawl — auto clauses locked in, offered/excluded tickable as extras.
  const pickType = async (value) => {
    setTypeId(value);
    setPlan(null);
    setExtras(new Set());
    if (!value) return;
    try {
      setPlan(await fetchClausePlan(value));
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleExtra = (clauseId) =>
    setExtras((s) => {
      const next = new Set(s);
      next.has(clauseId) ? next.delete(clauseId) : next.add(clauseId);
      return next;
    });

  const toggleFormat = (id) =>
    setPickedFormats((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!preview || !typeId) return setError('Pick a tender, a PO and the type of contract first.');
    setBusy(true);
    try {
      const res = await generateContract({
        tenderNo,
        poNo,
        contractTypeId: typeId,
        classification: form.classification,
        description: form.description,
        validity: form.validity || undefined,
        periodFrom: form.periodFrom || undefined,
        periodTo: form.periodTo || undefined,
        extraClauseIds: [...extras],
        customClauses: customs,
        formatIds: [...pickedFormats]
      });
      navigate(`/contracts/view/${res.contract.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const ClauseTick = ({ c, locked }) => (
    <label className={'clause-tick' + (locked ? ' clause-tick-locked' : '')}>
      <input
        type="checkbox"
        checked={locked || extras.has(c.clauseId)}
        disabled={locked}
        onChange={() => toggleExtra(c.clauseId)}
      />
      <span>
        <strong>{c.clauseNo != null ? `${c.clauseNo}. ` : ''}{c.title}</strong>
        {c.matrixValue && c.matrixValue !== 'Y' && <em className="clause-cond"> — {c.matrixValue}</em>}
      </span>
    </label>
  );

  return (
    <section className="screen">
      <h1 className="screen-title">Contract Generation</h1>
      <p className="screen-sub">
        Enter the Requisition / HAL IFS tender no; the application prompts for the PO,
        crawls the standard terms from the Contract Clauses Matrix and fetches value and
        party details from the HAL PO.
      </p>

      <form onSubmit={submit}>
        <div className="form-section">
          <div className="form-section-title">1 · Tender &amp; Purchase Order</div>
          <div className="form-grid">
            <label>
              <span className="field-label">
                Requisition / HAL IFS tender no <span className="req">*</span>
              </span>
              <input
                className="field-input"
                list="tender-options"
                value={tenderNo}
                onChange={(e) => resolveTender(e.target.value)}
                placeholder="e.g. GEM/2025/B/6638737"
              />
              <datalist id="tender-options">
                {tenders.map((t) => (
                  <option key={t.tenderNo} value={t.tenderNo}>{t.description}</option>
                ))}
              </datalist>
            </label>

            {tender && (
              <label>
                <span className="field-label">
                  Generate contract from PO <span className="req">*</span>
                </span>
                <select className="field-input" value={poNo} onChange={(e) => pickPo(e.target.value)}>
                  <option value="">— select PO no —</option>
                  {tender.pos.map((p) => (
                    <option key={p.poNo} value={p.poNo}>
                      {p.poNo} · {p.description}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {tenderError && tenderNo.trim() && <div className="field-hint">{tenderError}</div>}
          {tender && (
            <p className="field-hint">
              CAR {tender.tender.carNo} · {tender.tender.modeOfTendering} · {tender.tender.cfaDopRef}
            </p>
          )}
        </div>

        {preview && (
          <div className="form-section">
            <div className="form-section-title">2 · Fetched from HAL PO (read-only)</div>
            <div className="po-preview">
              <div className="po-preview-card">
                <strong>{preview.vendor?.name}</strong>
                <div>{preview.vendor?.address}</div>
                <div>GSTIN {preview.vendor?.gstin}</div>
                <div>{preview.vendor?.contact}</div>
              </div>
              <div className="po-preview-card">
                <strong>PO {preview.po.poNo}</strong> dt. {preview.po.poDate}
                <div>{preview.po.description}</div>
                <div>Delivery: {preview.po.deliveryPeriod}</div>
                <div>
                  Value: {formatINR(preview.totals.landedValue)} <span className="field-hint-inline">(incl. taxes — computed server-side)</span>
                </div>
              </div>
            </div>
            <DataGrid columns={ITEM_COLUMNS} rows={preview.items} rowKey="lineNo" />
            <p className="field-hint">
              Basic {formatINR(preview.totals.basicValue)} · Tax {formatINR(preview.totals.taxTotal)} ·
              Landed {formatINR(preview.totals.landedValue)}
            </p>
            <details>
              <summary className="field-label">Scope of work (from Provisioning Note)</summary>
              <p className="note-para">{preview.po.scopeOfWork}</p>
            </details>
          </div>
        )}

        {preview && (
          <div className="form-section">
            <div className="form-section-title">3 · Type of purchase / contract &amp; standard clauses</div>
            <div className="form-grid">
              <label>
                <span className="field-label">
                  Type of contract <span className="req">*</span>
                </span>
                <select className="field-input" value={typeId} onChange={(e) => pickType(e.target.value)}>
                  <option value="">— select type —</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {plan && (
              <>
                <p className="field-hint">
                  {plan.auto.length} standard clauses crawled automatically from the Contract
                  Clauses Matrix. Tick any additional STC you want in this contract.
                </p>
                <div className="clause-plan">
                  <div className="clause-group">
                    <div className="clause-group-title">Auto-selected (per Matrix)</div>
                    {plan.auto.map((c) => <ClauseTick key={c.clauseId} c={c} locked />)}
                  </div>
                  <div className="clause-group">
                    <div className="clause-group-title">Offered — include on requirement</div>
                    {plan.offered.map((c) => <ClauseTick key={c.clauseId} c={c} />)}
                    <button type="button" className="btn btn-secondary btn-inline" onClick={() => setShowExcluded((v) => !v)}>
                      {showExcluded ? 'Hide' : 'Show'} clauses marked N for this type ({plan.excluded.length})
                    </button>
                    {showExcluded && plan.excluded.map((c) => <ClauseTick key={c.clauseId} c={c} />)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {plan && (
          <div className="form-section">
            <div className="form-section-title">4 · Contract particulars</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Classification</span>
                <select
                  className="field-input"
                  value={form.classification}
                  onChange={(e) => set({ classification: e.target.value })}
                >
                  {CONTRACT_CLASSIFICATIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-wide">
                <span className="field-label">Description of contract</span>
                <input className="field-input" value={form.description} onChange={(e) => set({ description: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Period from</span>
                <input className="field-input" type="date" value={form.periodFrom} onChange={(e) => set({ periodFrom: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Period to</span>
                <input className="field-input" type="date" value={form.periodTo} onChange={(e) => set({ periodTo: e.target.value })} />
              </label>
              <label className="field-wide">
                <span className="field-label">Validity of contract</span>
                <input
                  className="field-input"
                  value={form.validity}
                  onChange={(e) => set({ validity: e.target.value })}
                  placeholder="Default: 12 months from the date of contract"
                />
              </label>
            </div>
          </div>
        )}

        {plan && (
          <div className="form-section">
            <div className="form-section-title">5 · Additional clauses (user-written)</div>
            {customs.map((c, i) => (
              <div className="form-grid custom-clause-row" key={i}>
                <label>
                  <span className="field-label">Clause title</span>
                  <input
                    className="field-input"
                    value={c.title}
                    onChange={(e) => setCustoms(customs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  />
                </label>
                <label className="field-wide">
                  <span className="field-label">Clause text</span>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={c.body}
                    onChange={(e) => setCustoms(customs.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                  />
                </label>
                <div>
                  <button type="button" className="btn btn-secondary btn-inline" onClick={() => setCustoms(customs.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-inline" onClick={() => setCustoms([...customs, { title: '', body: '' }])}>
              + Add additional clause
            </button>
            <span className="action-note"> Appears under "Additional Clauses" in the contract.</span>
          </div>
        )}

        {plan && (
          <div className="form-section">
            <div className="form-section-title">6 · Standard proformas to annex</div>
            <div className="format-picks">
              {formats.map((f) => (
                <label key={f.id} className="clause-tick">
                  <input type="checkbox" checked={pickedFormats.has(f.id)} onChange={() => toggleFormat(f.id)} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn" disabled={busy || !plan}>
            {busy ? 'Generating…' : 'Generate Contract'}
          </button>
          <span className="action-note">
            Contract no is generated automatically and references the HAL PO no.
          </span>
        </div>
      </form>
    </section>
  );
}
