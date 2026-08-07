// HAL "Payment Recommendation Report - CPPC" — the Purchase Officer → Payment Desk
// hand-off document. Renders the PA in the printed IFS format; all amounts come from
// the server, the rest are presentation derivations (see docFields.js).
import { formatAmount } from '../../lib/currency.js';
import { formatDate } from '../../lib/date.js';
import { amountInWords } from '../../lib/amountWords.js';
import { controlNo, delayDays, panFromGstin, vendorEmail } from './docFields.js';

const KV = ({ label, children }) => (
  <div className="hal-doc-kv">
    <span className="hal-doc-k">{label}</span>
    <span className="hal-doc-v">{children}</span>
  </div>
);

const CERTIFICATION = [
  'Documents & Compliances stipulated for release of payment as per terms and conditions of this Purchase Order / Contract and relevant statutes has been ensured.',
  'Invoices presented herewith for release of payment are as per terms and conditions of Purchase Order / Contract and were not advised previously and have been verified.',
  'Liquidated damages / penalties for delayed deliveries and recoveries advised is as per the applicable terms and conditions of Purchase Order / Contract and are in line with applicable rules.',
  'Beneficiary bank details for which payments are advised have been checked and verified.',
  'All payment related documents in original are available in the Division for any audit / inspection.'
];

