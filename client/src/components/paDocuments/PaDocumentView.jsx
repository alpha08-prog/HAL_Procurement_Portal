import PaymentAdviceNote from './PaymentAdviceNote.jsx';
import RecommendationReport from './RecommendationReport.jsx';

// Stages where Recommendation Report - CPPC is the active document:
// 1. At HOD: 'sent_to_hod' (HOD only sees Recommendation Report - CPPC)
// 2. At Payment Desk 2nd time: 'stamped_by_hod' (forwarding to CPPC)
// 3. Sent to CPPC & Paid: 'sent_to_cppc', 'paid'
// Stages where Payment Advice Document is the active document:
// 1. Purchase Officer verification: 'forwarded_to_officer'
// 2. Payment Desk 1st visit: 'at_payment_desk' (checklist verification & forward to HOD)
const RECO_STAGES = new Set(['sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid']);

export default function PaDocumentView({ pa, backPath, remarkPanel, actionBar, officerRemark }) {
  const isRecoDocument = RECO_STAGES.has(pa.status);

  return (
    <div className="pa-doc-view">
      <div className="pa-doc-toolbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-primary, #1e3a8a)' }}>
          {pa.status === 'sent_to_hod'
            ? '📑 Payment Recommendation Report - CPPC (For HOD Approval & Stamp)'
            : pa.status === 'stamped_by_hod'
            ? '📑 Payment Recommendation Report - CPPC (HOD Stamped — For CPPC Dispatch)'
            : pa.status === 'sent_to_cppc' || pa.status === 'paid'
            ? '📑 Payment Recommendation Report - CPPC'
            : pa.status === 'at_payment_desk'
            ? '📄 Payment Advice Document (From Payment Desk to HOD)'
            : pa.status === 'forwarded_to_officer'
            ? '📄 Payment Advice Document (Officer Verification)'
            : '📄 Payment Advice Document'}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>

      <div className="note-print-area">
        {isRecoDocument ? (
          <RecommendationReport pa={pa} />
        ) : (
          <PaymentAdviceNote pa={pa} previewOfficerRemark={officerRemark} />
        )}
      </div>

      {/* Inline remark panel (officer / desk / HOD can add a remark before acting) */}
      {remarkPanel && <div className="pa-inline-remark no-print">{remarkPanel}</div>}

      {/* Inline action bar */}
      {actionBar && <div className="pa-inline-actions no-print">{actionBar}</div>}
    </div>
  );
}


