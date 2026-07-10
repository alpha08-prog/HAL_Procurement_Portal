import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Attachments from '../../components/Attachments.jsx';
import Clarifications from '../../components/Clarifications.jsx';
import NoteRenderer from '../../components/NoteRenderer.jsx';
import RoutingTimeline from '../../components/RoutingTimeline.jsx';
import {
  CLASSIFICATIONS,
  ClassificationBadge,
  clsLabel,
  StatusBadge
} from '../../config/notingColumns.jsx';
import {
  decideNote,
  fetchAlerts,
  fetchGrants,
  fetchHistory,
  fetchMe,
  fetchMembers,
  fetchNote,
  fetchSummary,
  forwardNote,
  grantAccess,
  retractNote,
  retrieveNote,
  saveDraft,
  sendBackNote,
  sendForCheck
} from '../../lib/notingApi.js';

function IdChip({ label, value }) {
  return (
    <span className="id-chip">
      <span className="id-chip-label">{label}</span>
      <span className="id-chip-value">{value || '—'}</span>
    </span>
  );
}

function MemberSelect({ value, onChange, members, exclude }) {
  return (
    <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select member —</option>
      {members
        .filter((m) => !exclude?.includes(m.id))
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} — {m.designation}
          </option>
        ))}
    </select>
  );
}

