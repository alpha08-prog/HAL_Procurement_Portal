import { formatINR } from '../lib/currency.js';
import { formatDate } from '../lib/date.js';

export default function LdSheetModal({ pa, onClose }) {
  const printedOn = formatDate(new Date().toISOString());

  const daysLate = Math.max(0, Math.ceil((new Date(pa.gateEntryDate || pa.rvDate) - new Date(pa.deliveryDueDate)) / (1000 * 60 * 60 * 24))) || 0;
  const ldWeeks = pa.ldWeeks ?? Math.ceil(daysLate / 7);
  const poValue = pa.poValue || pa.rvValue || 0;
  const rvValue = pa.rvValue || 0;
  const ldCap = pa.ldCap || Math.round(poValue * 0.1);
  const ldSupplyAmount = pa.ldSupplyAmount ?? Math.round(rvValue * 0.005 * ldWeeks);
  const ldIcAmount = pa.ldIcAmount || 0;
  const uncapped = ldSupplyAmount + ldIcAmount;
  const ldAmount = pa.ldAmount ?? Math.min(uncapped, ldCap);
  const finalPayment = pa.finalPayment ?? (rvValue - ldAmount);

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-card note-print-area" style={{
        background: '#fff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        padding: '24px',
        boxSizing: 'border-box'
      }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn" onClick={() => window.print()}>
              🖨️ Print / Download LD Sheet
            </button>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>
            ✕
          </button>
        </div>

        {/* HAL LD Sheet Format */}
        <div style={{ border: '2px solid #1e3a8a', padding: '20px', borderRadius: '4px', background: '#ffffff', color: '#1f2937' }}>
          <header style={{ textAlign: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1e3a8a', letterSpacing: '0.5px' }}>
              HINDUSTAN AERONAUTICS LIMITED
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
              Aircraft Overhaul Division (AOD), Nasik
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c', marginTop: '6px', textDecoration: 'underline' }}>
              LIQUIDATED DAMAGES (LD) CALCULATION SHEET
            </div>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
            <div><strong>PA Advice No:</strong> {pa.paNo}</div>
            <div><strong>Date of Sheet:</strong> {printedOn}</div>
            <div><strong>Purchase Order (PO) No:</strong> {pa.poNo}</div>
            <div><strong>PO Date:</strong> {formatDate(pa.poDate)}</div>
            <div><strong>RV No / Date:</strong> {pa.rvNo} ({formatDate(pa.rvDate)})</div>
            <div><strong>Gate Entry No / Date:</strong> {pa.gateEntryNo || '—'} ({formatDate(pa.gateEntryDate)})</div>
            <div><strong>Vendor Name & Code:</strong> {pa.vendorName} ({pa.vendorCode})</div>
            <div><strong>PO Officer:</strong> {pa.poOfficer || '—'}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', color: '#0f172a' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'left' }}>Parameter</th>
                <th style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'left' }}>Value / Description</th>
                <th style={{ border: '1px solid #94a3b8', padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Delivery Due Date (PO Terms)</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{formatDate(pa.deliveryDueDate)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Actual Delivery / Gate Entry Date</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{formatDate(pa.gateEntryDate)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Delay in Days / Weeks</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  {daysLate} day(s) delay → <strong>{ldWeeks} week(s) or part thereof (ceiling)</strong>
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>—</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>RV Value (Claim Base)</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Accepted RV Stores Value</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>{formatINR(rvValue)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>PO Order Value (Cap Base)</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Total Purchase Order Value</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>{formatINR(poValue)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>Maximum LD Cap (10% of PO Value)</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>10% Maximum Cap Limit</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right' }}>{formatINR(ldCap)}</td>
              </tr>
              <tr style={{ background: '#fef3c7' }}>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: 600 }}>(a) Supply Delay LD</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  0.5% × RV Value ({formatINR(rvValue)}) × {ldWeeks} week(s)
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatINR(ldSupplyAmount)}</td>
              </tr>
              <tr style={{ background: '#fef3c7' }}>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: 600 }}>(b) I&amp;C Delay LD</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  Installation &amp; Commissioning FTR delay deduction
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatINR(ldIcAmount)}</td>
              </tr>
              <tr style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>
                <td style={{ border: '1px solid #94a3b8', padding: '10px' }}>TOTAL APPLICABLE LD DEDUCTION</td>
                <td style={{ border: '1px solid #94a3b8', padding: '10px' }}>
                  {uncapped > ldCap ? `Uncapped ₹${formatINR(uncapped)} capped at 10% PO Limit` : 'Calculated LD within 10% limit'}
                </td>
                <td style={{ border: '1px solid #94a3b8', padding: '10px', textAlign: 'right', fontSize: '1rem' }}>{formatINR(ldAmount)}</td>
              </tr>
              <tr style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                <td style={{ border: '1px solid #94a3b8', padding: '10px' }}>NET PROPOSED PAYMENT TO VENDOR</td>
                <td style={{ border: '1px solid #94a3b8', padding: '10px' }}>RV Value − Total LD Deduction</td>
                <td style={{ border: '1px solid #94a3b8', padding: '10px', textAlign: 'right', fontSize: '1.05rem' }}>{formatINR(finalPayment)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '0.875rem', paddingTop: '16px', borderTop: '1px solid #cbd5e1' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Calculated &amp; Prepared By:</p>
              <p style={{ margin: '4px 0 0 0', color: '#4b5563' }}>Purchase Group / Officer</p>
              <div style={{ marginTop: '30px', borderTop: '1px dashed #94a3b8', paddingTop: '4px', color: '#6b7280', fontSize: '0.75rem' }}>
                Signature &amp; Date
              </div>
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Verified &amp; Checked By:</p>
              <p style={{ margin: '4px 0 0 0', color: '#4b5563' }}>Forwarding Officer / Payment Desk</p>
              <div style={{ marginTop: '30px', borderTop: '1px dashed #94a3b8', paddingTop: '4px', color: '#6b7280', fontSize: '0.75rem' }}>
                Signature &amp; Date
              </div>
            </div>
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
