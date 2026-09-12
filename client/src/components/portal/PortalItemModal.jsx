import { useState } from 'react';
import { STANDARD_FORMATS_26 } from '../../config/portalStructure.js';

export default function PortalItemModal({ item, tab, onClose }) {
  if (!item) return null;

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="portal-modal-header">
          <div className="portal-modal-badge">
            {tab.title} &bull; {item.code}
          </div>
          <h2 className="portal-modal-title">{item.name}</h2>
          <p className="portal-modal-desc">{item.desc}</p>
          <button type="button" className="portal-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="portal-modal-body">
          {renderActionContent(item.action || item.id, item)}
        </div>

        {/* Footer */}
        <div className="portal-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / Export
          </button>
        </div>
      </div>
    </div>
  );
}

function renderActionContent(action, item) {
  switch (action) {
    case 'price_estimation':  return <PriceEstimationSheet />;
    case 'ld_calculator':     return <LdCalculatorTool />;
    case 'formats_26_library':return <Formats26Library />;
    case 'pac_certificate':   return <PacCertificateGenerator />;
    case 'single_tender_cert':return <SingleTenderCertGenerator />;
    case 'brand_cert':        return <BrandCertGenerator />;
    case 'adequacy_statement':return <AdequacyStatementGenerator />;
    case 'claim_generator':   return <ClaimGeneratorForm />;
    case 'board_paper':       return <BoardPaperGenerator />;
    case 'proposal_summary':  return <ProposalSummaryView />;
    case 'tender_generator':  return <TenderGeneratorView />;
    case 'indemnity_bond':    return <IndemnityBondView />;
    case 'nda_agreement':     return <NdaAgreementView />;
    case 'non_poaching':      return <NonPoachingView />;
    case 'integrity_pact':    return <IntegrityPactView />;
    case 'adv_bg_format':     return <AdvanceBgView />;
    case 'dop_lookup':        return <DopLookupView />;
    case 'pm_guidelines':     return <PmGuidelinesView />;
    case 'works_manual':      return <WorksManualView />;
    case 'ftr_generator':     return <FtrGeneratorView />;
    default:
      if (action && action.startsWith('kpi_')) return <KpiMetricDetailView metricKey={action} item={item} />;
      return <StandardDocumentPreview item={item} />;
  }
}

