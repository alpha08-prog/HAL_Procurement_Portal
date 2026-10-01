import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import RequisitionForm from '../../components/provisioning/RequisitionForm.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';
import {
  REQUISITION_DETAIL_FIELDS, REQUISITION_KINDS, RequisitionLinks, RequisitionStatusBadge, requisitionColumns
} from '../../config/requisitionColumns.jsx';
import { formatINR } from '../../lib/currency.js';
import { formatDate } from '../../lib/date.js';
import { fetchRequisition, fetchRequisitions } from '../../lib/requisitionsApi.js';

const PROV_TAB = PORTAL_TABS.find((t) => t.id === 'provisioning');
const TABS = [
  ['requisitions', 'Requisitions (MPR / CAR / CPR / SPR)'],
  ['certificates', 'Certificates (PAC, Single Tender, Brand, Adequacy)'],
  ['manuals', 'Manuals (DOP-2025, Purchase Manual, Works)']
];
const CERTIFICATES = [
  { action: 'pac_certificate', code: 'PRV-07', name: 'PROPRIETARY CERTIFICATE', title: 'Proprietary Certificate (PM Annexure 16)', desc: 'When the goods are manufactured solely by an OEM and no alternative is acceptable.' },
  { action: 'single_tender_cert', code: 'PRV-08', name: 'SINGLE TENDER CERTIFICATE', title: 'Single Tender Certificate (PM Annexure 17)', desc: 'Justification for single tender / nomination basis with price reasonability (Part B).' },
  { action: 'brand_cert', code: 'PRV-09', name: 'MAKE / BRAND CERTIFICATE', title: 'Make / Brand Standardisation Certificate', desc: 'Justifies a specific make to match existing plant and test equipment. Template pending from HAL.' },
  { action: 'adequacy_statement', code: 'PRV-05', name: 'ADEQUACY STATEMENT', title: 'Adequacy of Provisioning Statement', desc: 'Stock, dues-in and consumption scrutiny behind the indented quantity. Template pending from HAL.' }
];
const MANUALS = [
  { action: 'dop_lookup', code: 'PRV-11', name: 'DOP (Delegation of Powers)', title: 'DOP-2025 Delegation Matrix', desc: 'Clause map, level → designation and the value bands (pending from HAL) from ai/dop2025.json.' },
  { action: 'pm_guidelines', code: 'PRV-12', name: 'PM (Procurement Manual)', title: 'Purchase Manual (Issue-4)', desc: 'The annexures on file, with page numbers and the library entry each one became.' },
  { action: 'works_manual', code: 'PRV-13', name: 'MAT PLG / OS / WORKS MANUAL', title: 'Material Planning & Works Manual', desc: 'Not in the sample data — the entry says what HAL must supply.' }
];

