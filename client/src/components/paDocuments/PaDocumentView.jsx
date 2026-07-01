import { useState } from 'react';
import PaymentAdviceNote from './PaymentAdviceNote.jsx';
import RecommendationReport from './RecommendationReport.jsx';

// Read-only document view of a payment advice, rendered in the two HAL house-style
// formats with a toggle between them (mirrors the AI Documents "Full note / New
// section" pattern). Default format follows the lifecycle stage: the officer→desk
// Recommendation Report while at the desk, the desk→HOD Payment Advice once it has
// reached HOD or beyond. Print output is isolated by the .note-print-area rules.
const HOD_STAGES = new Set(['sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid']);
const defaultDoc = (pa) => (HOD_STAGES.has(pa.status) ? 'hod' : 'reco');

export default function PaDocumentView({ pa }) {
  const [doc, setDoc] = useState(() => defaultDoc(pa));

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
          <button
            type="button"
            className={'pa-doc-tab' + (doc === 'hod' ? ' active' : '')}
            onClick={() => setDoc('hod')}
          >
            Payment Advice → HOD · with checklist
          </button>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>
      <div className="note-print-area">
        {doc === 'reco' ? <RecommendationReport pa={pa} /> : <PaymentAdviceNote pa={pa} />}
      </div>
    </div>
  );
}