/* ── Price Estimation Sheet ── */
function PriceEstimationSheet() {
  const [qty, setQty] = useState(5);
  const [basicRate, setBasicRate] = useState(318813);
  const [basis, setBasis] = useState('LPP');
  const [gstPct, setGstPct] = useState(18);
  const [freight, setFreight] = useState(15000);
  const [inflationPct, setInflationPct] = useState(5);

  const basicTotal   = qty * basicRate;
  const inflationAmt = (basicTotal * inflationPct) / 100;
  const pretax       = basicTotal + inflationAmt;
  const gstAmt       = (pretax * gstPct) / 100;
  const grandTotal   = pretax + gstAmt + Number(freight || 0);

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>PRICE ESTIMATION SHEET (PRE-TENDER)</strong>
        <span>HAL Purchase Manual Cl. 6.4 &amp; DOP-2025</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div>
          <label className="form-label">Basis of Estimation</label>
          <select className="form-input" value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="LPP">Last Purchase Price (LPP)</option>
            <option value="BQ">Budgetary Quotations (Min 3)</option>
            <option value="GeM">GeM Portal Indicative Rate</option>
            <option value="Inhouse">In-house Cost Estimate</option>
          </select>
        </div>
        <div>
          <label className="form-label">Quantity</label>
          <input type="number" className="form-input" value={qty} min="1" onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">Unit Basic Rate (₹)</label>
          <input type="number" className="form-input" value={basicRate} onChange={(e) => setBasicRate(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">Escalation Index (%)</label>
          <input type="number" className="form-input" value={inflationPct} onChange={(e) => setInflationPct(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">GST Rate (%)</label>
          <input type="number" className="form-input" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">Freight &amp; Insurance (₹)</label>
          <input type="number" className="form-input" value={freight} onChange={(e) => setFreight(Number(e.target.value))} />
        </div>
      </div>

      <table className="portal-mini-table">
        <thead>
          <tr><th>Element</th><th>Formula</th><th style={{ textAlign:'right' }}>Amount (₹)</th></tr>
        </thead>
        <tbody>
          <tr><td>Basic Price</td><td>{qty} × ₹{basicRate.toLocaleString('en-IN')}</td><td style={{ textAlign:'right', fontWeight:600 }}>₹{basicTotal.toLocaleString('en-IN')}</td></tr>
          <tr><td>Escalation ({inflationPct}%)</td><td>On Basic</td><td style={{ textAlign:'right' }}>₹{inflationAmt.toLocaleString('en-IN')}</td></tr>
          <tr><td>GST ({gstPct}%)</td><td>On Pre-tax base</td><td style={{ textAlign:'right' }}>₹{gstAmt.toLocaleString('en-IN')}</td></tr>
          <tr><td>Freight &amp; Insurance</td><td>FOR HAL Nashik</td><td style={{ textAlign:'right' }}>₹{Number(freight||0).toLocaleString('en-IN')}</td></tr>
          <tr style={{ fontWeight:700, background:'var(--accent-soft)' }}>
            <td>Total Estimated Cost</td><td>Pre-Tender Estimate</td>
            <td style={{ textAlign:'right', color:'var(--accent)', fontSize:15 }}>₹{grandTotal.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── LD Calculator ── */
function LdCalculatorTool() {
  const [poValue, setPoValue]           = useState(1594065);
  const [supplyWeeks, setSupplyWeeks]   = useState(3);
  const [icWeeks, setIcWeeks]           = useState(0);

  const rate      = 0.005;
  const rawLd     = poValue * rate * (supplyWeeks + icWeeks);
  const maxLd     = poValue * 0.1;
  const cappedLd  = Math.min(rawLd, maxLd);
  const isCapped  = rawLd > maxLd;
  const netPayable= Math.max(0, poValue - cappedLd);

  return (
    <div className="doc-section">
      <div className="doc-banner">
        <strong>LIQUIDATED DAMAGES (LD) COMPUTATION DESK</strong>
        <span>PM Cl. 16.2 — 0.5% / week, max 10%</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <div>
          <label className="form-label">PO Value (₹)</label>
          <input type="number" className="form-input" value={poValue} onChange={(e) => setPoValue(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">Supply Delay (weeks)</label>
          <input type="number" className="form-input" value={supplyWeeks} min="0" onChange={(e) => setSupplyWeeks(Number(e.target.value))} />
        </div>
        <div>
          <label className="form-label">I&amp;C Delay (weeks)</label>
          <input type="number" className="form-input" value={icWeeks} min="0" onChange={(e) => setIcWeeks(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Computed LD</div>
          <div className="kpi-card-val">₹{rawLd.toLocaleString('en-IN')}</div>
          <span className="kpi-card-sub">0.5% × {supplyWeeks + icWeeks} weeks</span>
        </div>
        <div className="kpi-card-box" style={{ borderColor: isCapped ? 'var(--danger-fg)' : 'var(--border)' }}>
          <div className="kpi-card-lbl">10% Ceiling</div>
          <div className="kpi-card-val" style={{ color: isCapped ? 'var(--danger-fg)' : 'var(--accent)' }}>₹{maxLd.toLocaleString('en-IN')}</div>
          <span className="kpi-card-sub">{isCapped ? '⚠ Capped' : 'Within limit'}</span>
        </div>
        <div className="kpi-card-box" style={{ background:'var(--success-bg)' }}>
          <div className="kpi-card-lbl" style={{ color:'var(--success-fg)' }}>Net Deductible</div>
          <div className="kpi-card-val" style={{ color:'var(--success-fg)' }}>₹{cappedLd.toLocaleString('en-IN')}</div>
          <span className="kpi-card-sub" style={{ color:'var(--success-fg)' }}>Net Payable: ₹{netPayable.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>
        LD is recovered from the Receipt Voucher payment advice automatically. Formula: 0.5% per week or part thereof, ceiling 10% of total PO value.
      </p>
    </div>
  );
}

/* ── 26 Standard Formats Library ── */
function Formats26Library() {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(STANDARD_FORMATS_26[0]);

  const filtered = STANDARD_FORMATS_26.filter((f) =>
    `${f.title} ${f.code} ${f.category}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16, height:460 }}>
      <div style={{ borderRight:'1px solid var(--border)', paddingRight:12, overflowY:'auto' }}>
        <input type="text" className="form-input" placeholder="Search formats…" style={{ marginBottom:10 }}
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        {filtered.map((fmt) => (
          <button key={fmt.id} type="button"
            onClick={() => setSelected(fmt)}
            style={{
              display:'block', width:'100%', textAlign:'left', padding:'8px 10px', marginBottom:4,
              borderRadius:6, border:'1px solid', cursor:'pointer',
              borderColor: selected.id === fmt.id ? 'var(--accent)' : 'var(--border)',
              background:  selected.id === fmt.id ? 'var(--accent-soft)' : 'var(--surface)'
            }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>{fmt.code}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginTop:2 }}>{fmt.title}</div>
          </button>
        ))}
      </div>

      <div style={{ overflowY:'auto' }}>
        <div className="doc-banner">
          <strong>{selected.code}</strong><span>{selected.annexure} · {selected.category}</span>
        </div>
        <h3 style={{ margin:'0 0 8px', fontSize:15 }}>{selected.title}</h3>
        <div style={{ fontSize:12, lineHeight:1.7, color:'var(--text)', background:'var(--bg)', padding:14, borderRadius:6 }}>
          <p><strong>HINDUSTAN AERONAUTICS LIMITED — NASHIK DIVISION</strong></p>
          <p>Ref: {selected.code} / HAL-NSK / IMM / 2025-26</p>
          <hr style={{ margin:'10px 0', borderColor:'var(--border)' }} />
          <p>This proforma is the mandatory standardised format prescribed under HAL Purchase Manual (Issue-4) and DOP-2025 for all documentation pertaining to <em>{selected.title}</em>.</p>
          <blockquote style={{ borderLeft:'3px solid var(--accent)', padding:'8px 12px', margin:'10px 0', fontStyle:'italic', background:'var(--accent-soft)', borderRadius:'0 4px 4px 0' }}>
            "Certified that all procurement actions documented herein strictly adhere to CVC guidelines, GeM GTC, HAL Purchase Manual, and statutory reservations for MSEs and Make in India."
          </blockquote>
        </div>
      </div>
    </div>
  );
}

/* ── Simple static format previews ── */
const staticDoc = (title, clause, content) => () => (
  <div className="doc-section">
    <div className="doc-banner"><strong>{title}</strong><span>{clause}</span></div>
    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:14, fontSize:13, lineHeight:1.65 }}>
      {content}
    </div>
  </div>
);

const PacCertificateGenerator = staticDoc(
  'PROPRIETARY ARTICLE CERTIFICATE (PAC)', 'GFR Rule 166 / HAL PM Cl. 7.3',
  <>
    <p>1. The indented goods are manufactured by <strong>M/s Original Equipment Manufacturer (OEM)</strong>.</p>
    <p>2. No alternative make or model is acceptable due to:</p>
    <ul><li>Critical compatibility with existing aircraft avionics / airframe systems.</li>
        <li>Proprietary tooling, manufacturing rights and type certifications held exclusively by OEM.</li>
        <li>Warranties and airworthiness clearances invalid with substitutions.</li></ul>
    <p>3. Concurrence of Finance and CFA approval (DOP Annex-2) obtained.</p>
  </>
);

const SingleTenderCertGenerator = staticDoc(
  'SINGLE TENDER ENQUIRY (STE) CERTIFICATE', 'GFR Rule 166 / HAL PM Cl. 7.4',
  <p>Certified that STE procurement is justified: the source is the sole designer / manufacturer holding proprietary rights. Rates verified against LPP and cost breakdown. Full CVC compliance confirmed.</p>
);

const BrandCertGenerator = staticDoc(
  'STANDARDIZATION / MAKE & BRAND CERTIFICATE', 'DOP-2025 Standard Terms',
  <p>Certified that procurement of the specific brand is required to maintain standardisation with existing plant, machinery and testing equipment at Aircraft Overhaul Division, HAL Nashik.</p>
);

const AdequacyStatementGenerator = staticDoc(
  'ADEQUACY OF PROVISIONING STATEMENT', 'Material Planning Scrutiny',
  <>
    <p>1. Present stock in stores: <strong>2 Units</strong></p>
    <p>2. Dues-in against earlier POs: <strong>0 Units</strong></p>
    <p>3. Average annual consumption (3 yrs): <strong>8 Units / year</strong></p>
    <p>4. Net requirement indented: <strong>5 Units</strong> — adequate for 9 months.</p>
  </>
);

const TenderGeneratorView = staticDoc(
  'TENDER DOCUMENT GENERATOR', 'HAL e-Procurement & GeM GTC',
  <>
    <p>Compiles complete tender specifications including:</p>
    <ul>
      <li>Annexure A: Technical Specifications &amp; Parameters</li>
      <li>Annexure B: Commercial Terms (FOR HAL Nashik, 30-day payment, 0.5%/week LD)</li>
      <li>Annexure C: 5% SD / 10% PBG Bank Guarantee Proformas</li>
      <li>Annexure D: Make in India &amp; MSE Reservation Clauses</li>
    </ul>
  </>
);

const IndemnityBondView = staticDoc(
  'PROFORMA INDEMNITY BOND', 'Indian Contract Act 1872 & HAL STC',
  <p>Know all men by these presents that we, the Contractor / PSU Supplier, do hereby bind ourselves to indemnify and hold harmless Hindustan Aeronautics Limited against any claims, losses, or third-party infringements arising out of the performance of the purchase agreement.</p>
);

const NdaAgreementView = staticDoc(
  'MUTUAL NON-DISCLOSURE AGREEMENT', 'HAL Nashik / Contractor',
  <p>Confidentiality agreement binding both HAL and the prospective contractor regarding proprietary aircraft drawings, specifications, tolerances and production secrets for the duration of the contract and 3 years thereafter.</p>
);

const NonPoachingView = staticDoc(
  'NON-POACHING UNDERTAKING', 'HAL Standard Employment Covenant',
  <p>The contractor agrees not to solicit, recruit, or employ any HAL engineer, technician, or employee engaged in the technical execution of this contract during its validity and for 24 months thereafter.</p>
);

const IntegrityPactView = staticDoc(
  'INTEGRITY PACT (IEM)', 'CVC Guidelines — Contracts &gt; ₹5 Cr',
  <p>Statutory commitment monitored by Independent External Monitors (IEM) appointed by HAL, ensuring transparency in procurement above the specified threshold value.</p>
);

const AdvanceBgView = staticDoc(
  'ADVANCE PAYMENT BANK GUARANTEE FORMAT', 'HAL STC Cl. 14',
  <p>Standard bank guarantee proforma covering 110% of the advance amount released, valid until final delivery and acceptance of all contracted material at HAL Nashik stores.</p>
);

const BoardPaperGenerator = staticDoc(
  'BOARD PAPER — HIGH VALUE PROCUREMENT', 'CMD / Board of Directors Approval',
  <>
    <h4 style={{ margin:'0 0 8px' }}>AGENDA: Procurement of Critical Avionics for Aircraft Overhaul Program</h4>
    <p><strong>Estimated Outlay:</strong> ₹18.45 Crore</p>
    <p><strong>Justification:</strong> Meets statutory operational readiness commitments for Indian Air Force fleet support.</p>
    <p><strong>Recommendation:</strong> Board approval sought for floating Global e-Tender on GeM with 10% PBG and 5% SD provisions.</p>
  </>
);

const ProposalSummaryView = () => (
  <div className="doc-section">
    <div className="doc-banner"><strong>EXECUTIVE SUMMARY OF PROPOSAL</strong><span>CFA Concurrence Sheet</span></div>
    <table className="portal-mini-table">
      <tbody>
        <tr><td><strong>Enquiry / Tender No</strong></td><td>GEM/2025/B/6638737</td><td><strong>Requisition</strong></td><td>CAR/25/229</td></tr>
        <tr><td><strong>Recommended Vendor</strong></td><td>M/s Precitex Instruments Pvt Ltd</td><td><strong>Bid System</strong></td><td>Two Bid</td></tr>
        <tr><td><strong>L1 Quoted Value</strong></td><td>₹20,00,000</td><td><strong>Negotiated Value</strong></td><td>₹15,94,065</td></tr>
        <tr><td><strong>Net Savings Achieved</strong></td><td colSpan={3} style={{ color:'var(--success-fg)', fontWeight:700 }}>₹4,05,935 (20.3% via PNC)</td></tr>
      </tbody>
    </table>
  </div>
);

const FtrGeneratorView = staticDoc(
  'FINAL TEST REPORT (FTR) & QC ACCEPTANCE CERTIFICATE', 'HAL Quality Inspection Manual Cl. 9',
  <p>Certifies that incoming materials under RV have successfully passed laboratory chemical, mechanical and dimensional inspections and are accepted for aircraft installation at HAL Nashik Division.</p>
);

const DopLookupView = () => (
  <div className="doc-section">
    <div className="doc-banner"><strong>DOP-2025 THRESHOLD LOOKUP MATRIX</strong><span>HAL Nashik Division</span></div>
    <table className="portal-mini-table">
      <thead><tr><th>Competent Financial Authority (CFA)</th><th>Open / GeM Tender</th><th>Limited Tender</th><th>Single Tender / PAC</th></tr></thead>
      <tbody>
        <tr><td>General Manager (GM)</td><td>Up to ₹50 Crore</td><td>Up to ₹10 Crore</td><td>Up to ₹2.5 Crore</td></tr>
        <tr><td>AGM (IMM / Production)</td><td>Up to ₹10 Crore</td><td>Up to ₹2 Crore</td><td>Up to ₹50 Lakh</td></tr>
        <tr><td>Chief Manager (CM-IMM)</td><td>Up to ₹2 Crore</td><td>Up to ₹50 Lakh</td><td>Up to ₹10 Lakh</td></tr>
        <tr><td>Senior Manager / Manager</td><td>Up to ₹50 Lakh</td><td>Up to ₹10 Lakh</td><td>Up to ₹2 Lakh</td></tr>
      </tbody>
    </table>
  </div>
);

const PmGuidelinesView = staticDoc(
  'HAL PURCHASE MANUAL (ISSUE-4) CHAPTER REFERENCE', 'HAL PM 2024',
  <ul style={{ fontSize:13, lineHeight:1.8, paddingLeft:20 }}>
    <li><strong>Chapter 6:</strong> Requisitions &amp; Pre-Tender Cost Estimations</li>
    <li><strong>Chapter 7:</strong> Mode of Tendering (Open, Limited, Single, PAC)</li>
    <li><strong>Chapter 8:</strong> Bid Opening, TEC &amp; Price Negotiation (PNC)</li>
    <li><strong>Chapter 12:</strong> Purchase Orders, Standard Terms &amp; 72 STC</li>
    <li><strong>Chapter 16:</strong> Delivery Period Extensions, LD &amp; Contract Amendments</li>
  </ul>
);

const WorksManualView = staticDoc(
  'MATERIAL PLANNING, OUTSOURCING & WORKS MANUAL', 'HAL IMM Division',
  <p style={{ fontSize:13 }}>Provides guidelines on subcontracting, sheet metal and machining outsourcing contracts, raw material reconciliation, scrap allowances and turnkey facility work orders.</p>
);

/* ── Claim Generator Form ── */
function ClaimGeneratorForm() {
  const [poNo,   setPoNo]   = useState('PO/2025/1104');
  const [rvNo,   setRvNo]   = useState('RV-2026-0042');
  const [vendor, setVendor] = useState('M/s Precitex Instruments Pvt Ltd');
  const [reason, setReason] = useState('Rejection at Inward Inspection (Dimensional Discrepancy)');
  const [qty,    setQty]    = useState(1);

  return (
    <div className="doc-section">
      <div className="doc-banner"><strong>DISCREPANCY &amp; WARRANTY CLAIM INITIATION FORM</strong><span>HAL QC Manual Cl. 9.1</span></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:14 }}>
        <div><label className="form-label">Purchase Order No.</label><input type="text" className="form-input" value={poNo} onChange={(e) => setPoNo(e.target.value)} /></div>
        <div><label className="form-label">Receipt Voucher (RV) Reference</label><input type="text" className="form-input" value={rvNo} onChange={(e) => setRvNo(e.target.value)} /></div>
        <div><label className="form-label">Vendor Name</label><input type="text" className="form-input" value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
        <div><label className="form-label">Claim Quantity</label><input type="number" className="form-input" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label className="form-label">Nature of Discrepancy</label>
        <select className="form-input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option>Rejection at Inward Inspection (Dimensional Discrepancy)</option>
          <option>Transit Damage during Shipment</option>
          <option>Shortage in Received Consignment</option>
          <option>Failure during Operational Testing (Warranty Claim)</option>
        </select>
      </div>
      <p style={{ fontSize:12, color:'var(--muted)', background:'var(--warning-bg)', borderRadius:6, padding:'10px 12px', margin:0 }}>
        <strong>Action:</strong> Raising this claim will freeze the payment advice for {vendor} and generate a Returnable Material Gate Pass (RMGP) for dispatch.
      </p>
    </div>
  );
}

/* ── KPI Metric Detail ── */
function KpiMetricDetailView({ metricKey, item }) {
  const kpiData = {
    kpi_mis_report:             { stat: '₹142.8 Cr', sub: 'YTD FY 2025-26 Procurement',   trend: '+14.2% YoY' },
    kpi_mpr_received:           { stat: '48 MPRs',   sub: 'Avg 42/month across 6 depts',   trend: '+8% vs last month' },
    kpi_mpr_converted:          { stat: '41 Orders', sub: 'Conversion Rate: 85.4%',          trend: 'Healthy' },
    kpi_mpr_outstanding:        { stat: '7 Pending', sub: 'Avg age: 14 days',                trend: 'Within SLA (<21 days)' },
    kpi_po_start_month:         { stat: '112 POs',   sub: 'Carried from previous cycle',     trend: 'Under expediting' },
    kpi_po_placed:              { stat: '₹18.42 Cr', sub: '38 Purchase Orders',              trend: '+22.5% vs target' },
    kpi_po_closed:              { stat: '₹14.90 Cr', sub: '34 orders delivered & inspected', trend: 'Cycle complete' },
    kpi_po_end_month:           { stat: '116 POs',   sub: 'Closing backlog',                 trend: 'Adequate capacity' },
    kpi_tenders_floated:        { stat: '29 Enquiries', sub: '24 GeM, 5 e-Proc',            trend: 'High competition' },
    kpi_tenders_opened:         { stat: '27 Openings',  sub: 'On schedule',                  trend: 'Zero delay' },
    kpi_sc_st:                  { stat: '4.8%',       sub: 'Target: 4.0%',                   trend: 'Compliant ✓' },
    kpi_women_ent:              { stat: '3.6%',       sub: 'Target: 3.0%',                   trend: 'Compliant ✓' },
    kpi_msme:                   { stat: '28.4%',      sub: 'Target: 25.0%',                  trend: 'Compliant ✓' },
    kpi_gem:                    { stat: '78.2%',      sub: 'Target: >75%',                   trend: 'Gold Standard' },
    kpi_payment_time:           { stat: '18.4 Days',  sub: 'RV → CPPC (SLA <30 days)',       trend: 'SLA Achieved' },
    kpi_mpr_po_time:            { stat: '42 Days',    sub: 'Indent → PO (Benchmark 60 days)','trend': '18 days ahead' }
  };
  const d = kpiData[metricKey] || { stat: '—', sub: item.desc, trend: 'Live metric' };

  return (
    <div className="doc-section">
      <div className="doc-banner"><strong>KPI ENGINE: {item.code}</strong><span>AOD Nashik · FY 2025-26</span></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:16 }}>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Current Value</div>
          <div className="kpi-card-val">{d.stat}</div>
          <span className="kpi-card-sub">{d.trend}</span>
        </div>
        <div className="kpi-card-box">
          <div className="kpi-card-lbl">Benchmark / Target</div>
          <div className="kpi-card-val" style={{ fontSize:14 }}>Statutory</div>
          <span className="kpi-card-sub">GoI / HAL Guidelines</span>
        </div>
        <div className="kpi-card-box" style={{ background:'var(--success-bg)' }}>
          <div className="kpi-card-lbl" style={{ color:'var(--success-fg)' }}>Audit Status</div>
          <div className="kpi-card-val" style={{ color:'var(--success-fg)', fontSize:14 }}>Verified</div>
          <span className="kpi-card-sub" style={{ color:'var(--success-fg)' }}>Integrated — IFS-ERP</span>
        </div>
      </div>
      <p style={{ fontSize:12, color:'var(--muted)', margin:0 }}>{d.sub}</p>
    </div>
  );
}

/* ── Generic fallback ── */
function StandardDocumentPreview({ item }) {
  return (
    <div className="doc-section">
      <div className="doc-banner"><strong>{item.name}</strong><span>{item.code}</span></div>
      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:14, fontSize:13, lineHeight:1.6 }}>
        <p>{item.desc}</p>
        <p>This format is integrated into the HAL Nashik Procurement Portal workflow engine and synchronises with the backend database, IFS-ERP and the e-File noting cascade.</p>
      </div>
    </div>
  );
}