// The Provisioning workspace: the requisition register (server/data/requisitions.db) with the
// status each row has reached across noting, contracts and payments, plus the certificate
// and manual tools from the formats library pre-filled from a chosen requisition.
export default function ProvisioningWorkspace() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'requisitions';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [kindFilter, setKindFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null);
  const [certReq, setCertReq] = useState('');

  const load = () =>
    fetchRequisitions()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = params.get('req');
    if (!id) {
      setDetail(null);
      return;
    }
    fetchRequisition(id)
      .then((d) => {
        setDetail(d.requisition);
        setEvents(d.events);
      })
      .catch((e) => setError(e.message));
  }, [params]);

  const setTab = (id) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('tab', id);
    return n;
  });
  const openDetail = (r) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('tab', 'requisitions');
    n.set('req', r.id);
    return n;
  });
  const closeDetail = () => setParams((p) => {
    const n = new URLSearchParams(p);
    n.delete('req');
    return n;
  });

  const rows = useMemo(() => {
    if (!data) return null;
    const q = search.trim().toLowerCase();
    return data.requisitions.filter(
      (r) =>
        (kindFilter === 'ALL' || r.kind === kindFilter) &&
        (!statusFilter || r.status === statusFilter) &&
        (!q || `${r.req_no} ${r.title} ${r.item_description || ''} ${r.indentor_name || ''} ${r.po_no || ''} ${r.tender_no || ''}`.toLowerCase().includes(q))
    );
  }, [data, kindFilter, statusFilter, search]);

  const openNote = (r) => {
    const f = r.links?.notingFile;
    if (f) navigate(`/noting/note/${f.last_txn || f.first_txn}`);
    else navigate(`/noting/initiate?requisition=${r.id}`);
  };
  const openTool = (action, extra, context) => setModal({ item: { id: action, action, ...extra }, context });
  const openTender = (r) => openTool('tender_generator', { code: 'PRO-01', name: 'GENERATE TENDER DOCUMENT', desc: `Compiled for ${r.req_no}` }, { requisitionId: r.id });
  const columns = useMemo(() => requisitionColumns({ onOpen: openDetail, onNote: openNote, onTender: openTender }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = {};
    for (const r of data?.requisitions || []) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [data]);

  return (
    <section className="screen">
      <div className="screen-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#EAB308', boxShadow: '0 0 0 4px #FEF9C3' }} />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>PROVISIONING WORKSPACE</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              Requisition intake (MPR / CAR / CPR / SPR), server-computed estimates, certificates and manuals
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => openTool('price_estimation', { code: 'PRV-06', name: 'PRICE ESTIMATION SHEET', desc: 'Pre-tender cost estimation (server-computed)' })}>
            📊 Price estimation sheet
          </button>
          <button type="button" className="btn" style={{ background: '#EAB308', color: '#854D0E', fontWeight: 600 }} onClick={() => { setEditing(null); setShowForm(true); setTab('requisitions'); }}>
            + New requisition
          </button>
        </div>
      </div>

      <div className="prov-tabs-bar" style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`prov-tab-btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {tab === 'requisitions' && (
        <div>
          {showForm && (
            <RequisitionForm
              initial={editing}
              onSaved={(r) => {
                setShowForm(false);
                setEditing(null);
                load().then(() => openDetail(r));
              }}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          )}

          {detail && !showForm && (
            <div className="req-detail form-section">
              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {detail.req_no} — {detail.title}
                </span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <RequisitionStatusBadge status={detail.status} label={detail.status_label} evidence={detail.status_evidence} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={closeDetail}>✕ Close</button>
                </span>
              </div>
              {detail.fixture && <div className="banner banner-restricted">Fabricated fixture case (E-33046): bidders and prices in the linked AI case are invented.</div>}
              <p className="field-hint">Status evidence: {detail.status_evidence}</p>
              <div className="req-detail-grid">
                {REQUISITION_DETAIL_FIELDS.map(([key, label, fmt]) => (
                  <div key={key} className="req-detail-field">
                    <span className="field-label">{label}</span>
                    <span className="field-value">
                      {detail[key] == null || detail[key] === '' ? '—' : fmt === 'date' ? formatDate(detail[key]) : fmt === 'money' ? formatINR(detail[key]) : String(detail[key])}
                    </span>
                  </div>
                ))}
              </div>
              {(detail.tech_specs || detail.scope_of_work) && (
                <div className="req-detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                  {detail.scope_of_work && <div className="req-detail-field"><span className="field-label">Scope of work</span><span className="field-value">{detail.scope_of_work}</span></div>}
                  {detail.tech_specs && <div className="req-detail-field"><span className="field-label">Technical specification</span><span className="field-value">{detail.tech_specs}</span></div>}
                </div>
              )}
              <div className="req-detail-field">
                <span className="field-label">Linked records</span>
                <RequisitionLinks r={detail} />
              </div>
              <div className="form-actions" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={() => openNote(detail)}>
                  {detail.links?.notingFile ? 'Open proposal note' : 'Initiate provisioning note'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => openTender(detail)}>Tender document</button>
                {CERTIFICATES.map((c) => (
                  <button key={c.action} type="button" className="btn btn-secondary" onClick={() => openTool(c.action, c, { requisitionId: detail.id })}>
                    {c.title.split(' (')[0]}
                  </button>
                ))}
                {!detail.links?.notingFile && (
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditing(detail); setShowForm(true); }}>Edit</button>
                )}
              </div>
              {events.length > 0 && (
                <details className="req-events">
                  <summary>History ({events.length})</summary>
                  <ul>
                    {events.map((ev) => (
                      <li key={ev.id}>
                        <span className="field-hint">{formatDate(ev.created_at)}</span> {ev.kind}: {ev.detail}{ev.actor ? ` — ${ev.actor}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ALL', ...REQUISITION_KINDS].map((k) => (
                <button key={k} type="button" className={`chip ${kindFilter === k ? 'chip-active' : ''}`} onClick={() => setKindFilter(k)}>
                  {k === 'ALL' ? 'All types' : k}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {(data?.statuses || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}{counts[s.id] ? ` (${counts[s.id]})` : ''}
                  </option>
                ))}
              </select>
              <input type="text" className="field-input" style={{ width: 280 }} placeholder="Search no, title, indentor, PO, tender…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <DataGrid columns={columns} rows={rows} rowKey="id" pageSize={20} emptyMessage="No requisitions match." />
          {data && <p className="tracker-source">Source: {data.source}</p>}
        </div>
      )}

      {tab === 'certificates' && (
        <div>
          <div className="form-section" style={{ marginBottom: 14 }}>
            <label>
              <span className="field-label">Pre-fill from requisition</span>
              <select className="field-input" value={certReq} onChange={(e) => setCertReq(e.target.value)} style={{ maxWidth: 520 }}>
                <option value="">— none (blank format) —</option>
                {(data?.requisitions || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.req_no} — {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {CERTIFICATES.map((c) => (
              <div key={c.action} className="prov-card-item">
                <div className="prov-card-head">
                  <h3>{c.title}</h3>
                  <span className="pill pill-warning">{c.code}</span>
                </div>
                <p style={{ fontSize: 13, color: '#475569' }}>{c.desc}</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTool(c.action, c, certReq ? { requisitionId: Number(certReq) } : undefined)}>
                  Open format →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'manuals' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {MANUALS.map((m) => (
            <div key={m.action} className="prov-card-item">
              <h3>{m.title}</h3>
              <p style={{ fontSize: 13, color: '#475569' }}>{m.desc}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTool(m.action, m)}>
                Open →
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && <PortalItemModal item={modal.item} tab={PROV_TAB} context={modal.context} onClose={() => setModal(null)} />}
    </section>
  );
}
