// Column config for the AI procurement cases queue. Client feedback edits this file,
// not the component — same convention as notingColumns.jsx.
import { Link } from 'react-router-dom';

export const AI_CASE_COLUMNS = [
  {
    key: 'caseRef',
    label: 'Requisition',
    render: (r) => (
      <div className="cell-two-line">
        <Link to={`/ai-cases/${r.id}`}>{r.caseRef}</Link>
        <span className="field-hint">{r.title}</span>
      </div>
    )
  },
  {
    key: 'nodeTitle',
    label: 'Where it is',
    render: (r) => (
      <div className="cell-two-line">
        <span>{r.stageNo ? `Stage ${r.stageNo}` : '—'}</span>
        <span className="field-hint">{r.nodeTitle}</span>
      </div>
    )
  },
  {
    key: 'holdingAgency',
    label: 'Held by',
    render: (r) => (
      <span className={`pill ${r.withMe ? 'pill-success' : 'pill-neutral'}`}>
        {r.holdingAgency}{r.withMe ? ' — you' : ''}
      </span>
    )
  },
  {
    key: 'notes',
    label: 'Notes',
    align: 'right',
    render: (r) => (
      <div className="cell-two-line">
        <span>{r.notes}</span>
        <span className="field-hint">{r.lastNote ?? 'none yet'}</span>
      </div>
    )
  },
  {
    key: 'handovers',
    label: 'Hand-overs',
    align: 'right'
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={`pill ${r.status === 'closed' ? 'pill-danger' : 'pill-info'}`}>
        {r.status === 'closed' ? 'Closed' : 'Open'}
      </span>
    )
  },
  {
    key: 'isFixture',
    label: 'Data',
    render: (r) => (r.isFixture
      ? <span className="pill pill-warning">fabricated</span>
      : <span className="pill pill-neutral">sampleData</span>)
  },
  { key: 'createdByName', label: 'Opened by' }
];

export default { AI_CASE_COLUMNS };