export default function NoteDetail() {
  const { txnId } = useParams();
  const [sp] = useSearchParams();
  const grantToken = sp.get('grant');
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [steps, setSteps] = useState([]);
  const [grants, setGrants] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [shareLink, setShareLink] = useState('');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null);
  const [edit, setEdit] = useState({ title: '', body: '', classification: 'normal' });
  const [pick, setPick] = useState({ toMemberId: '', comment: '' });
  const [decision, setDecision] = useState('approve');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchNote(txnId, grantToken)
      .then((d) => {
        setData(d);
        setEdit({ title: d.note.title, body: d.note.body || '', classification: d.note.classification });
      })
      .catch((err) => setError(err.message));
    fetchHistory(txnId).then((d) => setSteps(d.history)).catch(() => setSteps([]));
    fetchGrants(txnId).then((d) => setGrants(d.grants)).catch(() => setGrants([]));
    fetchAlerts().then((d) => setAlerts(d.alerts.filter((a) => a.txn_id === txnId))).catch(() => setAlerts([]));
  }, [txnId, grantToken]);

  useEffect(() => {
    load();
    fetchMe().then((d) => setMe(d.member)).catch(() => setMe(null));
    fetchMembers().then((d) => setMembers(d.members)).catch(() => setMembers([]));
  }, [load]);

  if (error && !data) return <div className="grid-empty">Could not load note: {error}</div>;
  if (!data) return <div className="grid-empty">Loading…</div>;

  const { note, file, initiator, custodian } = data;
  const isHolder = me && me.id === note.custodian_id;
  const routable = ['draft', 'in_check', 'routed'].includes(note.status);
  const decidable = ['routed', 'in_check'].includes(note.status);
  const closed = ['approved', 'rejected'].includes(note.status);
  const lastStep = steps[steps.length - 1];
  const canRetract = me && lastStep && lastStep.from_id === me.id && lastStep.state === 'sent';
  const canRetrieve = closed && me && note.decided_by === me.id;
  const restricted = note.classification !== 'normal';

  const partIds = new Set([note.initiator_id, note.custodian_id]);
  steps.forEach((s) => {
    if (s.from_id) partIds.add(s.from_id);
    if (s.to_id) partIds.add(s.to_id);
  });
  const people = members.filter((m) => partIds.has(m.id));

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPanel(null);
      setPick({ toMemberId: '', comment: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toId = () => Number(pick.toMemberId);

  const doShare = async () => {
    setBusy(true);
    setError(null);
    setShareLink('');
    try {
      const r = await grantAccess(txnId, { toMemberId: Number(pick.toMemberId) });
      setShareLink(window.location.origin + r.link);
      setPick({ toMemberId: '', comment: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rendered = {
    title: note.title,
    meta: {
      'File ID': file.file_id,
      'Reference No': note.ref_no,
      'Transaction ID': note.txn_id,
      Reference: file.car_no || (file.standalone ? 'Standalone (no requisition)' : '—'),
      Classification: clsLabel(note.classification),
      Initiator: initiator?.name,
      Date: note.created_at
    },
    fullOutput: note.body,
    newSection: note.body,
    annexures: []
  };

  const toggle = (p) => setPanel(panel === p ? null : p);

  return (
    <section className="screen">
      <div className="no-print">
        <Link to="/noting/files" className="back-link">
          ← Files
        </Link>

        <div className="note-idbar">
          <IdChip label="File ID" value={file.file_id} />
          <IdChip label="Reference No" value={note.ref_no} />
          <IdChip label="Transaction ID" value={note.txn_id} />
          <ClassificationBadge value={note.classification} />
          <StatusBadge value={note.status} />
          <span className="id-chip">
            <span className="id-chip-label">Currently with</span>
            <span className="id-chip-value">{custodian?.name}</span>
          </span>
        </div>

        {restricted && (
          <div className="banner banner-restricted">
            🔒 {clsLabel(note.classification)} — visible only to routed members. A link or
            transaction id alone grants no access.
          </div>
        )}

        {alerts.length > 0 && (
          <div className="banner banner-error">
            ⚠ {alerts.length} re-share attempt(s) on this note —{' '}
            {alerts.map((a) => `PB ${a.offender_pb}`).join(', ')}. The shared link was revoked.
          </div>
        )}

        <div className="note-detail-actions">
          {isHolder && note.status === 'draft' && (
            <button type="button" className={'btn' + (panel === 'edit' ? '' : ' btn-secondary')} onClick={() => toggle('edit')}>
              Edit draft
            </button>
          )}
          {isHolder && note.status === 'draft' && (
            <button type="button" className={'btn' + (panel === 'check' ? '' : ' btn-secondary')} onClick={() => toggle('check')}>
              Send for check
            </button>
          )}
          {isHolder && routable && (
            <button type="button" className={'btn' + (panel === 'forward' ? '' : ' btn-secondary')} onClick={() => toggle('forward')}>
              Forward
            </button>
          )}
          {isHolder && decidable && (
            <button type="button" className={'btn' + (panel === 'sendback' ? '' : ' btn-secondary')} onClick={() => toggle('sendback')}>
              Send back
            </button>
          )}
          {isHolder && decidable && (
            <button type="button" className={'btn' + (panel === 'decision' ? '' : ' btn-secondary')} onClick={() => toggle('decision')}>
              Approve / Reject
            </button>
          )}
          {canRetract && (
            <button type="button" className="btn btn-secondary" onClick={() => run(() => retractNote(txnId))} disabled={busy}>
              Retract
            </button>
          )}
          {canRetrieve && (
            <button type="button" className="btn btn-secondary" onClick={() => run(() => retrieveNote(txnId))} disabled={busy}>
              Retrieve from cabinet
            </button>
          )}
          {restricted && (
            <button type="button" className={'btn' + (panel === 'share' ? '' : ' btn-secondary')} onClick={() => toggle('share')}>
              Share (need-to-know)
            </button>
          )}
          <button
            type="button"
            className={'btn' + (panel === 'summary' ? '' : ' btn-secondary')}
            onClick={() => {
              toggle('summary');
              if (!summary) fetchSummary(txnId).then((d) => setSummary(d.summary)).catch(() => setSummary({ lead: '', facts: [] }));
            }}
          >
            Summary
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Download PDF
          </button>
        </div>

        {panel === 'summary' && (
          <div className="form-section">
            <div className="form-section-title">Proposal summary</div>
            {!summary ? (
              <div className="grid-empty">Generating…</div>
            ) : (
              <>
                {summary.lead && <p className="note-para">{summary.lead}</p>}
                {summary.facts.length > 0 && (
                  <ul className="summary-facts">
                    {summary.facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
                {!summary.lead && summary.facts.length === 0 && <div className="grid-empty">No content to summarise.</div>}
              </>
            )}
          </div>
        )}

        {panel === 'edit' && (
          <div className="form-section">
            <div className="form-section-title">Edit draft</div>
            <div className="form-grid">
              <label className="field-wide">
                <span className="field-label">Note title</span>
                <input className="field-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </label>
              <label>
                <span className="field-label">Classification</span>
                <select className="field-input" value={edit.classification} onChange={(e) => setEdit({ ...edit, classification: e.target.value })}>
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-wide">
                <span className="field-label">Note body</span>
                <textarea className="field-input" rows={10} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => run(() => saveDraft(txnId, edit))}>
                {busy ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          </div>
        )}

        {(panel === 'check' || panel === 'forward' || panel === 'sendback') && (
          <div className="form-section">
            <div className="form-section-title">
              {panel === 'check' ? 'Send draft for check' : panel === 'forward' ? 'Forward to next member' : 'Send back'}
            </div>
            <div className="form-grid">
              <label>
                <span className="field-label">{panel === 'sendback' ? 'Return to' : 'Member'}</span>
                <MemberSelect
                  value={pick.toMemberId}
                  onChange={(v) => setPick({ ...pick, toMemberId: v })}
                  members={members}
                  exclude={panel === 'sendback' ? [note.custodian_id] : []}
                />
              </label>
              <label className="field-wide">
                <span className="field-label">Comment {panel === 'forward' ? '(blank = “Concurred & Forwarded”)' : '(optional)'}</span>
                <input className="field-input" value={pick.comment} onChange={(e) => setPick({ ...pick, comment: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={busy || !pick.toMemberId}
                onClick={() =>
                  run(() =>
                    panel === 'check'
                      ? sendForCheck(txnId, { toMemberId: toId(), comment: pick.comment })
                      : panel === 'forward'
                        ? forwardNote(txnId, { toMemberId: toId(), comment: pick.comment })
                        : sendBackNote(txnId, { toMemberId: toId(), comment: pick.comment })
                  )
                }
              >
                {busy ? 'Sending…' : panel === 'check' ? 'Send for check' : panel === 'forward' ? 'Forward' : 'Send back'}
              </button>
              {panel === 'forward' && <span className="action-note">Add anyone as the next member — including yourself.</span>}
            </div>
          </div>
        )}

        {panel === 'decision' && (
          <div className="form-section">
            <div className="form-section-title">Decision</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Outcome</span>
                <select className="field-input" value={decision} onChange={(e) => setDecision(e.target.value)}>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
              </label>
              <label className="field-wide">
                <span className="field-label">Remark (optional)</span>
                <input className="field-input" value={pick.comment} onChange={(e) => setPick({ ...pick, comment: e.target.value })} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => run(() => decideNote(txnId, { decision, comment: pick.comment }))}>
                {busy ? 'Recording…' : decision === 'approve' ? 'Approve & file' : 'Reject & file'}
              </button>
              <span className="action-note">On decision the file moves to the cabinet.</span>
            </div>
          </div>
        )}

        {panel === 'share' && (
          <div className="form-section">
            <div className="form-section-title">Share (need-to-know)</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Give access to</span>
                <MemberSelect value={pick.toMemberId} onChange={(v) => setPick({ ...pick, toMemberId: v })} members={members} />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy || !pick.toMemberId} onClick={doShare}>
                {busy ? 'Issuing…' : 'Issue link'}
              </button>
              <span className="action-note">If the recipient forwards this link, access is revoked for both.</span>
            </div>
            {shareLink && (
              <div className="share-link">
                <span className="field-label">Share link</span>
                <input className="field-input" readOnly value={shareLink} onFocus={(e) => e.target.select()} />
              </div>
            )}
            {grants.length > 0 && (
              <ul className="grant-list">
                {grants.map((g) => (
                  <li key={g.token}>
                    <span>{g.granted_to}</span>
                    <span className={`tag ${g.state === 'active' ? 'tag-note-approved' : 'tag-note-rejected'}`}>
                      {g.state === 'active' ? 'Active' : `Revoked (${g.revoke_reason || 'revoked'})`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}

        <h2 className="section-heading" style={{ marginTop: 'var(--space-4)' }}>
          Attachments
        </h2>
        <Attachments
          txnId={txnId}
          isInitiator={me && me.id === note.initiator_id}
          canAdd={me && people.some((p) => p.id === me.id)}
        />

        <h2 className="section-heading" style={{ marginTop: 'var(--space-5)' }}>
          Routing trail
        </h2>
        <RoutingTimeline steps={steps} />

        <h2 className="section-heading" style={{ marginTop: 'var(--space-5)' }}>
          Clarifications
        </h2>
        <Clarifications txnId={txnId} me={me} people={people} />
      </div>

      <div className="note-print-area">
        <NoteRenderer note={rendered} mode="full" />
      </div>
    </section>
  );
}
