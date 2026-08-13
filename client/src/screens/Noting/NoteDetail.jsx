import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Attachments from '../../components/Attachments.jsx';
import Clarifications from '../../components/Clarifications.jsx';
import NoteRenderer from '../../components/NoteRenderer.jsx';
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
  
  const [showCoverPage, setShowCoverPage] = useState(true);
  const [accordionOpen, setAccordionOpen] = useState({
    attachments: true,
    stamping: false,
    referred: false,
    clarifications: false
  });
  
  const [newNoteBody, setNewNoteBody] = useState('');
  const [pick, setPick] = useState({ toMemberId: '', comment: '' });
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberPickerPurpose, setMemberPickerPurpose] = useState('forward');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchNote(txnId, grantToken)
      .then((d) => {
        setData(d);
        setNewNoteBody(d.note.body || '');
      })
      .catch((err) => setError(err.message));
    fetchHistory(txnId).then((d) => setSteps(d.history)).catch(() => setSteps([]));
    fetchGrants(txnId).then((d) => setGrants(d.grants)).catch(() => setGrants([]));
    fetchAlerts().then((d) => setAlerts(d.alerts.filter((a) => a.txn_id === txnId))).catch(() => setAlerts([]));
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

  const toggleAccordion = (key) => {
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleForwardMember = async (member) => {
    setBusy(true);
    setError(null);
    try {
      if (memberPickerPurpose === 'forward') {
        await forwardNote(txnId, { toMemberId: member.id, comment: pick.comment || 'Concurred & Forwarded' });
      } else if (memberPickerPurpose === 'sendback') {
        await sendBackNote(txnId, { toMemberId: member.id, comment: pick.comment || 'Returned' });
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDecision = async (decision) => {
    setBusy(true);
    setError(null);
    try {
      await decideNote(txnId, { decision, comment: pick.comment });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="screen">
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ClassificationBadge value={note.classification} />
          <StatusBadge value={note.status} />
        </div>
      </div>

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
            <button type="button" className="ef-routing-tab active">N1 (Note 1)</button>
            <button type="button" className="ef-routing-tab-arrow">►</button>
          </div>

          {/* Existing Note Content Display */}
          <div className={`ef-note-header${note.status === 'rejected' ? ' rejected' : ''}`}>
            <span>N1 Note by {initiator?.name || 'Initiator'} ({initiator?.designation || 'Desk'})</span>
            <span>Created: {new Date(note.created_at).toLocaleDateString('en-IN')}</span>
          </div>

          <div className="ef-note-body">
            <div dangerouslySetInnerHTML={{ __html: note.body || '<p>No content in note body.</p>' }} />
            <div className="ef-note-signature">
              <strong>Digitally Signed By:</strong> {initiator?.name}<br />
              <strong>Designation:</strong> {initiator?.designation}<br />
              <strong>Date &amp; Time:</strong> {new Date(note.created_at).toLocaleString('en-IN')}
            </div>
          </div>

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
                  placeholder="Enter remarks for forward/sendback/approval"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              📄 Summary
            </button>
          </div>

          {summary && (
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger">
                <span>Summary</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <p>{summary.lead}</p>
                <ul>
                  {summary.facts?.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className={`ef-accordion-item${accordionOpen.attachments ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('attachments')}>
              <span>Attachments</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              <Attachments txnId={txnId} isInitiator={me && me.id === note.initiator_id} canAdd={isHolder} />
            </div>
          </div>

          <div className={`ef-accordion-item${accordionOpen.clarifications ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('clarifications')}>
              <span>Clarifications</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              <Clarifications txnId={txnId} me={me} people={members} />
            </div>
          </div>
        </div>
      </div>

      <MemberPickerModal
        isOpen={showMemberPicker}
        onClose={() => setShowMemberPicker(false)}
        members={members}
        onSelect={handleForwardMember}
        title={memberPickerPurpose === 'forward' ? 'Select Officer to Forward' : 'Select Officer to Return File'}
      />
    </section>
  );
}
