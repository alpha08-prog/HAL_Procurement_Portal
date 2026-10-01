import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import ClaimForm from '../../components/claims/ClaimForm.jsx';
import { CLAIM_TABS, DISCREPANCY_COLUMNS, claimColumns } from '../../config/claimColumns.jsx';
import { useRole } from '../../context/RoleContext.jsx';
import { fetchClaims, fetchDiscrepancies, transitionClaim } from '../../lib/claimsApi.js';

// Claim Management: the in-memory claims register (/api/claims) with its lifecycle
// raised → dispatched → received → closed, the KPI tiles computed from it, and the RVs /
// payment advices where a claim may be due but none is raised.
export default function ClaimManagementWorkspace() {
  const { role } = useRole();
  const [params, setParams] = useSearchParams();
  const tab = CLAIM_TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'status';
  const [data, setData] = useState(null);
  const [disc, setDisc] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(null); // { claim, action, values }

  const listTab = ['status', 'dispatched', 'received', 'closed'].includes(tab) ? tab : 'status';
  const load = useCallback(() => {
    fetchClaims(listTab)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [listTab]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (tab !== 'discrepancies') return;
    fetchDiscrepancies().then(setDisc).catch((e) => setError(e.message));
  }, [tab]);

  const setTab = (id) => setParams({ tab: id });

  const rows = data?.claims.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || `${c.claimNo} ${c.poNo} ${c.rvNo} ${c.vendorName} ${c.item || ''}`.toLowerCase().includes(q);
  });

  const runAction = async () => {
    try {
      await transitionClaim(pending.claim.claimNo, pending.action.id, pending.values);
      setPending(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const s = data?.summary;
  const tile = (v) => (v == null ? '—' : v);

  return (
    <section className="screen">
      <div className="screen-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: '#EA580C', boxShadow: '0 0 0 4px #FFEDD5' }} />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>CLAIM MANAGEMENT WORKSPACE</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              Rejections, transit damage, shortages and warranty failures against receipt vouchers
            </p>
          </div>
        </div>
        <button type="button" className="btn" style={{ background: '#EA580C', color: '#FFF', fontWeight: 600 }} onClick={() => setTab('raise')}>
          + Raise new claim
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Claims raised</div>
          <div className="kpi-card-val" style={{ color: '#EA580C' }}>{tile(s?.total)}</div>
          <span className="kpi-card-sub">{s ? `${s.byStatus.raised} awaiting dispatch / settlement` : ''}</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Units dispatched to vendor</div>
          <div className="kpi-card-val" style={{ color: '#D97706' }}>{tile(s?.unitsDispatched)}</div>
          <span className="kpi-card-sub">{s ? `${s.byStatus.dispatched} claim(s) under returnable gate pass` : ''}</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Units received / replaced</div>
          <div className="kpi-card-val" style={{ color: '#059669' }}>{tile(s?.unitsReceived)}</div>
          <span className="kpi-card-sub">{s ? `${s.byStatus.received} received, ${s.byStatus.closed} closed` : ''}</span>
        </div>
        <div className="kpi-card-box" style={{ background: '#F8FAFC' }}>
          <div className="kpi-card-lbl">Closed &amp; settled</div>
          <div className="kpi-card-val" style={{ color: '#0F172A' }}>{tile(s?.closed)}</div>
          <span className="kpi-card-sub">{s ? `${s.withCreditNote} with a vendor credit note` : ''}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CLAIM_TABS.map((t) => (
            <button key={t.id} type="button" className={`chip ${tab === t.id ? 'chip-active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {!['raise', 'discrepancies'].includes(tab) && (
          <input type="text" className="field-input" style={{ width: 260 }} placeholder="Search claim, PO, RV, vendor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {tab === 'raise' && (
        <ClaimForm
          onRaised={() => setTab('status')}
          onCancel={() => setTab('status')}
        />
      )}

      {tab === 'discrepancies' && (
        <div>
          <p className="field-hint" style={{ marginTop: 0 }}>Receipt vouchers accepted below the invoice (credit note due) and payment advices held on a bank mismatch — where a claim may be needed but none is on record.</p>
          <DataGrid columns={DISCREPANCY_COLUMNS} rows={disc?.rows ?? null} rowKey="rvNo" emptyMessage="No open discrepancies in the fixture." />
          {disc && <p className="tracker-source">Source: {disc.source}</p>}
        </div>
      )}

      {!['raise', 'discrepancies'].includes(tab) && (
        <>
          {pending && (
            <div className="form-section">
              <div className="form-section-title">
                {pending.action.label} — {pending.claim.claimNo}
              </div>
              <div className="req-form-grid">
                {pending.action.meta.includes('gatePassNo') && (
                  <label>
                    <span className="field-label">Returnable gate pass no *</span>
                    <input className="field-input" value={pending.values.gatePassNo || ''} onChange={(e) => setPending({ ...pending, values: { ...pending.values, gatePassNo: e.target.value } })} />
                  </label>
                )}
                {pending.action.meta.includes('settlement') && (
                  <>
                    <label className="req-span-2">
                      <span className="field-label">Settlement *</span>
                      <input className="field-input" value={pending.values.settlement || ''} onChange={(e) => setPending({ ...pending, values: { ...pending.values, settlement: e.target.value } })} placeholder="e.g. Replacement accepted / credit note received" />
                    </label>
                    <label>
                      <span className="field-label">Credit note no (if any)</span>
                      <input className="field-input" value={pending.values.creditNoteNo || ''} onChange={(e) => setPending({ ...pending, values: { ...pending.values, creditNoteNo: e.target.value } })} />
                    </label>
                  </>
                )}
                <label className="req-span-2">
                  <span className="field-label">Remark</span>
                  <input className="field-input" value={pending.values.remark || ''} onChange={(e) => setPending({ ...pending, values: { ...pending.values, remark: e.target.value } })} />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={runAction}>Confirm</button>
                <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
          <DataGrid
            columns={claimColumns({ role, onAction: (claim, action) => setPending({ claim, action, values: {} }) })}
            rows={rows ?? null}
            rowKey="claimNo"
            emptyMessage="No claims in this view."
          />
          {data && <p className="tracker-source">Source: {data.source}</p>}
        </>
      )}
    </section>
  );
}
