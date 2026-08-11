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

export default function PaymentAdviceNote({ pa }) {
  const bank = pa.vendorBank ?? {};
  const dated = dateReached(pa, 'sent_to_hod') ?? pa.createdDate;
  const checklist = buildChecklist(pa);

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

      <p className="hal-doc-para">
        Invoice(s) received from M/S. <strong>{pa.vendorName}</strong>
        {pa.vendorCity ? `, ${pa.vendorCity}` : ''}, A/C No: {bank.accountNo ?? '—'}, IFSC:{' '}
        {bank.ifsc ?? '—'}. towards the supplies made against the following RV(s)/Invoice(s),
        is/are sent herewith for arranging payment/adjustment, under intimation to this department.
      </p>
      <div className="hal-doc-inline">
        <span>Category : {isMsme(pa) ? 'MSME' : 'NON-MSME'}</span>
      </div>

      <table className="hal-doc-table">
        <thead>
          <tr>
            <th>Sl. No.</th>
            <th>Challan No / RV NO</th>
            <th>Invoice No. &amp; Date / Plan Amount</th>
            <th>Invoice Amount / LD to be Deducted</th>
            <th>Amount Recommended</th>
            <th>Remark</th>
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
            <td className="num">
              {formatAmount(pa.invoiceValue)}
              <br />
              {formatAmount(pa.ldAmount)}
            </td>
            <td className="num">{formatAmount(pa.finalPayment)}</td>
            <td>{pa.makerRemark || ''}</td>
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

      <div className="hal-doc-signs hal-doc-signs-split" style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
        {/* HOD (IMM) Signature & Stamp */}
        {(() => {
          const hodStep = (pa.history ?? []).find((h) => h.action === 'hod_stamp');
          return (
            <div className={'hal-doc-stamp-box' + (hodStep ? ' hal-doc-stamp-signed' : '')} style={{ flex: 1, padding: '14px' }}>
              <div className="hal-doc-stamp-title" style={{ fontWeight: 600, color: 'var(--color-primary, #1e3a8a)', marginBottom: '4px' }}>
                1. HOD (IMM) Approval Signature
              </div>
              {hodStep ? (
                <>
                  <div className="hal-doc-stamp-label">✔ HOD (IMM) — Approved &amp; Stamped</div>
                  <div className="hal-doc-stamp-meta">{hodStep.date} · V. Rao</div>
                  {hodStep.remark && <div className="hal-doc-stamp-remark">"{hodStep.remark}"</div>}
                </>
              ) : (
                <div className="hal-doc-stamp-label hal-doc-stamp-empty">
                  HOD (IMM) — Stamp &amp; Signature
                </div>
              )}
            </div>
          );
        })()}

        {/* Payment Desk Signature & Stamp */}
        {(() => {
          const deskStep = (pa.history ?? []).find((h) => h.action === 'desk_forward_hod' || h.action === 'desk_forward_cppc');
          return (
            <div className={'hal-doc-stamp-box' + (deskStep ? ' hal-doc-stamp-signed' : '')} style={{ flex: 1, padding: '14px' }}>
              <div className="hal-doc-stamp-title" style={{ fontWeight: 600, color: 'var(--color-primary, #1e3a8a)', marginBottom: '4px' }}>
                2. Payment Desk Signature
              </div>
              {deskStep ? (
                <>
                  <div className="hal-doc-stamp-label">✔ Payment Desk — Checked &amp; Stamped</div>
                  <div className="hal-doc-stamp-meta">{deskStep.date} · Neerja Sharma</div>
                  {deskStep.remark && <div className="hal-doc-stamp-remark">"{deskStep.remark}"</div>}
                </>
              ) : (
                <div className="hal-doc-stamp-label hal-doc-stamp-empty">
                  Payment Desk (Neerja Sharma) — Stamp &amp; Signature
                </div>
              )}
            </div>
          );
        })()}
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

