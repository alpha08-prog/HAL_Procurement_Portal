import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Attachments from '../../components/Attachments.jsx';
import Clarifications from '../../components/Clarifications.jsx';
import RoutingTimeline from '../../components/RoutingTimeline.jsx';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import {
  CLASSIFICATIONS,
  ClassificationBadge,
  clsLabel,
  StatusBadge
} from '../../config/notingColumns.jsx';
import {
  addNote,
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
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [showCoverPage, setShowCoverPage] = useState(true);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftClassification, setDraftClassification] = useState('normal');
  const [accordionOpen, setAccordionOpen] = useState({
    routing: true,
    attachments: true,
    clarifications: false,
    grants: false
  });
  
  const [newNoteBody, setNewNoteBody] = useState('');
  const [pick, setPick] = useState({ toMemberId: '', comment: '' });
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberPickerPurpose, setMemberPickerPurpose] = useState('forward'); // 'forward' | 'sendback' | 'check' | 'share'
  const [generatedShareLink, setGeneratedShareLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchNote(txnId, grantToken)
      .then((d) => {
        setData(d);
        setNewNoteBody(d.note.body || '');
        setDraftTitle(d.note.title || '');
        setDraftClassification(d.note.classification || 'normal');
      })
      .catch((err) => setError(err.message));
    fetchHistory(txnId).then((d) => setSteps(d.history || [])).catch(() => setSteps([]));
    fetchGrants(txnId).then((d) => setGrants(d.grants || [])).catch(() => setGrants([]));
    fetchAlerts().then((d) => setAlerts((d.alerts || []).filter((a) => a.txn_id === txnId))).catch(() => setAlerts([]));
  }, [txnId, grantToken]);

  useEffect(() => {
    load();
    fetchMe().then((d) => setMe(d.member)).catch(() => setMe(null));
    fetchMembers().then((d) => setMembers(d?.members || [])).catch(() => setMembers([]));
  }, [load]);

  if (error && !data) return <div className="grid-empty">Could not load e-file: {error}</div>;
  if (!data) return <div className="grid-empty">Loading e-file…</div>;

  const { note, file, initiator, custodian } = data;
  const isHolder = me && me.id === note.custodian_id;
  const routable = ['draft', 'in_check', 'routed'].includes(note.status);
  const decidable = ['routed', 'in_check'].includes(note.status);
  const closed = ['approved', 'rejected'].includes(note.status);

  // Check if current user was the last sender and the recipient has NOT opened it yet
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const canRetract = me && lastStep && lastStep.from_id === me.id && lastStep.state === 'sent' && routable;

  // Check if current user decided this note and can retrieve it from cabinet
  const canRetrieve = me && closed && note.decided_by === me.id;

  // Prior holders for send-back restriction (initiator + prior senders)
  const priorHolderIds = new Set([note.initiator_id].filter(Boolean));
  steps.forEach((s) => {
    if (s.from_id) priorHolderIds.add(s.from_id);
  });
  const sendBackMembers = members.filter((m) => priorHolderIds.has(m.id) && m.id !== me?.id);

  const toggleAccordion = (key) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMemberSelected = async (member) => {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (memberPickerPurpose === 'forward') {
        await forwardNote(txnId, { toMemberId: member.id, comment: pick.comment || 'Concurred & Forwarded' });
        setPick({ ...pick, comment: '' });
      } else if (memberPickerPurpose === 'sendback') {
        await sendBackNote(txnId, { toMemberId: member.id, comment: pick.comment || 'Returned' });
        setPick({ ...pick, comment: '' });
      } else if (memberPickerPurpose === 'check') {
        await sendForCheck(txnId, { toMemberId: member.id, comment: pick.comment || 'Please review draft' });
        setPick({ ...pick, comment: '' });
      } else if (memberPickerPurpose === 'share') {
        const res = await grantAccess(txnId, member.id);
        const fullLink = `${window.location.origin}${res.link}`;
        setGeneratedShareLink({ name: member.name, pb: member.pb, link: fullLink });
        setSuccessMsg(`Need-to-know access link generated for ${member.name} (${member.pb}).`);
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (decision) => {
    if (!window.confirm(`Are you sure you want to ${decision} and file this note?`)) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await decideNote(txnId, { decision, comment: pick.comment });
      setPick({ ...pick, comment: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetract = async () => {
    if (!window.confirm('Retract this note back to your custody? The recipient has not opened it yet.')) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await retractNote(txnId);
      setSuccessMsg('Note successfully retracted to your custody.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetrieve = async () => {
    if (!window.confirm('Retrieve this note from the cabinet back to your inbox for rework?')) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await retrieveNote(txnId);
      setSuccessMsg('Note successfully retrieved from cabinet.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setError(null);
    try {
      await saveDraft(txnId, {
        title: draftTitle,
        body: newNoteBody,
        classification: draftClassification
      });
      setIsEditingDraft(false);
      setSuccessMsg('Draft changes saved successfully.');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      {/* Leak Alerts Banner */}
      {alerts.map((a, idx) => (
        <div key={idx} className="banner banner-error" style={{ marginBottom: 12 }}>
          ⚠️ <strong>LEAK ALERT:</strong> {a.message || `Restricted note link was re-shared. Access attempted by PB ${a.offender_pb}. Grant was automatically revoked.`}
        </div>
      ))}

      {successMsg && (
        <div className="banner banner-success" style={{ marginBottom: 12 }}>
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div className="banner banner-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Top Banner Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/noting/inbox" className="back-link" style={{ fontSize: 12 }}>← Back to Inbox</Link>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={() => setShowCoverPage((v) => !v)}
          >
            {showCoverPage ? 'Hide Cover Page' : 'Show Cover Page'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canRetract && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontSize: 12 }}
              onClick={handleRetract}
              disabled={busy}
            >
              ↩ Retract Hop
            </button>
          )}

          {canRetrieve && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderColor: '#1e7d43', color: '#1e7d43', fontSize: 12 }}
              onClick={handleRetrieve}
              disabled={busy}
            >
              📥 Retrieve from Cabinet
            </button>
          )}

          {note.classification !== 'normal' && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12 }}
              onClick={() => {
                setMemberPickerPurpose('share');
                setShowMemberPicker(true);
              }}
            >
              🔗 Share (Need-to-Know)
            </button>
          )}

          <ClassificationBadge value={note.classification} />
          <StatusBadge value={note.status} />
        </div>
      </div>

      {generatedShareLink && (
        <div className="banner banner-restricted" style={{ marginBottom: 12 }}>
          <div><strong>Personal Share Link Generated:</strong> Bound specifically to <strong>{generatedShareLink.name} ({generatedShareLink.pb})</strong>.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              className="field-input"
              style={{ flex: 1, fontSize: 12 }}
              readOnly
              value={generatedShareLink.link}
              onClick={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(generatedShareLink.link);
                alert('Copied link to clipboard!');
              }}
            >
              Copy Link
            </button>
          </div>
          <div className="field-hint" style={{ marginTop: 4 }}>
            🔒 Anti-leak protection active: If this link is forwarded and opened by anyone else, it is automatically revoked for both and an alert is issued to the custodian.
          </div>
        </div>
      )}

      <div className="ef-split-layout">
        {/* Main Column */}
        <div className="ef-main-col">
          {/* Cover Page */}
          {showCoverPage && (
            <div className="ef-cover-page">
              <div className="ef-cover-header">
                <h2>HINDUSTAN AERONAUTICS LIMITED — NASHIK DIVISION</h2>
                <h3>E-FILE NOTING SHEET: #{file.file_id}</h3>
              </div>
              <dl className="ef-cover-meta">
                <dt>Subject:</dt>
                <dd style={{ fontWeight: 600, color: 'var(--accent)' }}>{file.title}</dd>
                <dt>Ref No:</dt>
                <dd>{note.ref_no}</dd>
                <dt>Txn ID:</dt>
                <dd>{note.txn_id}</dd>
                <dt>Currently With:</dt>
                <dd style={{ fontWeight: 600, color: '#1e7d43' }}>{custodian?.name || '—'}</dd>
              </dl>
            </div>
          )}

          {/* Routing Trail / Note History Tabs */}
          <div className="ef-routing-tabs">
            <button type="button" className="ef-routing-tab-arrow">◄</button>
            <button type="button" className="ef-routing-tab active">N{note.seq} ({note.title})</button>
            <button type="button" className="ef-routing-tab-arrow">►</button>
          </div>

          {/* Existing Note Content Display / Draft Edit Mode */}
          <div className={`ef-note-header${note.status === 'rejected' ? ' rejected' : ''}`}>
            <span>N{note.seq} Note by {initiator?.name || 'Initiator'} ({initiator?.designation || 'Desk'})</span>
            <span>Created: {new Date(note.created_at).toLocaleDateString('en-IN')}</span>
          </div>

          {isEditingDraft ? (
            <form onSubmit={handleSaveDraft} className="form-section" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '0 0 var(--radius) var(--radius)', padding: 16 }}>
              <div className="form-grid">
                <label className="field-wide">
                  <span className="field-label">Note Title</span>
                  <input className="field-input" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                </label>
                <label>
                  <span className="field-label">Classification</span>
                  <select className="field-input" value={draftClassification} onChange={(e) => setDraftClassification(e.target.value)}>
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="field-label">Note Content</span>
                <RichTextEditor value={newNoteBody} onChange={setNewNoteBody} />
              </div>
              <div className="form-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="btn" disabled={busy}>Save Draft</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingDraft(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="ef-note-body">
              <div dangerouslySetInnerHTML={{ __html: note.body || '<p>No content in note body.</p>' }} />
              <div className="ef-note-signature">
                <strong>Digitally Signed By:</strong> {initiator?.name}<br />
                <strong>Designation:</strong> {initiator?.designation}<br />
                <strong>Date &amp; Time:</strong> {new Date(note.created_at).toLocaleString('en-IN')}
              </div>
            </div>
          )}

          {/* Action Toolbar for Current Holder */}
          {isHolder && routable && (
            <div className="form-section" style={{ marginTop: 24 }}>
              <div className="form-section-title">Workflow Actions</div>
              <div style={{ marginBottom: 12 }}>
                <span className="field-label">Remarks / Comment</span>
                <input
                  className="field-input"
                  style={{ width: '100%' }}
                  value={pick.comment}
                  onChange={(e) => setPick({ ...pick, comment: e.target.value })}
                  placeholder="Enter remarks (leave blank or symbols for auto 'Concurred & Forwarded')"
                />
                <span className="field-hint" style={{ fontSize: 11 }}>
                  Note: Empty comment or punctuation automatically normalises to "Concurred &amp; Forwarded" when forwarding.
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {note.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditingDraft((v) => !v)}
                    >
                      ✏️ {isEditingDraft ? 'Close Editor' : 'Edit Draft'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      disabled={busy}
                      onClick={() => {
                        setMemberPickerPurpose('check');
                        setShowMemberPicker(true);
                      }}
                    >
                      🔍 Send for Check
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setMemberPickerPurpose('forward');
                    setShowMemberPicker(true);
                  }}
                >
                  Forward to Officer →
                </button>

                {decidable && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setMemberPickerPurpose('sendback');
                      setShowMemberPicker(true);
                    }}
                  >
                    ← Send Back
                  </button>
                )}

                {decidable && (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#1e7d43' }}
                    disabled={busy}
                    onClick={() => handleDecision('approve')}
                  >
                    Approve &amp; File
                  </button>
                )}

                {decidable && (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#b3261e' }}
                    disabled={busy}
                    onClick={() => handleDecision('reject')}
                  >
                    Reject &amp; Close
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Accordion Panel */}
        <div className="ef-right-panel">
          <div className="ef-panel-actions">
            <button type="button" className="ef-panel-action" onClick={() => window.print()}>
              🖨️ Download PDF
            </button>
            <button
              type="button"
              className="ef-panel-action"
              onClick={() => {
                if (!summary) fetchSummary(txnId).then((d) => setSummary(d.summary));
              }}
            >
              📄 Proposal Summary
            </button>
          </div>

          {summary && (
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger">
                <span>Auto Proposal Summary</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <p style={{ fontWeight: 600 }}>{summary.lead}</p>
                <ul>
                  {summary.facts?.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Routing Trail Accordion */}
          <div className={`ef-accordion-item${accordionOpen.routing ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('routing')}>
              <span>Routing Trail ({steps.length})</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              <RoutingTimeline steps={steps} />
            </div>
          </div>

          {/* Attachments Accordion */}
          <div className={`ef-accordion-item${accordionOpen.attachments ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('attachments')}>
              <span>Attachments</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              <Attachments txnId={txnId} isInitiator={me && me.id === note.initiator_id} canAdd={isHolder} />
            </div>
          </div>

          {/* Clarifications Accordion */}
          <div className={`ef-accordion-item${accordionOpen.clarifications ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('clarifications')}>
              <span>Clarifications</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              <Clarifications txnId={txnId} me={me} people={members} />
            </div>
          </div>

          {/* Active Grants Accordion (for restricted notes) */}
          {note.classification !== 'normal' && (
            <div className={`ef-accordion-item${accordionOpen.grants ? ' open' : ''}`}>
              <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('grants')}>
                <span>Need-to-Know Grants ({grants.length})</span>
                <span className="arrow">▼</span>
              </button>
              <div className="ef-accordion-content">
                {grants.length === 0 ? (
                  <div className="field-hint">No share links issued yet.</div>
                ) : (
                  <ul style={{ paddingLeft: 16, margin: 0, fontSize: 11 }}>
                    {grants.map((g, idx) => (
                      <li key={idx} style={{ marginBottom: 6 }}>
                        <strong>{g.granted_to}</strong> (by {g.granted_by}) —{' '}
                        <span className={`tag ${g.state === 'active' ? 'tag-cls-normal' : 'tag-note-rejected'}`}>
                          {g.state}
                        </span>
                        {g.revoked_at && <div style={{ color: '#b3261e' }}>Revoked: {g.revoke_reason}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <MemberPickerModal
        isOpen={showMemberPicker}
        onClose={() => setShowMemberPicker(false)}
        members={memberPickerPurpose === 'sendback' ? sendBackMembers : members}
        onSelect={handleMemberSelected}
        title={
          memberPickerPurpose === 'forward'
            ? 'Select Officer to Forward'
            : memberPickerPurpose === 'sendback'
            ? 'Select Prior Officer / Initiator to Send Back'
            : memberPickerPurpose === 'check'
            ? 'Select Member for Pre-Routing Draft Check'
            : 'Select Member for Need-to-Know Share Grant'
        }
      />
    </section>
  );
}
