import PaymentAdviceNote from './PaymentAdviceNote.jsx';
import RecommendationReport from './RecommendationReport.jsx';

// Read-only document view of a payment advice:
// - At Payment Desk stage before HOD ('at_payment_desk'): Payment Advice → HOD with checklist
// - At HOD Approval ('sent_to_hod') and ALL post-HOD-approval stages ('stamped_by_hod', 'sent_to_cppc', 'paid'):
//   Renders the exact Recommendation Report - CPPC screen visible to HOD, with both official stamps.
const RECO_STAGES = new Set(['sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid']);

export default function PaDocumentView({ pa, role, remarkPanel, actionBar }) {
  const showRecoReport = RECO_STAGES.has(pa.status);

  return (
    <div className="pa-doc-view">
      <div className="pa-doc-toolbar no-print" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>
      <div className="note-print-area">
        {showRecoReport ? <RecommendationReport pa={pa} /> : <PaymentAdviceNote pa={pa} />}
      </div>

      {/* Inline remark panel (desk / HOD can add a remark before acting) */}
      {remarkPanel && <div className="pa-inline-remark no-print">{remarkPanel}</div>}

      {/* Inline action bar */}
      {actionBar && <div className="pa-inline-actions no-print">{actionBar}</div>}
    </div>
  );
}
