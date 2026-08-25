import { useEffect, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { BID_COLUMNS } from '../../config/approvalColumns.jsx';
import { fetchBids } from '../../lib/approvalsApi.js';

const inr = (n) => (n == null ? '—' : `₹ ${Number(n).toLocaleString('en-IN')}`);

// Bid evaluation — the two decisions that actually eliminate suppliers.
//
// EMD: a bidder may skip the deposit only if it MANUFACTURES the offered product in the
// relevant NIC category. The server does not take the bidder's claim at face value; it
// reads Nature-of-Firm and the NIC code and decides.
//
// TEC: whatever the bidder marked NO against, cited by specification line number so the
// rejection can be defended.
export default function Bids() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBids().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <section className="screen">
        <h1 className="screen-title">Bid Evaluation</h1>
        <div className="banner banner-error">{error}</div>
      </section>
    );
  }
  if (!data) return <section className="screen"><div className="grid-empty">Loading bids…</div></section>;

  const { summary, price } = data;

  return (
    <section className="screen">
      <h1 className="screen-title">Bid Evaluation</h1>
      <p className="screen-sub">
        Technical bid compliance sheets for tender {data.tenderRef}. Each bidder answered YES
        or NO against 12 specification lines and 18 terms; the two gates below are recomputed
        from those answers.
      </p>

      {data.fixture && (
        <div className="banner banner-restricted">
          <strong>Fabricated test data.</strong> {data.warning}
        </div>
      )}

      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-value">{summary.total}</div>
          <div className="metric-label">bids received</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.emdRejected}</div>
          <div className="metric-label">out at EMD scrutiny</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.tecRejected}</div>
          <div className="metric-label">out at technical evaluation</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.accepted}</div>
          <div className="metric-label">technically accepted</div>
        </div>
      </div>

      <h2 className="section-heading">Bidders</h2>
      <DataGrid columns={BID_COLUMNS} rows={data.rows} rowKey="id" emptyMessage="No bids." />

      <h2 className="section-heading">Why each rejected bidder is out</h2>
      <div className="route-log">
        {data.rows.filter((r) => r.stage !== 'in').map((r) => (
          <div className="route-step" key={r.id}>
            <div className="route-step-head">
              <strong>{r.name}</strong>
              <span className={`pill ${r.stage === 'out_at_emd' ? 'pill-danger' : 'pill-warning'}`}>
                {r.verdict}
              </span>
            </div>
            <div className="route-step-comment">{r.verdictReason}</div>
            {r.stage === 'out_at_emd' && (
              <div className="field-hint">
                Claimed: “{r.emdClaim}” · Nature of firm: {r.nature} · NIC {r.nic}
                {' '}· manufacturer={String(r.manufacturer)} · NIC in category={String(r.nicMatch)}
              </div>
            )}
            {r.specRemarks?.map((s) => (
              <div className="route-step-flag" key={s}>{s}</div>
            ))}
          </div>
        ))}
      </div>

      <h2 className="section-heading">Price bid &amp; negotiation</h2>
      <div className="grid-wrap">
        <table className="mini-table">
          <tbody>
            <tr><th>Lowest acceptable bidder (L1)</th><td>{price.l1Vendor ?? '—'}</td></tr>
            <tr><th>L1 landed value</th><td>{inr(price.l1Landed)}</td></tr>
            <tr><th>Provisioning estimate</th><td>{inr(price.estimate)}</td></tr>
            <tr>
              <th>Variance against estimate</th>
              <td>
                {price.variancePct == null ? '—' : (
                  <span className={`pill ${price.variancePct > 0 ? 'pill-warning' : 'pill-success'}`}>
                    {price.variancePct > 0 ? '+' : ''}{price.variancePct}%
                  </span>
                )}
              </td>
            </tr>
            <tr><th>Last purchase price</th><td>{inr(price.lpp)}<div className="field-hint">{price.lppContract}</div></td></tr>
            <tr><th>Reverse auction</th><td>{price.raStatus || '—'}</td></tr>
            <tr>
              <th>Negotiation advised?</th>
              <td>
                <span className={`pill ${price.pncAdvised ? 'pill-warning' : 'pill-neutral'}`}>
                  {price.pncAdvised ? 'yes — PNC required' : 'no'}
                </span>
                <div className="field-hint">{price.pncRule}</div>
              </td>
            </tr>
            <tr><th>Counter-offer accepted</th><td>{inr(price.counter)}</td></tr>
            <tr>
              <th>Saving against L1</th>
              <td>
                {inr(price.savingAmount)}
                {price.savingPct != null && <span className="pill pill-success">{price.savingPct}%</span>}
              </td>
            </tr>
            <tr><th>Security Deposit (5% of basic)</th><td>{inr(price.sd)}</td></tr>
            <tr><th>Performance BG (10% of basic)</th><td>{inr(price.pbg)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="screen-note">
        Every figure above is computed server-side from the bid sheets — the screen calculates
        nothing.
      </p>
    </section>
  );
}
