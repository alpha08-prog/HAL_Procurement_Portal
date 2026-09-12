import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';

const PROV_TAB = PORTAL_TABS.find((t) => t.id === 'provisioning');

const SAMPLE_REQUISITIONS = [
  {
    id: 'req-1',
    kind: 'CAR',
    number: 'CAR/25/229',
    title: 'Procurement of Night Vision Binoculars (5 Nos) for Aircraft Overhaul Program',
    indentor: 'Squadron Leader R. Sharma (Airframe Overhaul)',
    date: '14/01/2026',
    estValue: 1594065,
    status: 'Approved by CFA',
    budgetHead: 'CAP-AV-2025-26',
    stage: 'Tender Floated'
  },
  {
    id: 'req-2',
    kind: 'MPR',
    number: 'MPR/25/1184',
    title: 'High-Tensile Titanium Fasteners & Lock Nuts (Aviation Grade)',
    indentor: 'P. Deshmukh (Production Planning)',
    date: '02/02/2026',
    estValue: 4820000,
    status: 'Provisioning Note Concurred',
    budgetHead: 'REV-MAT-2025-26',
    stage: 'PBO Concurrence'
  },
  {
    id: 'req-3',
    kind: 'CPR',
    number: 'CPR/25/0891',
    title: 'Specialized Hydraulic Calibration Fluid & Aeroshell Synthetic Oils',
    indentor: 'K. S. Verma (Quality & Inspection)',
    date: '18/02/2026',
    estValue: 845000,
    status: 'Checklist Verified',
    budgetHead: 'REV-CNS-2025-26',
    stage: 'Draft Provisioning'
  },
  {
    id: 'req-4',
    kind: 'SPR',
    number: 'SPR/25/0312',
    title: 'Precision Carbide Cutting Tools & CNC Collet Sets for Machine Shop',
    indentor: 'V. Nair (Tools & Machine Shop)',
    date: '25/02/2026',
    estValue: 1250000,
    status: 'Pending Finance Concurrence',
    budgetHead: 'REV-TLS-2025-26',
    stage: 'Indent Scrutiny'
  }
];

