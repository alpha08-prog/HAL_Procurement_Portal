// Column config + enums for the requisition register (screens/Provisioning). Rows are what
// /api/requisitions returns: the stored fields plus the server-derived status and links.
// `requisitionColumns(handlers)` is a factory because the row actions need the screen's
// callbacks; DataGrid columns are otherwise static config.
import { Link } from 'react-router-dom';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export const REQUISITION_KINDS = ['MPR', 'CAR', 'CPR', 'SPR'];
export const REQUISITION_KIND_LABEL = {
  MPR: 'Material Purchase Requisition',
  CAR: 'Capital Acquisition Request',
  CPR: 'Consumables Purchase Requisition',
  SPR: 'Service Purchase Requisition'
};

export const REQUISITION_STATUS_TONE = {
  registered: 'neutral',
  checklist_done: 'info',
  provisioning: 'info',
  tendering: 'warning',
  pp_approved: 'warning',
  po_placed: 'success',
  contracted: 'success',
  received: 'success',
  paid: 'success',
  short_closed: 'neutral',
  rejected: 'danger'
};

export function RequisitionStatusBadge({ status, label, evidence }) {
  return (
    <span className={`pill pill-${REQUISITION_STATUS_TONE[status] || 'neutral'}`} title={evidence || undefined}>
      {label || status}
    </span>
  );
}

export function RequisitionLinks({ r }) {
  const f = r.links?.notingFile;
  const c = r.links?.contract;
  return (
    <div className="req-links">
      {f ? (
        <Link to={`/noting/note/${f.last_txn || f.first_txn}`}>{f.file_id}</Link>
      ) : (
        <span className="field-hint">no proposal file</span>
      )}
      {r.tender_no && <span className="field-hint">{r.tender_no}</span>}
      {r.po_no && <span className="field-hint">PO {r.po_no}</span>}
      {c && <Link to={`/contracts/view/${c.id}`}>{c.contract_no}</Link>}
    </div>
  );
}

export const requisitionColumns = ({ onOpen, onNote, onTender }) => [
  {
    key: 'req_no',
    label: 'Requisition',
    render: (r) => (
      <button type="button" className="link-button" onClick={() => onOpen(r)}>
        {r.req_no}
      </button>
    )
  },
  { key: 'kind', label: 'Type', render: (r) => <span className="pill pill-info">{r.kind}</span> },
  {
    key: 'title',
    label: 'Item scope',
    render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.title}</div>
        {r.item_description && <div className="field-hint">{r.item_description}</div>}
        {r.fixture && <span className="tag tag-fmt-pending">fabricated fixture</span>}
      </div>
    )
  },
  { key: 'req_date', label: 'Date', render: (r) => formatDate(r.req_date) },
  { key: 'indentor_name', label: 'Indentor', render: (r) => `${r.indentor_name || '—'}${r.indentor_dept ? ` · ${r.indentor_dept}` : ''}` },
  { key: 'budget_ref', label: 'Budget', render: (r) => r.budget_ref || '—' },
  { key: 'estimate_total', label: 'Estimate', align: 'right', render: (r) => (r.estimate_total == null ? '—' : formatINR(r.estimate_total)) },
  { key: 'status', label: 'Status', render: (r) => <RequisitionStatusBadge status={r.status} label={r.status_label} evidence={r.status_evidence} /> },
  { key: 'links', label: 'Linked records', render: (r) => <RequisitionLinks r={r} /> },
  {
    key: 'actions',
    label: '',
    render: (r) => (
      <div className="req-row-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNote(r)}>
          {r.links?.notingFile ? 'Open note' : 'Initiate note'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onTender(r)}>
          Tender doc
        </button>
      </div>
    )
  }
];

// Fields shown on the detail panel, in order.
export const REQUISITION_DETAIL_FIELDS = [
  ['req_no', 'Requisition no'],
  ['kind', 'Kind'],
  ['req_date', 'Date', 'date'],
  ['reference_no', 'Indentor reference'],
  ['item_description', 'Item'],
  ['part_no', 'Part no'],
  ['quantity_uom', 'Quantity'],
  ['delivery_period', 'Delivery period'],
  ['tendering_type', 'Tendering'],
  ['budget_ref', 'Budget'],
  ['indentor_name', 'Indentor'],
  ['indentor_dept', 'Department'],
  ['estimate_total', 'Estimate (incl. GST)', 'money'],
  ['estimate_basis_label', 'Estimate basis'],
  ['estimate_words', 'Estimate in words'],
  ['dop_clause', 'DoP clause'],
  ['dop_level', 'DoP level'],
  ['tender_no', 'Tender no'],
  ['po_no', 'PO no']
];
