// Column configs + shared enums for Module C (noting) grids. Screens compose DataGrid
// with these — columns are never defined inline in a screen.
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/date.js';

export const UNIT_KIND_LABEL = {
  corporate: 'Corporate Office',
  complex: 'Complex',
  division: 'Division',
  department: 'Department',
  section: 'Section'
};

export const REFERENCE_KINDS = ['MPR', 'CAR', 'SPR', 'CPR', 'standalone'];

export const CLASSIFICATIONS = [
  { id: 'normal', label: 'Normal' },
  { id: 'restricted', label: 'Restricted' },
  { id: 'confidential', label: 'Confidential' },
  { id: 'secret', label: 'Secret' },
  { id: 'top_secret', label: 'Top Secret' }
];
export const clsLabel = (id) => CLASSIFICATIONS.find((c) => c.id === id)?.label || id;

export const NOTE_STATUS_LABEL = {
  draft: 'Draft',
  in_check: 'In Check',
  routed: 'Routed',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed'
};

export const ROUTE_ACTION_LABEL = {
  forward: 'Forwarded',
  send_back: 'Sent back',
  approve: 'Approved',
  reject: 'Rejected',
  retrieve: 'Retrieved',
  check: 'Sent for check'
};

export function ClassificationBadge({ value }) {
  return <span className={`tag tag-cls-${value}`}>{clsLabel(value)}</span>;
}

export function StatusBadge({ value }) {
  return <span className={`tag tag-note-${value}`}>{NOTE_STATUS_LABEL[value] || value}</span>;
}

export const MEMBER_COLUMNS = [
  { key: 'pb', label: 'PB No' },
  { key: 'name', label: 'Member' },
  { key: 'grade', label: 'Grade', render: (r) => r.grade || '—' },
  { key: 'designation', label: 'Designation' },
  { key: 'unit', label: 'Unit', render: (r) => r.unit_path || r.unit || '—' },
  { key: 'parent_unit', label: 'Under', render: (r) => r.parent_unit || '—' },
  { key: 'heads_unit', label: 'Heads', render: (r) => r.heads_unit || '—' }
];

export const FILE_COLUMNS = [
  {
    key: 'file_id',
    label: 'File ID',
    render: (r) => <Link to={`/noting/note/${r.first_txn}`}>{r.file_id}</Link>
  },
  { key: 'title', label: 'Title' },
  { key: 'kind', label: 'Type', render: (r) => (r.standalone ? 'Standalone' : r.kind) },
  { key: 'car_no', label: 'Ref.', render: (r) => r.car_no || '—' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'tender_initiator', label: 'Tender initiator', render: (r) => r.tender_initiator || '—' },
  { key: 'classification', label: 'Class.', render: (r) => <ClassificationBadge value={r.classification} /> },
  { key: 'current_stage', label: 'Current stage' },
  { key: 'latest_status', label: 'Status', render: (r) => <StatusBadge value={r.latest_status} /> },
  { key: 'pending_with', label: 'With', render: (r) => r.pending_with || '—' },
  { key: 'note_count', label: 'Stages', align: 'right' }
];

const INCOMING_LABEL = { check: 'To check', forward: 'To act', approve: 'To decide' };

export const PRIORITY_CLASS = { High: 'ef-priority-high', Medium: 'ef-priority-medium', Low: 'ef-priority-low' };
const daysSince = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

// The FLITE-style inbox (server/routes/noting/routing.js /inbox rows).
export const INBOX_COLUMNS = [
  { key: 'days', label: 'Days', align: 'right', render: (r) => <span className={`ef-days-badge${daysSince(r.created_at) > 7 ? ' overdue' : ''}`}>{daysSince(r.created_at)}</span> },
  { key: 'ref_no', label: 'File Ref. No', render: (r) => <Link to={`/noting/note/${r.txn_id}`}>{r.ref_no}</Link> },
  { key: 'initiator_name', label: 'Sender', render: (r) => r.initiator_name || '—' },
  {
    key: 'title',
    label: 'Subject',
    render: (r) => (
      <>
        <Link to={`/noting/note/${r.txn_id}`} className={`subject-link${r.priority === 'High' ? ' urgent' : ''}`}>
          {r.title}
        </Link>
        {r.delegated && <div className="field-hint" style={{ fontSize: 10 }}>held by {r.on_behalf_of_name} — you act as their delegate</div>}
      </>
    )
  },
  { key: 'department', label: 'Initiator dept', render: (r) => r.department || '—' },
  { key: 'created_at', label: 'Received on', render: (r) => formatDate(r.created_at) },
  { key: 'priority', label: 'Priority', render: (r) => <span className={PRIORITY_CLASS[r.priority] || PRIORITY_CLASS.Medium}>{r.priority || 'Medium'}</span> },
  { key: 'incoming_purpose', label: 'Action', render: (r) => INCOMING_LABEL[r.incoming_purpose] || (r.status === 'draft' ? 'Draft' : '—') },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
  { key: 'classification', label: 'Class.', render: (r) => <ClassificationBadge value={r.classification} /> },
  { key: 'clarifications', label: 'Clarifications', align: 'right', render: (r) => `${r.open_clarifications ?? 0} open / ${r.total_clarifications ?? 0}` },
  { key: 'file_id', label: 'File ID', render: (r) => <span className="ef-file-id">#{r.file_id}</span> }
];

// Report columns (Phase 6)
export const LIFECYCLE_COLUMNS = [
  { key: 'file_id', label: 'File ID' },
  { key: 'title', label: 'Title' },
  { key: 'kind', label: 'Type', render: (r) => (r.standalone ? 'Standalone' : r.kind) },
  { key: 'line_no', label: 'Line', render: (r) => r.line_no || '—' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'stage_title', label: 'Current stage' },
  { key: 'note_status', label: 'Status', render: (r) => <StatusBadge value={r.note_status} /> },
  { key: 'notes', label: 'Notes', align: 'right' },
  { key: 'amendments', label: 'PO amds.', align: 'right', render: (r) => r.amendments || '—' },
  { key: 'status', label: 'File', render: (r) => (r.status === 'closed' ? 'Closed' : 'Open') },
  { key: 'elapsed_days', label: 'Elapsed (d)', align: 'right' }
];

export const STAGE_TIME_COLUMNS = [
  { key: 'file_id', label: 'File ID' },
  { key: 'ref_no', label: 'Reference' },
  { key: 'stage_title', label: 'Stage' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'created_at', label: 'Initiated' },
  { key: 'closed_at', label: 'Closed', render: (r) => r.closed_at || '—' },
  { key: 'duration_days', label: 'Duration (d)', align: 'right' },
  { key: 'total_elapsed_days', label: 'Total since prov. (d)', align: 'right', render: (r) => r.total_elapsed_days ?? '—' }
];

export const LIVE_STATUS_COLUMNS = [
  { key: 'file_id', label: 'File ID' },
  { key: 'title', label: 'Title' },
  { key: 'stage_title', label: 'Stage' },
  { key: 'pending_with', label: 'With', render: (r) => r.pending_with || '—' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'tender_initiator', label: 'Tender initiator', render: (r) => r.tender_initiator || '—' },
  { key: 'provisioning_start', label: 'Provisioning', render: (r) => r.provisioning_start || '—' },
  { key: 'days_since_provisioning', label: 'Since prov. (d)', align: 'right', render: (r) => r.days_since_provisioning ?? '—' },
  { key: 'tendering_start', label: 'Tendering', render: (r) => r.tendering_start || '—' },
  { key: 'days_since_tendering', label: 'Since tender (d)', align: 'right', render: (r) => r.days_since_tendering ?? '—' }
];
