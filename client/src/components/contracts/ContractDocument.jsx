import { amountInWords } from '../../lib/amountWords.js';
import { formatAmount, formatINR } from '../../lib/currency.js';
import { contractClsLabel } from '../../config/contractColumns.jsx';
import ContractQr from './ContractQr.jsx';

// The printed HAL contract: cover page → index → standard clauses → additional clauses →
// annexures (price schedule from the PO, scope/specs, chosen proformas) → signature block
// with the QR. Presentational only — ContractView owns fetching, so this is print-safe
// inside .note-print-area. All figures arrive server-computed; only words/format here.
const dt = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');

function Watermark({ contract }) {
  const text = contract.classification !== 'normal' ? contractClsLabel(contract.classification).toUpperCase() : 'HAL NASHIK';
  return <div className="contract-watermark" aria-hidden="true">{text}</div>;
}

function CoverPage({ c, typeLabel }) {
  return (
    <section className="contract-cover">
      <div className="note-doc-head">
        <div className="note-doc-org">HINDUSTAN AERONAUTICS LIMITED</div>
        <div className="note-doc-sub">Aircraft Overhaul Division, Nashik</div>
        <h2 className="note-doc-title">CONTRACT</h2>
        <div className="contract-cls-line">Classification: {contractClsLabel(c.classification)}</div>
      </div>

      <table className="grid annex-grid contract-cover-grid">
        <tbody>
          <tr><th scope="row">Contract No</th><td>{c.contract_no}</td></tr>
          <tr><th scope="row">Contract Date</th><td>{dt(c.finalised_at || c.created_at)}</td></tr>
          <tr><th scope="row">Description of Contract</th><td>{c.description}</td></tr>
          <tr>
            <th scope="row">Name of Parties</th>
            <td>
              <strong>{c.hal_division}</strong> ("BUYER")<br />
              {c.hal_address}
              <div className="contract-party-sep">— and —</div>
              <strong>{c.vendor_name}</strong> ("SUPPLIER")<br />
              {c.vendor_address}<br />
              GSTIN: {c.vendor_gstin} · {c.vendor_contact}
            </td>
          </tr>
          <tr>
            <th scope="row">Value of Contract</th>
            <td>
              {c.currency} {formatAmount(c.landed_value)} ({formatINR(c.landed_value)})<br />
              <em>Rupees {amountInWords(c.landed_value)}</em>
            </td>
          </tr>
          <tr><th scope="row">Period of Contract</th><td>{dt(c.period_from)} to {c.period_to ? dt(c.period_to) : 'completion of obligations'}</td></tr>
          <tr><th scope="row">Validity of Contract</th><td>{c.validity}</td></tr>
          <tr><th scope="row">Type of Contract</th><td>{typeLabel}</td></tr>
          <tr><th scope="row">HAL Purchase Order</th><td>{c.po_no} dt. {dt(c.po_date)}</td></tr>
          <tr><th scope="row">Tender Reference</th><td>{c.tender_no} · Mode: {c.mode_of_tendering}</td></tr>
          <tr><th scope="row">CAR / Requisition</th><td>{c.car_no}</td></tr>
          <tr><th scope="row">CFA &amp; DOP Reference</th><td>{c.cfa_dop_ref}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

function IndexPage({ clauses, formats, hasItems }) {
  const standard = clauses.filter((cl) => cl.source !== 'custom');
  const customs = clauses.filter((cl) => cl.source === 'custom');
  let annex = 0;
  const annexures = [
    hasItems && `Annexure ${String.fromCharCode(65 + annex++)} — Schedule of Items & Prices (from HAL PO)`,
    `Annexure ${String.fromCharCode(65 + annex++)} — Scope of Work & Technical Specifications`,
    ...formats.map((f) => `Annexure ${String.fromCharCode(65 + annex++)} — ${f.label}`)
  ].filter(Boolean);
  return (
    <section className="contract-toc">
      <h3 className="note-heading">Table of Contents / Index</h3>
      <ol className="contract-toc-list">
        {standard.map((cl) => (
          <li key={cl.id}>
            {cl.title}
            {cl.source === 'extra' && <span className="contract-toc-tag"> (added)</span>}
          </li>
        ))}
        {customs.length > 0 && (
          <li>
            Additional Clauses
            <ol type="a">
              {customs.map((cl) => <li key={cl.id}>{cl.title}</li>)}
            </ol>
          </li>
        )}
        {annexures.map((a) => <li key={a}>{a}</li>)}
      </ol>
      <p className="contract-toc-note">
        Page numbers as per the printed pagination of this document (see the page footer).
      </p>
    </section>
  );
}

function ClauseSections({ clauses }) {
  const standard = clauses.filter((cl) => cl.source !== 'custom');
  const customs = clauses.filter((cl) => cl.source === 'custom');
  return (
    <section className="contract-clauses">
      <h3 className="note-heading">Terms &amp; Conditions of Contract</h3>
      {standard.map((cl, i) => (
        <section key={cl.id} className="contract-clause">
          <h4 className="contract-clause-title">{i + 1}. {cl.title}</h4>
          {cl.body.split('\n').map((p, j) => <p key={j} className="note-para">{p}</p>)}
        </section>
      ))}
      {customs.length > 0 && (
        <>
          <h3 className="note-heading">Additional Clauses</h3>
          {customs.map((cl, i) => (
            <section key={cl.id} className="contract-clause">
              <h4 className="contract-clause-title">AC-{i + 1}. {cl.title}</h4>
              {cl.body.split('\n').map((p, j) => <p key={j} className="note-para">{p}</p>)}
            </section>
          ))}
        </>
      )}
    </section>
  );
}

// Price schedule from the HAL PO. CGST+SGST lines show the half-split; the stored
// tax_amount is the combined levy (server-computed).
function PriceAnnexure({ c, items, letter }) {
  return (
    <section className="contract-annex">
      <h3 className="note-heading">Annexure {letter} — Schedule of Items &amp; Prices (from HAL PO {c.po_no})</h3>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Sl.</th><th>Part No</th><th>Part Description</th><th>HSN</th>
              <th className="align-right">Qty</th><th>UOM</th>
              <th className="align-right">Unit Price</th><th>Tax %</th>
              <th className="align-right">Tax Amount</th><th className="align-right">Total Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.line_no}>
                <td>{it.line_no}</td>
                <td>{it.part_no}</td>
                <td>{it.description}</td>
                <td>{it.hsn}</td>
                <td className="align-right">{it.qty}</td>
                <td>{it.uom}</td>
                <td className="align-right">{formatAmount(it.unit_price)}</td>
                <td>
                  {it.gst_type === 'CGST+SGST'
                    ? `CGST ${it.gst_pct / 2}% + SGST ${it.gst_pct / 2}%`
                    : `${it.gst_type} ${it.gst_pct}%`}
                </td>
                <td className="align-right">
                  {formatAmount(it.tax_amount)}
                  {it.gst_type === 'CGST+SGST' && (
                    <div className="contract-tax-split">({formatAmount(it.tax_amount / 2)} + {formatAmount(it.tax_amount / 2)})</div>
                  )}
                </td>
                <td className="align-right">{formatAmount(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={8} className="align-right">Total Basic Price</th>
              <th className="align-right" colSpan={2}>{formatAmount(c.basic_value)}</th>
            </tr>
            <tr>
              <th colSpan={8} className="align-right">Total Tax</th>
              <th className="align-right" colSpan={2}>{formatAmount(c.tax_total)}</th>
            </tr>
            <tr>
              <th colSpan={8} className="align-right">Final Landed Value ({c.currency})</th>
              <th className="align-right" colSpan={2}>{formatAmount(c.landed_value)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="note-para"><em>Rupees {amountInWords(c.landed_value)}</em></p>
    </section>
  );
}

function SignatureBlock({ c }) {
  return (
    <section className="contract-signatures">
      <div className="contract-sign-cols">
        <div className="contract-sign-col">
          <div className="contract-sign-line">For and on behalf of the BUYER</div>
          <div className="contract-sign-space" />
          <strong>{c.finalised_by_name || c.generated_by_name || '—'}</strong>
          <div>{[c.finalised_by_pb || c.generated_by_pb, c.finalised_by_desig || c.generated_by_desig].filter(Boolean).join(' · ')}</div>
          <div>{[c.generated_by_dept, c.generated_by_division].filter(Boolean).join(', ')}</div>
          <div>Hindustan Aeronautics Limited</div>
        </div>
        <div className="contract-sign-col">
          <div className="contract-sign-line">For and on behalf of the SUPPLIER</div>
          <div className="contract-sign-space" />
          <strong>{c.vendor_name}</strong>
          <div>(Authorised signatory, with company seal)</div>
        </div>
      </div>

      <div className="contract-verify-strip">
        <ContractQr payload={c.qr_payload} />
        <div className="contract-verify-meta">
          {c.status === 'finalised' ? (
            <>
              <div><strong>Digitally stamped:</strong> {c.finalised_at?.replace('T', ' ').slice(0, 19)} (UTC)</div>
              <div><strong>Signed by:</strong> {[c.finalised_by_name, c.finalised_by_pb, c.finalised_by_desig].filter(Boolean).join(' / ')}</div>
              <div className="contract-hash"><strong>SHA-256:</strong> {c.content_hash}</div>
              <div className="field-hint">
                Any alteration to this document after finalisation invalidates the hash above.
              </div>
            </>
          ) : (
            <div className="field-hint">Draft — the integrity hash and QR are stamped on finalisation.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function ContractDocument({ doc }) {
  if (!doc) return null;
  const { contract: c, clauses, items, formats, typeLabel } = doc;
  let annex = 0;
  const nextLetter = () => String.fromCharCode(65 + annex++);
  const priceLetter = items.length ? nextLetter() : null;
  const scopeLetter = nextLetter();

  return (
    <article className="note-doc contract-doc">
      <Watermark contract={c} />
      <CoverPage c={c} typeLabel={typeLabel} />
      <IndexPage clauses={clauses} formats={formats} hasItems={items.length > 0} />
      <ClauseSections clauses={clauses} />

      {priceLetter && <PriceAnnexure c={c} items={items} letter={priceLetter} />}

      <section className="contract-annex">
        <h3 className="note-heading">Annexure {scopeLetter} — Scope of Work &amp; Technical Specifications</h3>
        <h4 className="contract-clause-title">Scope of Work (from the Provisioning Note)</h4>
        <p className="note-para">{c.scope_of_work}</p>
        <h4 className="contract-clause-title">Technical Specifications (from the Tender Document)</h4>
        <p className="note-para">{c.tech_specs}</p>
      </section>

      {formats.map((f) => (
        <section key={f.format_id} className="contract-annex">
          <h3 className="note-heading">Annexure {nextLetter()} — {f.label}</h3>
          <p className="note-para contract-format-placeholder">
            To be executed as per HAL Standard Format: <strong>{f.label}</strong>. The executed
            proforma forms an integral part of this contract.
          </p>
        </section>
      ))}

      <SignatureBlock c={c} />

      <div className="contract-page-footer" aria-hidden="true">
        {c.contract_no} · {contractClsLabel(c.classification)}
        {c.content_hash ? ` · SHA-256 ${c.content_hash.slice(0, 16)}…` : ' · DRAFT'}
      </div>
    </article>
  );
}
