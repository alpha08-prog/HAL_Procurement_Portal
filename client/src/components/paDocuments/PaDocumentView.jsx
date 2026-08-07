import { useState } from 'react';
import PaymentAdviceNote from './PaymentAdviceNote.jsx';
import RecommendationReport from './RecommendationReport.jsx';

// Read-only document view of a payment advice, rendered in the two HAL house-style
// formats with a toggle between them. Role-aware: the "Payment Advice → HOD" tab
// (with checklist) is shown ONLY to hod_imm / admin. Everyone else sees only the
// Recommendation Report tab.
//
// Props:
//   pa          – the full joined PA object
//   role        – current user role (string). If omitted, HOD tab is visible.
//   remarkPanel – optional JSX rendered below the document (in-page remark + submit)
//   actionBar   – optional JSX rendered below the remark panel (Stamp & Forward etc.)
const HOD_STAGES = new Set(['sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid']);
const defaultDoc = (pa, canSeeHod) => {
  if (HOD_STAGES.has(pa.status) && canSeeHod) return 'hod';
  return 'reco';
};

export default function PaDocumentView({ pa, role, remarkPanel, actionBar }) {
  const canSeeHod = !role || role === 'hod_imm' || role === 'admin';
  const [doc, setDoc] = useState(() => defaultDoc(pa, canSeeHod));

  return (
    <div className="pa-doc-view">
      <div className="pa-doc-toolbar no-print">
        <div className="pa-doc-toggle" role="tablist">
          <button
            type="button"
            className={'pa-doc-tab' + (doc === 'reco' ? ' active' : '')}
            onClick={() => setDoc('reco')}
          >
            Recommendation Report · Officer → Desk
          </button>
          {canSeeHod && (
            <button
              type="button"
              className={'pa-doc-tab' + (doc === 'hod' ? ' active' : '')}
              onClick={() => setDoc('hod')}
            >
              Payment Advice → HOD · with checklist
            </button>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>
      <div className="note-print-area">
        {doc === 'reco' ? <RecommendationReport pa={pa} /> : <PaymentAdviceNote pa={pa} />}
      </div>

      {/* Inline remark panel (officer / desk / HOD can add a remark before acting) */}
      {remarkPanel && <div className="pa-inline-remark no-print">{remarkPanel}</div>}

      {/* Inline action bar (Stamp & forward / Return / Forward to CPPC buttons) */}
      {actionBar && <div className="pa-inline-actions no-print">{actionBar}</div>}
    </div>
  );
}

