import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MODAL_ACTIONS } from '../../config/portalStructure.js';
import DopLookup from '../formats/DopLookup.jsx';
import FormatFiller from '../formats/FormatFiller.jsx';
import FormatsLibrary from '../formats/FormatsLibrary.jsx';
import TrackerTable from '../trackers/TrackerTable.jsx';
import LdCalculator from '../tools/LdCalculator.jsx';
import PriceEstimator from '../tools/PriceEstimator.jsx';
import KpiMetricDetailView from './KpiMetricDetailView.jsx';

// The universal Portal Hub modal. What it shows is decided by config: MODAL_ACTIONS in
// config/portalStructure.js maps every `type:'modal'` action to a formats-library entry, a
// tracker, a calculator, the DoP lookup, the library or a KPI card, and the server does the
// rendering/maths behind each. It portals to <body> so printing can isolate the document.
export default function PortalItemModal({ item, tab, onClose, context = null }) {
  useEffect(() => {
    document.body.classList.add('has-portal-modal');
    return () => document.body.classList.remove('has-portal-modal');
  }, []);

  if (!item) return null;
  const spec = MODAL_ACTIONS[item.action];

  return createPortal(
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header no-print">
          <div className="portal-modal-badge">
            {tab.title} &bull; {item.code}
          </div>
          <h2 className="portal-modal-title">{item.name}</h2>
          <p className="portal-modal-desc">{item.desc}</p>
          <button type="button" className="portal-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="portal-modal-body">{renderSpec(spec, item, context)}</div>

        <div className="portal-modal-footer no-print">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// `context` ({requisitionId, contractId, poNo, rvNo}) pre-fills a format from a linked record.
function renderSpec(spec, item, context) {
  if (!spec) {
    return (
      <div className="banner banner-error">
        No tool is wired for action &ldquo;{item.action}&rdquo;. Add it to MODAL_ACTIONS in config/portalStructure.js.
      </div>
    );
  }
  switch (spec.kind) {
    case 'format':
      return <FormatFiller id={spec.id} requisitionId={context?.requisitionId} contractId={context?.contractId} poNo={context?.poNo} rvNo={context?.rvNo} />;
    case 'library':
      return <FormatsLibrary />;
    case 'tracker':
      return <TrackerTable name={spec.name} />;
    case 'calculator':
      return spec.name === 'ld' ? <LdCalculator /> : <PriceEstimator />;
    case 'dop':
      return <DopLookup />;
    case 'kpi':
      return <KpiMetricDetailView item={item} metric={context?.metric ?? null} months={context?.months ?? 6} />;
    default:
      return <div className="banner banner-error">Unknown modal kind &ldquo;{spec.kind}&rdquo;.</div>;
  }
}
