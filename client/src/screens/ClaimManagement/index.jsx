import { useState } from 'react';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';

const CLAIM_TAB = PORTAL_TABS.find((t) => t.id === 'claim_management');

const SAMPLE_CLAIMS = [
  {
    id: 'CLM-2026-001',
    poNo: 'PO/2025/1104',
    rvNo: 'RV-2026-0042',
    vendor: 'M/s Precitex Instruments Pvt Ltd',
    item: 'Night Vision Binoculars (Type-A)',
    qty: 1,
    claimDate: '15/02/2026',
    reason: 'Optical misalignment & reticle illumination defect',
    status: 'DISPATCHED_TO_VENDOR',
    gatePassNo: 'RMGP/2026/041',
    dispatchDate: '18/02/2026',
    settlement: 'Pending vendor rectification',
    stage: 'Under Repair'
  },
  {
    id: 'CLM-2026-002',
    poNo: 'PO/2025/0982',
    rvNo: 'RV-2026-0018',
    vendor: 'M/s Shobha Electro-Optics',
    item: 'Lithium Battery Power Packs',
    qty: 4,
    claimDate: '28/01/2026',
    reason: 'Under-voltage under load test (< 24V DC)',
    status: 'ITEM_RECEIVED_REPLACED',
    gatePassNo: 'RMGP/2026/012',
    dispatchDate: '30/01/2026',
    settlement: 'Replacement units received and QC accepted',
    stage: 'QC Cleared'
  },
  {
    id: 'CLM-2026-003',
    poNo: 'PO/2025/0741',
    rvNo: 'RV-2025-0811',
    vendor: 'M/s Anika Aero Forgings',
    item: 'Titanium Flange Ring Adapters',
    qty: 10,
    claimDate: '10/12/2025',
    reason: 'Transit surface gouging & dimensional discrepancy',
    status: 'CLAIMS_CLOSED',
    gatePassNo: 'RMGP/2025/390',
    dispatchDate: '14/12/2025',
    settlement: 'Credit Note #CN-884 issued by vendor; account reconciled',
    stage: 'Settled & Closed'
  },
  {
    id: 'CLM-2026-004',
    poNo: 'PO/2026/0045',
    rvNo: 'RV-2026-0091',
    vendor: 'M/s Apex Precision Seals',
    item: 'Viton Aircraft O-Rings Kit',
    qty: 50,
    claimDate: '01/03/2026',
    reason: 'Shortage in consignment (Received 150 vs Invoiced 200)',
    status: 'ACTIVE_CLAIM_RAISED',
    gatePassNo: 'N/A (Shortage)',
    dispatchDate: '—',
    settlement: 'Supplier dispatched supplementary parcel on 04/03/2026',
    stage: 'In Transit'
  }
];

export default function ClaimManagementWorkspace() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [activeModalItem, setActiveModalItem] = useState(null);

  const filteredClaims = SAMPLE_CLAIMS.filter((c) => {
    let matchTab = true;
    if (activeTab === 'dispatched') matchTab = c.status === 'DISPATCHED_TO_VENDOR';
    else if (activeTab === 'received') matchTab = c.status === 'ITEM_RECEIVED_REPLACED';
    else if (activeTab === 'closed') matchTab = c.status === 'CLAIMS_CLOSED';

    const matchSearch =
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.poNo.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor.toLowerCase().includes(search.toLowerCase()) ||
      c.item.toLowerCase().includes(search.toLowerCase());

    return matchTab && matchSearch;
  });

  const openClaimGenerator = () => {
    setActiveModalItem({
      id: 'claim_generator',
      action: 'claim_generator',
      code: 'CLM-01',
      name: 'CLAIM GENERATOR',
      desc: 'Raise discrepancy / warranty claim form'
    });
  };

  return (
    <section className="screen">
      {/* Header */}
      <div className="screen-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#EA580C',
              boxShadow: '0 0 0 4px #FFEDD5'
            }}
          />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>CLAIM MANAGEMENT WORKSPACE</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              Discrepancies, Transit Damage, Inward Rejections &amp; Warranty Replacements
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          style={{ background: '#EA580C', color: '#FFF', fontWeight: 600 }}
          onClick={openClaimGenerator}
        >
          + Raise New Discrepancy Claim
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Total Claims Raised</div>
          <div className="kpi-card-val" style={{ color: '#EA580C' }}>4</div>
          <span className="kpi-card-sub">FY 2025-26 Year-to-Date</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Units Dispatched to Vendor</div>
          <div className="kpi-card-val" style={{ color: '#D97706' }}>1 Unit</div>
          <span className="kpi-card-sub">Under Returnable Gate Pass</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Items Received / Replaced</div>
          <div className="kpi-card-val" style={{ color: '#059669' }}>4 Units</div>
          <span className="kpi-card-sub">QC Inspection Cleared</span>
        </div>
        <div className="kpi-card-box" style={{ background: '#F8FAFC' }}>
          <div className="kpi-card-lbl">Claims Closed &amp; Settled</div>
          <div className="kpi-card-val" style={{ color: '#0F172A' }}>1 Settled</div>
          <span className="kpi-card-sub">100% Financial Adjustment</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'Claim Status (All Claims)' },
            { id: 'dispatched', label: 'Units Dispatched under Claim' },
            { id: 'received', label: 'Item Received against Claim' },
            { id: 'closed', label: 'Claims Closed' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`chip ${activeTab === tab.id ? 'chip-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="form-input"
          style={{ width: 260 }}
          placeholder="Search Claim No, PO, Vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Claims Data Table */}
      <table className="portal-mini-table" style={{ background: '#FFF' }}>
        <thead>
          <tr>
            <th>Claim Reference</th>
            <th>PO &amp; RV Number</th>
            <th>Item Description</th>
            <th>Vendor Name</th>
            <th style={{ textAlign: 'center' }}>Qty</th>
            <th>Discrepancy / Failure Reason</th>
            <th>Gate Pass / Logistics</th>
            <th>Settlement Status</th>
            <th>Stage</th>
          </tr>
        </thead>
        <tbody>
          {filteredClaims.map((c) => (
            <tr key={c.id}>
              <td style={{ fontWeight: 700, color: '#C2410C' }}>{c.id}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{c.poNo}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{c.rvNo}</div>
              </td>
              <td>
                <div style={{ fontWeight: 600 }}>{c.item}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Date: {c.claimDate}</div>
              </td>
              <td style={{ fontSize: 12 }}>{c.vendor}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.qty}</td>
              <td style={{ maxWidth: 220, fontSize: 12, color: '#475569' }}>{c.reason}</td>
              <td style={{ fontSize: 11, fontFamily: 'monospace' }}>
                <div>{c.gatePassNo}</div>
                <div style={{ color: '#64748B' }}>Disp: {c.dispatchDate}</div>
              </td>
              <td style={{ fontSize: 12, maxWidth: 180 }}>{c.settlement}</td>
              <td>
                <span
                  className={`pill ${
                    c.status === 'CLAIMS_CLOSED'
                      ? 'pill-neutral'
                      : c.status === 'ITEM_RECEIVED_REPLACED'
                      ? 'pill-success'
                      : 'pill-warning'
                  }`}
                >
                  {c.stage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Universal Modal */}
      {activeModalItem && (
        <PortalItemModal
          item={activeModalItem}
          tab={CLAIM_TAB}
          onClose={() => setActiveModalItem(null)}
        />
      )}
    </section>
  );
}