export default function RecommendationReport({ pa }) {
  const bank = pa.vendorBank ?? {};
  const printedOn = formatDate(new Date().toISOString());
  const delay = delayDays(pa);

  return (
    <div className="hal-doc">
      <header className="hal-doc-head">
        <img className="hal-doc-logo" src="/hal-logo.jpeg" alt="HAL" />
        <div className="hal-doc-headtext">
          <div className="hal-doc-title">Payment Recommendation Report - CPPC</div>
          <div className="hal-doc-org">Hindustan Aeronautics Limited</div>
        </div>
      </header>

      <div className="hal-doc-subhead">
        <span>Division Name : <strong>NASIK</strong></span>
        <span>Print Dt : {printedOn}</span>
      </div>
      <div className="hal-doc-control">Control No : {controlNo(pa)}</div>

      <div className="hal-doc-cols">
        <div>
          <KV label="Supplier Category:">{pa.mseCategory}</KV>
          <KV label="Supplier Name:">{pa.vendorName}</KV>
          <KV label="Supplier ID:">{pa.vendorCode}</KV>
          <KV label="PO No:">{pa.poNo}</KV>
          <KV label="Cumulative Paid:">{formatAmount(0)}</KV>
          <KV label="Amt in Process:">{formatAmount(pa.finalPayment)}</KV>
          <KV label="Mode of Payment:">DIRECT PAYMENT</KV>
          <KV label="Email Id:">{vendorEmail(pa)}</KV>
          <KV label="Entered By:">
            {pa.createdByPb} ({pa.createdByName})
          </KV>
        </div>
        <div>
          <KV label="PO / NS Category:">PURCHASE</KV>
          <KV label="PAN:">{panFromGstin(pa.gstin)}</KV>
          <KV label="GSTIN:">{pa.gstin}</KV>
          <KV label="PO Date:">{formatDate(pa.poDate)}</KV>
          <KV label="PO Value:">{formatAmount(pa.poValue)}</KV>
          <KV label="Open Advance Amt:">{formatAmount(0)}</KV>
        </div>
      </div>

      <div className="hal-doc-section-label">Invoice Details:</div>
      <table className="hal-doc-table">
        <thead>
          <tr>
            <th>SN/PA#</th>
            <th>Invoice No/Date</th>
            <th>RR No / Date</th>
            <th>Inv Amt / RR Val</th>
            <th>Deduction</th>
            <th>Net Amt</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              {pa.invoiceNo}
              <br />
              {formatDate(pa.invoiceDate)}
            </td>
            <td>
              {pa.gateEntryNo}
              <br />
              {formatDate(pa.gateEntryDate)}
            </td>
            <td className="num">
              {formatAmount(pa.invoiceValue)}
              <br />
              {formatAmount(pa.rvValue)}
            </td>
            <td className="num">{formatAmount(pa.ldAmount)}</td>
            <td className="num">{formatAmount(pa.finalPayment)}</td>
          </tr>
        </tbody>
      </table>

      <div className="hal-doc-inline">
        <span>Delivery Details — Scheduled: {formatDate(pa.deliveryDueDate)}</span>
        <span>Actual: {formatDate(pa.receiptDate)}</span>
        <span>Delay in Days: {delay.toFixed(2)}</span>
      </div>
      <div className="hal-doc-inline">
        <span>Deductions: {pa.ldAmount > 0 ? formatAmount(pa.ldAmount) : 'NIL'}</span>
        <span>Enclosures: Original invoice</span>
        <span className="hal-doc-total">Total Net Amt: {formatAmount(pa.finalPayment)}</span>
      </div>

      <div className="hal-doc-reco">
        <div>
          Amount recommended for payment: <strong>INR {formatAmount(pa.finalPayment)}</strong>
        </div>
        <div className="hal-doc-words">INR {amountInWords(pa.finalPayment)}</div>
      </div>

      <div className="hal-doc-cols">
        <div>
          <div className="hal-doc-section-label">PRR Bank Details:</div>
          <KV label="Account No:">{bank.accountNo ?? '—'}</KV>
          <KV label="IFSC Code:">{bank.ifsc ?? '—'}</KV>
          <KV label="Bank:">{bank.name ?? '—'}</KV>
        </div>
        <div>
          <div className="hal-doc-section-label">PO Bank Details:</div>
          <KV label="Account No:">{bank.accountNo ?? '—'}</KV>
          <KV label="IFSC Code:">{bank.ifsc ?? '—'}</KV>
        </div>
      </div>

      <div className="hal-doc-section-label">Certification:</div>
      <ol className="hal-doc-cert">
        {CERTIFICATION.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ol>

      <div className="hal-doc-signs">
        <div className="hal-doc-sign">
          <div className="hal-doc-sign-name">
            {pa.checkingOfficerPbNo || pa.createdByPb} ({pa.createdByName})
          </div>
          <div className="hal-doc-sign-role">(Authorised By)</div>
        </div>
        <div className="hal-doc-sign">
          <div className="hal-doc-sign-name">{pa.poOfficer}</div>
          <div className="hal-doc-sign-role">(Authorised By)</div>
        </div>
      </div>

      {/* Payment Desk stamp block — appears once desk has stamped */}
      {(() => {
        const deskStep = (pa.history ?? []).find((h) => h.action === 'desk_forward_hod');
        return (
          <div className="hal-doc-stamp-row">
            <div className={'hal-doc-stamp-box' + (deskStep ? ' hal-doc-stamp-signed' : '')}>
              {deskStep ? (
                <>
                  <div className="hal-doc-stamp-label">✔ Payment Desk — Checked &amp; Stamped</div>
                  <div className="hal-doc-stamp-meta">{deskStep.date}</div>
                  {deskStep.remark && <div className="hal-doc-stamp-remark">"{deskStep.remark}"</div>}
                </>
              ) : (
                <div className="hal-doc-stamp-label hal-doc-stamp-empty">
                  Payment Desk — Stamp &amp; Signature
                </div>
              )}
            </div>

            {/* HOD stamp block — appears once HOD has stamped */}
            {(() => {
              const hodStep = (pa.history ?? []).find((h) => h.action === 'hod_stamp');
              return (
                <div className={'hal-doc-stamp-box' + (hodStep ? ' hal-doc-stamp-signed' : '')}>
                  {hodStep ? (
                    <>
                      <div className="hal-doc-stamp-label">✔ HOD (IMM) — Approved &amp; Stamped</div>
                      <div className="hal-doc-stamp-meta">{hodStep.date}</div>
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
          </div>
        );
      })()}
    </div>
  );
}

