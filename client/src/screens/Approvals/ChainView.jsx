import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { actOnChain, fetchChain, fetchMeta } from '../../lib/approvalsApi.js';
import { useRole } from '../../context/RoleContext.jsx';

// Walking one file through its approval chain.
//
// The desk that holds it picks from the hop types actually open to it — and those include
// three the ordinary forward/send-back vocabulary cannot express, all three taken from a
// real approved HAL note:
//
//   concur_with_rider  agree, but bind a LATER stage to a condition
//   examine            push it DOWN to a junior in your own unit, expecting it back
//   query              bounce a question to the originator without rejecting anything
//
// At the bottom, the release gate. A CFA signature alone does not free the file: every
// authority the checklist obliged has to have acted first.
const VERB = {
  forward: 'raised / passed it on',
  concur: 'concurred',
  concur_with_rider: 'concurred, with a condition',
  examine: 'pushed it down to be examined',
  query: 'objected and sent it back',
  return_to: 'sent it back',
  approve: 'APPROVED',
  reject: 'REJECTED'
};

const ACTION_PILL = {
  approve: 'pill-success', reject: 'pill-danger',
  query: 'pill-warning', examine: 'pill-warning',
  concur_with_rider: 'pill-warning', concur: 'pill-info',
  forward: 'pill-neutral', return_to: 'pill-neutral'
};

