// Column configs for the Module E approvals screens. Client feedback edits this file,
// not the components — same convention as notingColumns.jsx and contractColumns.jsx.
import { Link } from 'react-router-dom';

export const CHAIN_STATUS_PILL = {
  Approved: 'pill-success',
  Rejected: 'pill-danger',
  'In progress': 'pill-info',
  'Not started': 'pill-neutral'
};

// Files moving through an approval chain.
export const CHAIN_COLUMNS = [
  {
    key: 'file_id',
    label: 'File',
    render: (r) => <Link to={`/approvals/chain/${r.id}`}>{r.file_id}</Link>
  },
  { key: 'label', label: 'Note' },
  { key: 'agency', label: 'Agency' },
  {
    key: 'division',
    label: 'Unit',
    render: (r) => (r.dept ? `${r.dept} / ${r.division}` : r.division)
  },
  { key: 'case_ref', label: 'Requisition' },
  {
    key: 'hops',
    label: 'Hops',
    render: (r) => (r.hops ? `${r.hops} (${r.lastNote})` : '—')
  },
  {
    key: 'status',
    label: 'Decision',
    render: (r) => (
      <span className={`pill ${CHAIN_STATUS_PILL[r.status] ?? 'pill-neutral'}`}>{r.status}</span>
    )
  },
  {
    key: 'released',
    label: 'Released',
    render: (r) => (
      <span className={`pill ${r.released ? 'pill-success' : 'pill-warning'}`}>
        {r.released ? 'yes' : 'held'}
      </span>
    )
  },
  { key: 'created_by_name', label: 'Started by' }
];

// The personnel directory the chain resolves approvers against.
export const DIRECTORY_COLUMNS = [
  { key: 'pb', label: 'PB No' },
  { key: 'name', label: 'Name' },
  { key: 'grade', label: 'Grade' },
  {
    key: 'gradeLevel',
    label: 'Level',
    align: 'right',
    render: (r) => r.gradeLevel ?? '—'
  },
  { key: 'dept', label: 'Department' },
  { key: 'division', label: 'Unit' }
];

const VERDICT_PILL = {
  Accepted: 'pill-success',
  'REJECTED at EMD': 'pill-danger',
  'REJECTED at TEC': 'pill-warning'
};

// Bidders, with the two decisions that eliminate them and the reason for each.
export const BID_COLUMNS = [
  { key: 'id', label: 'Bid' },
  {
    key: 'name',
    label: 'Bidder',
    render: (r) => (
      <div className="cell-two-line">
        <strong>{r.name}</strong>
        <span className="field-hint">{r.nature} · {r.msme}</span>
      </div>
    )
  },
  { key: 'nic', label: 'NIC' },
  {
    key: 'emd',
    label: 'EMD',
    render: (r) => (
      <span className={`pill ${r.emd === 'Accepted' ? 'pill-success' : 'pill-danger'}`}>
        {r.emd}
      </span>
    )
  },
  {
    key: 'specFailed',
    label: 'Spec NOs',
    render: (r) => (r.specFailed.length ? r.specFailed.join(', ') : '—')
  },
  {
    key: 'landed',
    label: 'Landed value',
    align: 'right',
    render: (r) => (r.landed == null ? '—' : r.landed.toLocaleString('en-IN'))
  },
  {
    key: 'verdict',
    label: 'Verdict',
    render: (r) => (
      <div className="cell-two-line">
        <span className={`pill ${VERDICT_PILL[r.verdict] ?? 'pill-neutral'}`}>{r.verdict}</span>
        <span className="field-hint">{r.verdictReason}</span>
      </div>
    )
  }
];

// Committees (TEC / PNC) awaiting signatures.
export const COMMITTEE_COLUMNS = [
  {
    key: 'note_id',
    label: 'Note',
    render: (r) => <Link to={`/approvals/committee/${r.id}`}>{r.note_id}</Link>
  },
  { key: 'division', label: 'Unit' },
  { key: 'case_ref', label: 'Requisition' },
  {
    key: 'members',
    label: 'Signed',
    render: (r) => `${r.signed ?? 0} of ${r.members}`
  },
  {
    key: 'sourced',
    label: 'Composition',
    render: (r) => (
      <span className={`pill ${r.sourced ? 'pill-info' : 'pill-warning'}`}>
        {r.sourced ? 'from a sample note' : 'named by hand'}
      </span>
    )
  },
  { key: 'created_at', label: 'Created' }
];
