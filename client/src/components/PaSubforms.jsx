import { useEffect, useState } from 'react';
import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';
import { fetchPaFiles, openPaFile, uploadPaFile } from '../lib/paFilesApi.js';

// Screen 2 sub-forms for the securities and attachments blocks. Uploads are real multipart
// files recorded on the advice (server/routes/paFiles.js); "View" streams the stored file.
// "Fetch from IFS / EMD portal" has no connector in the prototype: it shows the IFS-fetched
// facts the advice already carries (from the RV/PO fixture) instead of pretending to pull.

const SECURITY_ROWS = [
  ['sd', 'SD (5%)'],
  ['pbg', 'PBG (10%)'],
  ['emd', 'EMD'],
  ['indemnity', 'Indemnity Bond']
];

function useFiles(pa) {
  const [files, setFiles] = useState(pa?.files ?? {});
  const [err, setErr] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  useEffect(() => {
    if (!pa?.paNo) return;
    fetchPaFiles(pa.paNo).then((d) => setFiles(d.files)).catch(() => {});
  }, [pa?.paNo]);
  const upload = async (key, file) => {
    if (!file) return;
    setBusyKey(key);
    setErr(null);
    try {
      const d = await uploadPaFile(pa.paNo, key, file);
      setFiles(d.files);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyKey(null);
    }
  };
  const view = async (key) => {
    setErr(null);
    try {
      await openPaFile(pa.paNo, key);
    } catch (e) {
      setErr(e.message);
    }
  };
  return { files, err, busyKey, upload, view };
}

function FileCell({ fileKey, files, editable, busyKey, onUpload, onView, labelPending = 'Upload' }) {
  const f = files[fileKey];
  const id = `pa-file-${fileKey}`;
  return (
    <span className="pa-file-cell">
      {f ? (
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onView(fileKey)} title={`${f.name} · SHA-256 ${f.sha256?.slice(0, 12)}… · ${formatDate(f.uploadedAt)}`}>
            View
          </button>
          <span className="field-hint">{f.name}</span>
        </>
      ) : null}
      {editable && (
        <>
          <input type="file" id={id} style={{ display: 'none' }} onChange={(e) => onUpload(fileKey, e.target.files?.[0])} />
          <label htmlFor={id} className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            {busyKey === fileKey ? 'Uploading…' : f ? 'Replace' : labelPending}
          </label>
        </>
      )}
      {!f && !editable && <span className="field-hint">—</span>}
    </span>
  );
}

function IfsFacts({ pa }) {
  const rows = [
    ['PO no / date', `${pa.poNo ?? '—'} · ${formatDate(pa.poDate)}`],
    ['PO value', formatINR(pa.poValue)],
    ['GeM contract', pa.gemContractNo ? `${pa.gemContractNo} · ${formatDate(pa.gemContractDate)}` : '—'],
    ['RV no / date', `${pa.rvNo} · ${formatDate(pa.rvDate)}`],
    ['Gate entry', `${pa.gateEntryNo ?? '—'} · ${formatDate(pa.gateEntryDate)}`],
    ['Contract on file', pa.contractNo ?? 'none'],
    ['Requisition', pa.requisitionNo ?? '—']
  ];
  return (
    <div className="banner banner-info" style={{ marginTop: 8 }}>
      <strong>IFS-fetched facts on this advice</strong> (fixture — no live IFS/EMD connector in the prototype; upload the copy instead):
      <div className="pa-ifs-grid">
        {rows.map(([k, v]) => (
          <span key={k}>
            <span className="field-hint">{k}: </span>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SecuritiesPanel({ pa, editable = false, draft, onChange }) {
  const s = pa.securities ?? {};
  const { files, err, busyKey, upload, view } = useFiles(pa);
  const [showIfs, setShowIfs] = useState(false);
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
            <th>Copy on file</th>
          </tr>
        </thead>
        <tbody>
          {SECURITY_ROWS.map(([key, label]) => {
            const v = s[key] ?? {};
            const fileKey = `security_${key}`;
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{v.applicable ?? 'NA'}</td>
                <td className="align-right num">{v.amount != null ? formatINR(v.amount) : '—'}</td>
                <td>{v.onHold ? 'Yes' : 'No'}</td>
                <td>{files[fileKey] ? 'Yes' : v.copyEnclosed ?? 'No'}</td>
                <td>
                  <FileCell fileKey={fileKey} files={files} editable={editable} busyKey={busyKey} onUpload={upload} onView={view} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="attach-extra">
        <button type="button" className="btn btn-secondary" onClick={() => setShowIfs((v) => !v)}>
          {showIfs ? 'Hide IFS / EMD facts' : 'Fetch from IFS / EMD portal'}
        </button>
      </div>
      {showIfs && <IfsFacts pa={pa} />}
      {err && <div className="banner banner-error">{err}</div>}
      <div className="field field-wide">
        <div className="field-label">Remark for amount against SD / PBG on hold etc.</div>
        {editable ? (
          <>
            <textarea className="field-input" rows={2} value={remarkValue} onChange={(e) => onChange?.('securitiesRemark', e.target.value)} />
            <div className="remark-options">
              {['SD / PBG verified and available in division.', 'Security deposit waived per PO terms.', 'PBG submission verified.'].map((option) => (
                <button type="button" className="remark-option" key={option} onClick={() => onChange?.('securitiesRemark', option)}>
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
  const { files, err, busyKey, upload, view } = useFiles(pa);
  const [showIfs, setShowIfs] = useState(false);
  return (
    <div>
      <div className="attach-grid">
        {ATTACHMENTS.map(([key, label]) => {
          const present = a[key] === 'Yes' || Boolean(files[key]);
          return (
            <div className="attach-item" key={key}>
              <span className="attach-label">{label}</span>
              <span className={`pill ${present ? 'pill-success' : 'pill-warning'}`}>{present ? 'Enclosed' : 'Pending'}</span>
              <FileCell fileKey={key} files={files} editable={editable} busyKey={busyKey} onUpload={upload} onView={view} />
            </div>
          );
        })}
      </div>
      {(pa.bankMismatch === true || pa.bankMismatch === 'Yes') && (
        <div className="banner banner-info">
          Bank details differ between PO and invoice — revised bank details / vendor confirmation enclosed for approval.
        </div>
      )}
      <div className="attach-extra">
        <span className="attach-label">Intimation letter (SSL / staggered delivery)</span>
        <FileCell fileKey="ssl" files={files} editable={editable} busyKey={busyKey} onUpload={upload} onView={view} labelPending="Upload intimation letter" />
        <button type="button" className="btn btn-secondary" onClick={() => setShowIfs((v) => !v)}>
          {showIfs ? 'Hide EMD portal facts' : 'Fetch from EMD portal'}
        </button>
      </div>
      {showIfs && <IfsFacts pa={pa} />}
      {err && <div className="banner banner-error">{err}</div>}
    </div>
  );
}