export default function ChainView() {
  const { id } = useParams();
  const { role } = useRole();
  const canAct = ['indentor', 'purchase_maker', 'purchase_officer', 'hod_imm', 'admin'].includes(role);
  const [chain, setChain] = useState(null);
  const [meta, setMeta] = useState(null);
  const [action, setAction] = useState('concur');
  const [comment, setComment] = useState('');
  const [rider, setRider] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [actorPb, setActorPb] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reload = () =>
    fetchChain(id).then((d) => setChain(d.chain)).catch((e) => setError(e.message));

  useEffect(() => {
    fetchMeta().then(setMeta).catch(() => {});
    reload();
  }, [id]);

  const hopHelp = useMemo(() => {
    const map = {};
    for (const h of meta?.hops ?? []) map[h.id] = h;
    return map;
  }, [meta]);

  useEffect(() => {
    if (!chain?.allowed?.length) return;
    if (!chain.allowed.includes(action)) setAction(chain.allowed[0]);
  }, [chain]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        action,
        comment,
        rider: action === 'concur_with_rider' ? rider : '',
        twoFactor
      };
      // examine/query are acted by somebody outside the planned position — a junior in
      // the same unit, or the originator answering. Everything else acts as the slot.
      if (actorPb) payload.pb = actorPb;
      else payload.slotIndex = chain.next?.index ?? null;

      const d = await actOnChain(id, payload);
      setChain(d.chain);
      setComment('');
      setRider('');
      setTwoFactor(false);
      setActorPb('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !chain) return <section className="screen"><div className="banner banner-error">{error}</div></section>;
  if (!chain) return <section className="screen"><div className="grid-empty">Loading…</div></section>;

  const { plan } = chain;
  const pending = plan.slots.filter((s) => !s.actioned && s.kind !== 'originator');

  return (
    <section className="screen">
      <Link className="back-link" to="/approvals/chains">← All files</Link>
      <h1 className="screen-title">{plan.label} — {chain.fileId}</h1>
      <p className="screen-sub">
        {plan.agency} agency · {plan.division}{plan.dept ? ` · ${plan.dept}` : ''}
        {chain.caseRef ? ` · ${chain.caseRef}` : ''}
      </p>

      <div className="note-idbar">
        <span className="id-chip"><span className="id-chip-label">File</span><span className="id-chip-value">{chain.fileId}</span></span>
        <span className="id-chip"><span className="id-chip-label">Hops</span><span className="id-chip-value">{chain.hops.length}</span></span>
        <span className="id-chip"><span className="id-chip-label">DOP</span><span className="id-chip-value">{plan.dopLevel ?? '—'}</span></span>
        <span className={`pill ${chain.decision === 'approve' ? 'pill-success' : chain.decision === 'reject' ? 'pill-danger' : 'pill-info'}`}>
          {chain.decision ? (chain.decision === 'approve' ? 'Approved' : 'Rejected') : 'In progress'}
        </span>
        <span className={`pill ${chain.released ? 'pill-success' : 'pill-warning'}`}>
          {chain.released ? 'released to the next agency' : 'held by the gate'}
        </span>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {/* ---- the action row ---- */}
      {!chain.closed && chain.next && (
        canAct ? (
          <div className="form-section">
            <h2 className="form-section-title">
              With {chain.next.person?.name} — {chain.next.title}
            </h2>
            <p className="field-hint">
              {chain.next.person
                ? `${chain.next.person.grade} · ${chain.next.person.dept} · PB ${chain.next.person.pb}`
                : 'no one resolved for this position'}
              {chain.atCfa && ' · this is the CFA, the only desk that may approve or reject'}
            </p>
            {chain.next.caveats?.map((c) => (
              <div className="banner banner-info" key={c}>⚠ {c}</div>
            ))}

            <div className="form-grid">
              <label className="field-label">
                What does this desk do?
                <select className="field-input" value={action} onChange={(e) => setAction(e.target.value)}>
                  {chain.allowed.map((a) => (
                    <option key={a} value={a}>{hopHelp[a]?.label ?? a}</option>
                  ))}
                </select>
              </label>
              <label className="field-label field-wide">
                Remark
                <input
                  className="field-input"
                  value={comment}
                  placeholder={action.startsWith('concur') ? meta?.concurDefault ?? '' : 'free text'}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              {action === 'concur_with_rider' && (
                <label className="field-label field-wide">
                  The condition this binds a later stage to
                  <input
                    className="field-input"
                    value={rider}
                    placeholder="e.g. remove any brand/make from the tech spec before releasing the RFQ"
                    onChange={(e) => setRider(e.target.value)}
                  />
                </label>
              )}
              {(action === 'examine' || action === 'query') && (
                <label className="field-label">
                  Acting PB (leave blank to act as the planned desk)
                  <input
                    className="field-input"
                    value={actorPb}
                    placeholder={action === 'query' ? plan.originator?.pb ?? '' : 'a junior in this unit'}
                    onChange={(e) => setActorPb(e.target.value)}
                  />
                </label>
              )}
              <label className="field-label">
                <input type="checkbox" checked={twoFactor} onChange={(e) => setTwoFactor(e.target.checked)} />
                {' '}Two-factor authenticated
              </label>
            </div>
            <p className="field-hint">{hopHelp[action]?.help}</p>
            <div className="form-actions">
              <button className="btn" onClick={submit} disabled={busy}>
                {hopHelp[action]?.label ?? action}
              </button>
            </div>
          </div>
        ) : (
          <div className="banner banner-info" style={{ marginTop: '1rem' }}>
            <strong>Read-only view:</strong> File is currently with {chain.next.person?.name || chain.next.title}. Your role ({role}) cannot act on approval chains.
          </div>
        )
      )}

      {chain.closed && (
        <div className={`banner ${chain.decision === 'approve' ? 'banner-success' : 'banner-error'}`}>
          This note was {chain.decision === 'approve' ? 'approved' : 'rejected'} and is closed.
          {chain.released
            ? ' The file has left the agency.'
            : ' It has NOT been released — see the gate below.'}
        </div>
      )}

      {/* ---- the routing trail ---- */}
      <h2 className="section-heading">Routing trail</h2>
      {!chain.hops.length ? (
        <div className="grid-empty">Nothing raised yet.</div>
      ) : (
        <div className="route-log">
          {chain.hops.map((h) => (
            <div className="route-step" key={h.seq}>
              <div className="route-step-head">
                <strong>{h.note}</strong> {h.name}
                <span className="officer-pb-tag">{h.designation}</span>
                <span className={`pill ${ACTION_PILL[h.action] ?? 'pill-neutral'}`}>
                  {VERB[h.action] ?? h.action}
                </span>
                {h.twoFactor && <span className="tag">2FA</span>}
                <span className="route-step-date">{h.date}</span>
              </div>
              <div className="route-step-comment">{h.comment}</div>
              {h.rider && (
                <div className="route-step-flag">
                  Condition carried forward: {h.rider}
                </div>
              )}
              <div className="field-hint">
                {h.dept} · {h.division} · txn {h.txnId}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- the gate ---- */}
      <h2 className="section-heading">Release gate</h2>
      <p className="screen-note">
        A file leaves its agency only when the CFA has approved <em>and</em> every authority
        the checklist obliged has acted. Grade is not used to police the order — the real
        note this is modelled on runs 4 → 6 → 7 → 7 → 6 → 7 → 8 → 8 → 8 → 7 → <strong>4</strong> → 7 → 8 → 9.
      </p>
      {chain.released ? (
        <div className="banner banner-success">Released — the file may move to the next agency.</div>
      ) : (
        <div className="banner banner-restricted">
          Held. {chain.releaseBlockedBy.length} condition(s) outstanding:
          <ul>
            {chain.releaseBlockedBy.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      {chain.gradePath.length > 1 && (
        <p className="field-hint">
          Grade path: {chain.gradePath.join(' → ')} — {chain.monotonic ? 'monotonic' : 'not monotonic, as expected'}
          {chain.elapsedDays != null && ` · ${chain.elapsedDays} day(s)`}
        </p>
      )}

      {/* ---- the plan ---- */}
      <h2 className="section-heading">Planned positions ({plan.slots.length})</h2>
      <p className="field-hint">Source: {plan.shapeSource}</p>
      <div className="grid-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>#</th><th>Position</th><th>Who</th><th>Status</th><th>How confidently</th>
            </tr>
          </thead>
          <tbody>
            {plan.slots.map((s, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{s.title}<div className="field-hint">{s.why}</div></td>
                <td>
                  {s.external
                    ? <span className="pill pill-danger">outside HAL</span>
                    : s.person
                      ? <>{s.person.name}<div className="field-hint">{s.person.grade} · {s.person.dept}</div></>
                      : <span className="pill pill-warning">unresolved</span>}
                </td>
                <td>
                  {s.actioned
                    ? <span className="pill pill-success">{s.action}</span>
                    : <span className="pill pill-neutral">awaiting</span>}
                </td>
                <td>
                  {s.caveats?.length
                    ? s.caveats.map((c) => <div className="field-hint" key={c}>⚠ {c}</div>)
                    : <span className="field-hint">from the data</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending.length > 0 && (
        <p className="field-hint">{pending.length} position(s) still to act.</p>
      )}
    </section>
  );
}
