import { useState } from 'react';
import PortalItemModal from '../../components/portal/PortalItemModal.jsx';
import { PORTAL_TABS } from '../../config/portalStructure.js';

const KPI_TAB = PORTAL_TABS.find((t) => t.id === 'kpi');

export default function KpiSuiteWorkspace() {
  const [activeModalItem, setActiveModalItem] = useState(null);

  const openKpiDetail = (kpiItem) => {
    setActiveModalItem(kpiItem);
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
              background: '#9333EA',
              boxShadow: '0 0 0 4px #F3E8FF'
            }}
          />
          <div>
            <h1 className="screen-title" style={{ margin: 0 }}>EXECUTIVE PROCUREMENT KPI &amp; MIS DASHBOARD</h1>
            <p className="screen-subtitle" style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
              HAL Nashik Division • 16 Statutory Key Performance Indicators &amp; MIS Analytics
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          style={{ background: '#9333EA', color: '#FFF', fontWeight: 600 }}
          onClick={() => window.print()}
        >
          🖨️ Export Monthly MIS Report (PDF)
        </button>
      </div>

      {/* 1. Monthly Requisition & Order Velocity (Metrics 02 - 08) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A', fontWeight: 700 }}>
            1. REQUISITION TO PURCHASE ORDER VELOCITY (MONTHLY)
          </h3>
          <span className="pill pill-info">Monthly Lifecycle Flow</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {KPI_TAB.items.slice(1, 5).map((item) => (
            <div
              key={item.id}
              className="kpi-interactive-card"
              onClick={() => openKpiDetail(item)}
            >
              <div className="kpi-card-code">{item.code}</div>
              <div className="kpi-card-name">{item.name}</div>
              <div className="kpi-card-metric">
                {item.id === 'no_mpr_received_per_month' && '48 MPRs'}
                {item.id === 'no_mpr_converted_to_po' && '41 Orders'}
                {item.id === 'mpr_outstanding_end_month' && '7 Backlog'}
                {item.id === 'po_outstanding_start_month' && '112 Orders'}
              </div>
              <p className="kpi-card-desc">{item.desc}</p>
              <div className="kpi-card-action">View Breakdown Chart →</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          {KPI_TAB.items.slice(5, 8).map((item) => (
            <div
              key={item.id}
              className="kpi-interactive-card"
              onClick={() => openKpiDetail(item)}
            >
              <div className="kpi-card-code">{item.code}</div>
              <div className="kpi-card-name">{item.name}</div>
              <div className="kpi-card-metric" style={{ color: '#047857' }}>
                {item.id === 'po_placed_month_value' && '₹18.42 Cr (38 POs)'}
                {item.id === 'po_closed_month_value' && '₹14.90 Cr (34 POs)'}
                {item.id === 'po_outstanding_end_month' && '116 Active POs'}
              </div>
              <p className="kpi-card-desc">{item.desc}</p>
              <div className="kpi-card-action">View Financial Details →</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Tendering Activity & Market Participation (Metrics 09 - 10) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A', fontWeight: 700 }}>
            2. TENDERING &amp; BID OPENING ACTIVITY
          </h3>
          <span className="pill pill-success">GeM &amp; e-Procurement</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {KPI_TAB.items.slice(8, 10).map((item) => (
            <div
              key={item.id}
              className="kpi-interactive-card"
              onClick={() => openKpiDetail(item)}
            >
              <div className="kpi-card-code">{item.code}</div>
              <div className="kpi-card-name">{item.name}</div>
              <div className="kpi-card-metric" style={{ color: '#0284C7' }}>
                {item.id === 'tenders_floated_month' && '29 Enquiries Published'}
                {item.id === 'tenders_opened_month' && '27 Bid Openings Completed'}
              </div>
              <p className="kpi-card-desc">{item.desc}</p>
              <div className="kpi-card-action">View Bid Schedule →</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Statutory Public Procurement Policy Compliance (Metrics 11 - 14) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A', fontWeight: 700 }}>
            3. STATUTORY RESERVATIONS &amp; GOVERNMENT MANDATES
          </h3>
          <span className="pill pill-warning">Public Procurement Policy 2012 / CVC</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {KPI_TAB.items.slice(10, 14).map((item) => (
            <div
              key={item.id}
              className="kpi-interactive-card"
              onClick={() => openKpiDetail(item)}
            >
              <div className="kpi-card-code">{item.code}</div>
              <div className="kpi-card-name">{item.name}</div>
              <div className="kpi-card-metric" style={{ color: '#D97706' }}>
                {item.id === 'po_placed_sc_st' && '4.8% (Target 4%)'}
                {item.id === 'po_placed_women_entrepreneur' && '3.6% (Target 3%)'}
                {item.id === 'po_placed_msme' && '28.4% (Target 25%)'}
                {item.id === 'po_placed_gem' && '78.2% (Target 75%)'}
              </div>
              <p className="kpi-card-desc">{item.desc}</p>
              <div className="kpi-card-action">Compliance Audit →</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Turnaround Time & Lead Time SLAs (Metrics 15 - 16) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#0F172A', fontWeight: 700 }}>
            4. TURNAROUND TIMES &amp; PROCUREMENT LEAD TIMES
          </h3>
          <span className="pill pill-neutral">Operational Efficiency</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {KPI_TAB.items.slice(14, 16).map((item) => (
            <div
              key={item.id}
              className="kpi-interactive-card"
              onClick={() => openKpiDetail(item)}
            >
              <div className="kpi-card-code">{item.code}</div>
              <div className="kpi-card-name">{item.name}</div>
              <div className="kpi-card-metric" style={{ color: '#9333EA' }}>
                {item.id === 'time_taken_payment_processing' && '18.4 Days (SLA < 30 Days)'}
                {item.id === 'time_taken_mpr_to_po' && '42 Days (Benchmark 60 Days)'}
              </div>
              <p className="kpi-card-desc">{item.desc}</p>
              <div className="kpi-card-action">View Cycle SLA →</div>
            </div>
          ))}
        </div>
      </div>

      {/* Universal Modal */}
      {activeModalItem && (
        <PortalItemModal
          item={activeModalItem}
          tab={KPI_TAB}
          onClose={() => setActiveModalItem(null)}
        />
      )}
    </section>
  );
}
