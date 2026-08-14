import { useState } from 'react';
import PaymentAdviceNote from './PaymentAdviceNote.jsx';
import RecommendationReport from './RecommendationReport.jsx';

// Stages where Recommendation Report - CPPC is applicable (Payment Desk & HOD workflow)
const RECO_STAGES = new Set(['sent_to_hod', 'stamped_by_hod', 'sent_to_cppc', 'paid']);
const RECO_ROLES = new Set(['payment_desk', 'hod_imm', 'admin']);

export default function PaDocumentView({ pa, role, backPath, remarkPanel, actionBar, officerRemark }) {
  // Recommendation Report is ONLY allowed for HOD and Payment Desk (and admin)
  const isDeskOrHodStage = pa.status === 'at_payment_desk' || RECO_STAGES.has(pa.status);
  const isDeskOrHodPath = backPath === '/process-payment' || backPath === '/hod-approval';
  const isDeskOrHodRole = RECO_ROLES.has(role);

  const canViewReco = (isDeskOrHodRole || isDeskOrHodPath) && isDeskOrHodStage;

  const defaultReco = canViewReco && RECO_STAGES.has(pa.status);
  const [docType, setDocType] = useState(null);
  const showReco = canViewReco && (docType ? docType === 'reco' : defaultReco);

  return (
    <div className="pa-doc-view">
      <div className="pa-doc-toolbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        {canViewReco ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={!showReco ? 'btn btn-inline' : 'btn btn-secondary btn-inline'}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setDocType('advice')}
            >
              📄 Payment Advice Document
            </button>
            <button
              type="button"
              className={showReco ? 'btn btn-inline' : 'btn btn-secondary btn-inline'}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={() => setDocType('reco')}
            >
              📑 Recommendation Report (CPPC)
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-subtle, #475569)' }}>
            📄 Stamped Payment Advice Document
          </div>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Download / Print
        </button>
      </div>
      <div className="note-print-area">
        {showReco ? (
          <RecommendationReport pa={pa} previewOfficerRemark={officerRemark} />
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
