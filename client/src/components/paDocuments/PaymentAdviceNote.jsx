// HAL "Payment Advice from Payment Desk to HOD" — the Payment Desk → HOD hand-off
// document, including the 23-point verification checklist. All amounts come from the
// server; the checklist defaults live in config/paChecklist.js.
import { buildChecklist, CHECKLIST_OPTIONS } from '../../config/paChecklist.js';
import { formatAmount } from '../../lib/currency.js';
import { formatDate } from '../../lib/date.js';
import { amountInWords } from '../../lib/amountWords.js';
import { dateReached, isMsme, paymentSlNo } from './docFields.js';

const KV = ({ label, children }) => (
  <div className="hal-doc-kv">
    <span className="hal-doc-k">{label}</span>
    <span className="hal-doc-v">{children}</span>
  </div>
);

const PAYMENT_TYPES = [
  'DIRECT PAYMENT',
  'BALANCE PAYMENT',
  'ADVANCE PAYMENT',
  'TRANSFER OF FUNDS',
  'PAYMENT AGAINST SUPPLIES'
];
const CHECKED_TYPES = new Set(['DIRECT PAYMENT', 'PAYMENT AGAINST SUPPLIES']);

function ChecklistRow({ item }) {
  const opts = item.options ?? CHECKLIST_OPTIONS;
  return (
    <li>
      <div className="hal-doc-check-line">
        <span className="hal-doc-check-n">{item.n}.</span>
        <span className="hal-doc-check-text">{item.text}</span>
        <span className="hal-doc-check-opts">
          {opts.map((o) => (
            <span key={o} className={'hal-doc-opt' + (o === item.value ? ' sel' : '')}>
              {o}
            </span>
          ))}
        </span>
      </div>
      {item.sub && (
        <ul className="hal-doc-check-sub">
          {item.sub.map((s, i) => (
            <li key={i}>
              <span>{s.text}</span>
              <span className="hal-doc-sub-val">
                : {s.type === 'date' ? formatDate(s.value) : s.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PaymentAdviceNote({ pa, previewOfficerRemark }) {
  const bank = pa.vendorBank ?? {};
  const dated = dateReached(pa, 'sent_to_hod') ?? pa.createdDate;
  const checklist = buildChecklist(pa);

  const officerStep = (pa.history ?? []).find((h) => h.action === 'officer_forward');
  const isOfficerStage = pa.status === 'forwarded_to_officer';
  const showOfficerStamp = isOfficerStage || officerStep;

  return (
    <div className="hal-doc">
      <header className="hal-doc-head hal-doc-head-center">
        <img className="hal-doc-logo" src="/hal-logo.jpeg" alt="HAL" />
        <div className="hal-doc-headtext">
          <div className="hal-doc-title">HINDUSTAN AERONAUTICS LIMITED</div>
          <div className="hal-doc-org">Aircraft Division, Nasik.</div>
          <div className="hal-doc-org">Maharashtra - 422 207</div>
        </div>
      </header>

      <div className="hal-doc-band">Division : AOD</div>
      <div className="hal-doc-band hal-doc-band-split">
        <span>Payment Sl No : {paymentSlNo(pa)}</span>
        <span>Dated : {formatDate(dated)}</span>
      </div>

      <div className="hal-doc-cols">
        <div>
          <KV label="PO NO :">{pa.poNo}</KV>
          <KV label="PO Date :">{formatDate(pa.poDate)}</KV>
          <KV label="Paid Count :">0</KV>
        </div>
        <div>
          <KV label="PO VALUE :">{formatAmount(pa.poValue)}</KV>
          <KV label="Cum Pmt :">{formatAmount(0)}</KV>
          <KV label="Currency :">INR</KV>
        </div>
      </div>

      <div className="hal-doc-to">
        <div className="hal-doc-to-lines">
          <div>TO: &nbsp;&nbsp;Payment Group</div>
          <div>Sub: &nbsp;Payment of Suppliers Bills towards</div>
        </div>
        <ul className="hal-doc-types">
          {PAYMENT_TYPES.map((t) => (
            <li key={t}>
              <span className="hal-doc-box">{CHECKED_TYPES.has(t) ? '☑' : '☐'}</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {(() => {
        const effectiveBank = (pa.selectedPaymentBank === 'invoice' && pa.invoiceBank)
          ? pa.invoiceBank
          : (pa.poBank ?? bank);
        return (
          <p className="hal-doc-para">
            Invoice(s) received from M/S. <strong>{pa.vendorName}</strong>
            {pa.vendorCity ? `, ${pa.vendorCity}` : ''}, A/C No: <strong>{effectiveBank.accountNo ?? '—'}</strong>, IFSC:{' '}
            <strong>{effectiveBank.ifsc ?? '—'}</strong> ({effectiveBank.name ?? 'Bank'}). Towards the supplies made against the following RV(s)/Invoice(s),
            is/are sent herewith for arranging payment/adjustment, under intimation to this department.
          </p>
        );
      })()}
      <div className="hal-doc-inline">
        <span>Category : {isMsme(pa) ? 'MSME' : 'NON-MSME'}</span>
      </div>

      <table className="hal-doc-table">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Challan No / RV NO</th>
            <th>Invoice No. &amp; Date / Plan Amount</th>
            <th>RV Amount</th>
            <th>LD Amount to be Deducted</th>
            <th>Amount Recommended</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              {pa.waybillNo ?? '—'}
              <br />
              {pa.rvNo}
            </td>
            <td>
              {pa.invoiceNo} · {formatDate(pa.invoiceDate)}
              <br />
              <span className="num">{formatAmount(pa.poValue)}</span>
            </td>
            <td className="num">{formatAmount(pa.rvValue || pa.invoiceValue)}</td>
            <td className="num">{formatAmount(pa.ldAmount)}</td>
            <td className="num">{formatAmount(pa.finalPayment)}</td>
            <td>{pa.makerRemark || 'NIL'}</td>
          </tr>
        </tbody>
      </table>

      <div className="hal-doc-reco">
        <div>
          Recommended for Payment Rs : <strong>{formatAmount(pa.finalPayment)}</strong>
        </div>
        <div className="hal-doc-words">Inr - {amountInWords(pa.finalPayment)}</div>
      </div>
      <div className="hal-doc-inline">
        <span>Remarks : {pa.makerRemark || 'NIL'}</span>
      </div>

      {pa.bankFootnote && (
        <div
          className="hal-doc-footnote"
          style={{
            margin: '14px 0',
            padding: '10px 14px',
            background: '#eff6ff',
            borderLeft: '4px solid #1d4ed8',
            borderRadius: '4px',
            fontSize: '0.85rem',
            color: '#1e3a8a',
            lineHeight: 1.4
          }}
        >
          <strong>Footnote / Remarks (Bank Details Verification):</strong> {pa.bankFootnote}
        </div>
      )}

      {/* Only Forwarding Officer (Gaurav Sir) Signature & Stamp */}
      <div className="hal-doc-signs" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <div
          className="hal-doc-stamp-box hal-doc-stamp-signed"
          style={{
            minWidth: 320,
            maxWidth: 440,
            padding: '16px 20px',
            border: '2px solid #1e3a8a',
            background: '#f8fafc',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          <div
            className="hal-doc-stamp-title"
            style={{
              fontWeight: 700,
              color: '#1e3a8a',
              marginBottom: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: '4px'
            }}
          >
            <span>🔏 Forwarding Officer Signature &amp; Stamp</span>
            {isOfficerStage && !officerStep && (
              <span style={{ fontSize: 10, background: '#1e3a8a', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                Active / Stamping
              </span>
            )}
          </div>
          <div className="hal-doc-stamp-label" style={{ color: '#15803d', fontWeight: 700, fontSize: '0.95rem' }}>
            ✔ Forwarding Officer — Verified &amp; Signed
          </div>
          <div className="hal-doc-stamp-meta" style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
            <strong>Gaurav Yadav</strong> (Chief Manager &amp; Forwarding Officer, PB-41060)
          </div>
          <div className="hal-doc-stamp-meta" style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Date: {officerStep?.date || formatDate(new Date().toISOString())} · IMM Aircraft Overhaul Division, Nasik
          </div>
          <div
            className="hal-doc-stamp-remark"
            style={{
              fontSize: 11,
              fontStyle: 'italic',
              marginTop: 6,
              padding: '6px 8px',
              background: '#ffffff',
              borderLeft: '3px solid #16a34a',
              color: '#334155'
            }}
          >
            "{previewOfficerRemark || officerStep?.remark || 'Verified against PO terms, RV and Bank verification. Payment recommended.'}"
          </div>
        </div>
      </div>

      <div className="hal-doc-section-label hal-doc-checklist-title">CHECKLIST</div>
      <ol className="hal-doc-checklist">
        {checklist.map((item) => (
          <ChecklistRow key={item.n} item={item} />
        ))}
      </ol>
    </div>
  );
}

