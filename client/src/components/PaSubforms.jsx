import { formatINR } from '../lib/currency.js';

// Screen 2 sub-forms for the doc's securities + attachments blocks. Display-only;
// in the prototype the upload/view actions are placeholders (no real storage).

const SECURITY_ROWS = [
  ['sd', 'SD (5%)'],
  ['pbg', 'PBG (10%)'],
  ['emd', 'EMD'],
  ['indemnity', 'Indemnity Bond']
];

export function SecuritiesPanel({ pa, editable = false, draft, onChange }) {
  const s = pa.securities ?? {};
  // Each security is a green "Fetch/Upload" action in the doc — fetched from IFS or
  // the EMD portal. Placeholder only; document storage is not wired in the prototype.
  const fetchAct = (label, present) =>
    window.alert(
      `${present ? 'Viewing' : 'Fetching / uploading'} "${label}" — prototype only; pulls from IFS / EMD portal in production.`
    );
  const remarkValue = draft ? draft.securitiesRemark ?? '' : pa.securitiesRemark ?? '';
  return (
    <div>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Security</th>
            <th>Applicable</th>
            <th className="align-right">Amount</th>
            <th>On Hold</th>
            <th>Copy Enclosed</th>
            <th>Fetch / Upload</th>
          </tr>
        </thead>
        <tbody>
          {SECURITY_ROWS.map(([key, label]) => {
            const v = s[key] ?? {};
            const present = v.copyEnclosed === 'Yes';
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{v.applicable ?? 'NA'}</td>
                <td className="align-right num">{v.amount != null ? formatINR(v.amount) : '—'}</td>
                <td>{v.onHold ? 'Yes' : 'No'}</td>
                <td>{v.copyEnclosed ?? 'No'}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => fetchAct(label, present)}>
                    {present ? 'View' : 'Fetch / Upload'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="field field-wide">
        <div className="field-label">Remark for amount against SD / PBG on hold etc.</div>
        {editable ? (
          <>
            <textarea
              className="field-input"
              rows={2}
              value={remarkValue}
              onChange={(e) => onChange?.('securitiesRemark', e.target.value)}
            />
            <div className="remark-options">
              {['SD / PBG verified and available in division.', 'Security deposit waived per PO terms.', 'PBG submission verified.'].map((option) => (
                <button
                  type="button"
                  className="remark-option"
                  key={option}
                  onClick={() => onChange?.('securitiesRemark', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="field-value">{pa.securitiesRemark || '—'}</div>
        )}
      </div>
    </div>
  );
}

const ATTACHMENTS = [
  ['rvCopy', 'RV Copy'],
  ['invoice', 'Invoice'],
  ['ftr', 'FTR'],
  ['warranty', 'Warranty Certificate'],
  ['bankChange', 'Revised Bank Details']
];

export function AttachmentsPanel({ pa, editable }) {
  const a = pa.attachments ?? {};
  const act = (label, present) =>
    window.alert(
      `${present ? 'Viewing' : 'Uploading'} "${label}" — prototype only, document storage is not wired.`
    );
  return (
    <div>
      <div className="attach-grid">
        {ATTACHMENTS.map(([key, label]) => {
          const present = a[key] === 'Yes';
          return (
            <div className="attach-item" key={key}>
              <span className="attach-label">{label}</span>
              <span className={`pill ${present ? 'pill-success' : 'pill-warning'}`}>
                {present ? 'Enclosed' : 'Pending'}
              </span>
              <button className="btn btn-secondary" onClick={() => act(label, present)}>
                {present ? 'View' : editable ? 'Upload' : '—'}
              </button>
            </div>
          );
        })}
      </div>
      {(pa.bankMismatch === true || pa.bankMismatch === 'Yes') && (
        <div className="banner banner-info">
          Bank details differ between PO and invoice — revised bank details / vendor confirmation
          enclosed for approval.
        </div>
      )}
      <div className="attach-extra">
        <button className="btn btn-secondary" onClick={() => act('Intimation letter (SSL / staggered delivery)', false)}>
          Upload intimation letter (SSL)
        </button>
        <button className="btn btn-secondary" onClick={() => act('SD / PBG / EMD copy', false)}>
          Fetch from EMD portal
        </button>
      </div>
    </div>
  );
}