export default function ProvisioningWorkspace() {
  const navigate = useNavigate();
  const [activeSubtab, setActiveSubtab] = useState('requisitions');
  const [filterKind, setFilterKind] = useState('ALL');
  const [search, setSearch] = useState('');
  const [activeModalItem, setActiveModalItem] = useState(null);

  const filteredReqs = SAMPLE_REQUISITIONS.filter((r) => {
    const matchKind = filterKind === 'ALL' || r.kind === filterKind;
    const matchSearch =
      r.number.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.indentor.toLowerCase().includes(search.toLowerCase());
    return matchKind && matchSearch;
  });

  const openAction = (actionId, name, code, desc) => {
    setActiveModalItem({ id: actionId, action: actionId, name, code, desc });
  };

  return (
    <section className="screen">
      {/* Header Bar */}
      <div className="screen-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#EAB308',
              boxShadow: '0 0 0 4px #FEF9C3'
            }}
          />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>PROVISIONING WORKSPACE</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              Demand aggregation, Requisition Intake (MPR/CAR/CPR/SPR), Price Estimation &amp; Certification Engine
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openAction('price_estimation', 'PRICE ESTIMATION SHEET', 'PRV-06', 'Pre-tender cost estimation')}
          >
            📊 Price Estimation Sheet
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: '#EAB308', color: '#854D0E', fontWeight: 600 }}
            onClick={() => navigate('/noting/initiate')}
          >
            + Initiate Provisioning Note (N1)
          </button>
        </div>
      </div>

      {/* Subtab Navigator */}
      <div className="prov-tabs-bar" style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
        <button
          type="button"
          className={`prov-tab-btn ${activeSubtab === 'requisitions' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('requisitions')}
        >
          Requisitions (MPR / CAR / CPR / SPR)
        </button>
        <button
          type="button"
          className={`prov-tab-btn ${activeSubtab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('certificates')}
        >
          Certificates (PAC, Single Tender, Brand, Adequacy)
        </button>
        <button
          type="button"
          className={`prov-tab-btn ${activeSubtab === 'manuals' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('manuals')}
        >
          Manuals (DOP-2025, Purchase Manual, Works)
        </button>
      </div>

      {/* Tab 1: Requisitions List */}
      {activeSubtab === 'requisitions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['ALL', 'CAR', 'MPR', 'CPR', 'SPR'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`chip ${filterKind === k ? 'chip-active' : ''}`}
                  onClick={() => setFilterKind(k)}
                >
                  {k === 'ALL' ? 'All Types' : k}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="form-input"
              style={{ width: 280 }}
              placeholder="Search Requisition No, Title, Indentor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <table className="portal-mini-table" style={{ background: '#FFF' }}>
            <thead>
              <tr>
                <th>Requisition No</th>
                <th>Type</th>
                <th>Item Scope &amp; Purpose</th>
                <th>Indentor / Dept</th>
                <th>Budget Head</th>
                <th style={{ textAlign: 'right' }}>Est. Value (₹)</th>
                <th>Stage Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReqs.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 700, color: '#0F172A' }}>{req.number}</td>
                  <td>
                    <span className="pill pill-info" style={{ fontWeight: 600 }}>{req.kind}</span>
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{req.title}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Date: {req.date}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{req.indentor}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{req.budgetHead}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                    ₹{req.estValue.toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className="pill pill-success">{req.status}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => navigate('/noting/initiate')}
                    >
                      Open Note →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Certificates & Statements */}
      {activeSubtab === 'certificates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <div className="prov-card-item">
            <div className="prov-card-head">
              <h3>Proprietary Article Certificate (PAC)</h3>
              <span className="pill pill-warning">PRV-07</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Statutory certificate when goods are manufactured solely by an OEM and no alternative model is acceptable.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('pac_certificate', 'PROPRIETARY CERTIFICATE', 'PRV-07', 'Proprietary Article Certificate')}
            >
              Generate PAC Certificate →
            </button>
          </div>

          <div className="prov-card-item">
            <div className="prov-card-head">
              <h3>Single Tender Certificate (STE)</h3>
              <span className="pill pill-warning">PRV-08</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Justification under GFR Rule 166 and HAL Purchase Manual for single tender procurement with cost verification.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('single_tender_cert', 'SINGLE TENDER CERTIFICATE', 'PRV-08', 'Single Tender Certificate')}
            >
              Generate Single Tender Cert →
            </button>
          </div>

          <div className="prov-card-item">
            <div className="prov-card-head">
              <h3>Standardization / Make &amp; Brand Certificate</h3>
              <span className="pill pill-warning">PRV-09</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Standardization certificate justifying procurement of a specific brand to match aircraft shop machinery.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('brand_cert', 'MAKE / BRAND CERTIFICATE', 'PRV-09', 'Make & Brand Certificate')}
            >
              Generate Brand Certificate →
            </button>
          </div>

          <div className="prov-card-item">
            <div className="prov-card-head">
              <h3>Adequacy of Provisioning Statement</h3>
              <span className="pill pill-warning">PRV-05</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Scrutiny of current stock balance, dues-in against earlier purchase orders, and 3-year consumption rates.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('adequacy_statement', 'ADEQUACY STATEMENT', 'PRV-05', 'Adequacy of Provisioning')}
            >
              Draft Adequacy Statement →
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Governance & Manuals */}
      {activeSubtab === 'manuals' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div className="prov-card-item">
            <h3>DOP-2025 Delegation Matrix</h3>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Interactive matrix of financial thresholds for General Manager, Additional General Manager and Chief Managers.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('dop_lookup', 'DOP (Delegation of Powers)', 'PRV-11', 'DOP-2025 Authority Matrix')}
            >
              View DOP Matrix →
            </button>
          </div>

          <div className="prov-card-item">
            <h3>Purchase Manual (Issue-4)</h3>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Comprehensive procedures for open tenders, limited tenders, bid opening and committee formations.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('pm_guidelines', 'PM (Procurement Manual)', 'PRV-12', 'Purchase Manual Issue-4')}
            >
              Read PM Guidelines →
            </button>
          </div>

          <div className="prov-card-item">
            <h3>Material Planning &amp; Works Manual</h3>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Rules for outsourcing, subcontracting, raw material scrap reconciliation and vendor development.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openAction('works_manual', 'MAT PLG / OS / WORKS MANUAL', 'PRV-13', 'Material Planning & Works')}
            >
              Read Works Manual →
            </button>
          </div>
        </div>
      )}

      {/* Modal Popup */}
      {activeModalItem && (
        <PortalItemModal
          item={activeModalItem}
          tab={PROV_TAB}
          onClose={() => setActiveModalItem(null)}
        />
      )}
    </section>
  );
}
