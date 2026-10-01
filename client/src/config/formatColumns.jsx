// Column config + labels for the formats library grid (components/formats/FormatsLibrary.jsx).
// Rows are the summaries /api/formats returns; `formatColumns(onOpen)` is a factory because
// the title cell opens the entry and DataGrid columns are otherwise static config.

export const FORMAT_KIND_LABELS = {
  proforma: 'Proforma (BG / bond)',
  certificate: 'Certificate / declaration',
  statement: 'Evaluation statement',
  form: 'Proposal form / checklist',
  agreement: 'Agreement / pact',
  letter: 'Letter',
  reference: 'Reference'
};

export function FormatVerifiedBadge({ verified }) {
  return <span className={`tag ${verified ? 'tag-fmt-verified' : 'tag-fmt-pending'}`}>{verified ? 'HAL document' : 'pending from HAL'}</span>;
}

export const formatColumns = (onOpen) => [
  { key: 'code', label: 'Code', render: (r) => <span className="fmt-code-cell">{r.code}</span> },
  {
    key: 'title',
    label: 'Format',
    render: (r) => (
      <button type="button" className="link-button" onClick={() => onOpen(r.id)}>
        {r.title}
      </button>
    )
  },
  { key: 'kind', label: 'Kind', render: (r) => FORMAT_KIND_LABELS[r.kind] || r.kind },
  { key: 'category', label: 'Category' },
  { key: 'verified', label: 'Source', render: (r) => <FormatVerifiedBadge verified={r.verified} /> },
  { key: 'contractAnnex', label: 'Contract annex', render: (r) => (r.contractAnnex ? 'Yes' : '—') },
  { key: 'fieldCount', label: 'Fields', align: 'right' }
];
