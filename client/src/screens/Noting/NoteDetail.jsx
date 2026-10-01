import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Attachments from '../../components/Attachments.jsx';
import Clarifications from '../../components/Clarifications.jsx';
import NoteRenderer from '../../components/NoteRenderer.jsx';
import RoutingTimeline from '../../components/RoutingTimeline.jsx';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import {
  CLASSIFICATIONS,
  ClassificationBadge,
  clsLabel,
  NOTE_STATUS_LABEL,
  StatusBadge
} from '../../config/notingColumns.jsx';
import {
  addNote,
  addNotingEntry,
  decideNote,
  fetchAiCascade,
  linkAiCase,
  fetchAiNoteForm,
  fetchAlerts,
  fetchGrants,
  fetchHistory,
  fetchMe,
  fetchMembers,
  fetchNote,
  fetchSummary,
  forwardNote,
  grantAccess,
  handOverAiCase,
  raiseAiNote,
  retractNote,
  retrieveNote,
  saveDraft,
  sendBackNote,
  sendForCheck,
  sendToTenderInitiator
} from '../../lib/notingApi.js';

const STAGE_STEPS = [
  { id: 'provisioning', no: 1, label: '1. Provisioning' },
  { id: 'tender_opened', no: 2, label: '2. Tender / NIT' },
  { id: 'tec_stage', no: 3, label: '3. Technical (TEC)' },
  { id: 'post_pbo', no: 4, label: '4. Commercial (PBO)' },
  { id: 'pnc_stage', no: 5, label: '5. Negotiation (PNC)' },
  { id: 'post_pnc_rec', no: 6, label: '6. Recommendation' },
  { id: 'post_pp', no: 7, label: '7. Proposal (PP)' },
  { id: 'post_po', no: 8, label: '8. PO / Contract' }
];

export default function NoteDetail() {
  const { txnId } = useParams();
  const navigate = useNavigate();
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

  // AI Cascade state
  const [aiCascade, setAiCascade] = useState(null);
  const [aiPick, setAiPick] = useState(null);
  const [aiForm, setAiForm] = useState(null);
  const [aiFields, setAiFields] = useState({});
  const [aiConfirm, setAiConfirm] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showFormatsModal, setShowFormatsModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLinkSource, setAiLinkSource] = useState('nvb');
  
  const [showCoverPage, setShowCoverPage] = useState(true);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftClassification, setDraftClassification] = useState('normal');
  const [accordionOpen, setAccordionOpen] = useState({
    cascade: true,
    routing: true,
    attachments: true,
    clarifications: false,
    grants: false
  });
  
  const [newNoteBody, setNewNoteBody] = useState('');
  const [pick, setPick] = useState({ toMemberId: '', comment: '' });
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberPickerPurpose, setMemberPickerPurpose] = useState('forward'); // 'forward' | 'sendback' | 'check' | 'share' | 'tender'
  const [generatedShareLink, setGeneratedShareLink] = useState(null);
  const [busy, setBusy] = useState(false);

  // Noting Entries (N1, N2.. Nx) state
  const [showAddMinuteModal, setShowAddMinuteModal] = useState(false);
  const [minuteTitle, setMinuteTitle] = useState('');
  const [minuteBody, setMinuteBody] = useState('');
  const [minuteType, setMinuteType] = useState('minute');
  const [minuteRemark, setMinuteRemark] = useState('');

  const loadCascade = useCallback(() => {
    fetchAiCascade(txnId)
      .then((d) => setAiCascade(d))
      .catch((err) => console.warn('Could not load AI cascade state:', err));
  }, [txnId]);

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
    loadCascade();
  }, [txnId, grantToken, loadCascade]);

  useEffect(() => {
    load();
    fetchMe().then((d) => setMe(d.member)).catch(() => setMe(null));
    fetchMembers().then((d) => setMembers(d?.members || [])).catch(() => setMembers([]));
  }, [load]);

  if (error && !data) return <div className="grid-empty">Could not load e-file: {error}</div>;
  if (!data) return <div className="grid-empty">Loading e-file…</div>;

  const { note, file, initiator, custodian, allNotes = [], proposal, approvalChain } = data;
  const isHolder = me && me.id === note.custodian_id;
  const routable = ['draft', 'in_check', 'routed'].includes(note.status);
  const decidable = ['routed', 'in_check'].includes(note.status);
  const closed = ['approved', 'rejected'].includes(note.status);

  // Check if current user was the last sender and the recipient has NOT opened it yet
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const canRetract = me && lastStep && lastStep.from_id === me.id && lastStep.state === 'sent' && routable;

  // Check if current user decided this note and can retrieve it from cabinet
  const canRetrieve = me && closed && note.decided_by === me.id;

  // Prior holders for send-back restriction
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
        const res = await grantAccess(txnId, { toMemberId: member.id });
        const fullLink = `${window.location.origin}${res.link}`;
        setGeneratedShareLink({ name: member.name, pb: member.pb, link: fullLink });
        setSuccessMsg(`Need-to-know access link generated for ${member.name} (${member.pb}).`);
      } else if (memberPickerPurpose === 'tender') {
        await sendToTenderInitiator(file.id, { memberId: member.id });
        setSuccessMsg(`Proposal sent to ${member.name} (${member.pb}) as tender initiator — it now rests in their cabinet.`);
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

  const handleAddMinute = async (e) => {
    e?.preventDefault?.();
    if (!minuteBody.trim()) {
      setError('Minute content is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextSeq = (data?.entries?.length || 0) + 1;
      await addNotingEntry(txnId, {
        title: minuteTitle.trim() || `Minute N${nextSeq}`,
        body: minuteBody,
        entry_type: minuteType,
        remark: minuteRemark.trim() || undefined
      });
      setShowAddMinuteModal(false);
      setMinuteTitle('');
      setMinuteBody('');
      setMinuteRemark('');
      setMinuteType('minute');
      setSuccessMsg(`✓ Noting Minute N${nextSeq} appended to Green Sheet.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // AI Cascade actions
  const handleOpenAiModal = async (noteId) => {
    setError(null);
    setAiConfirm(null);
    setAiPick(noteId);
    setAiForm(null);
    setShowAiModal(true);
    try {
      const f = await fetchAiNoteForm(txnId, noteId);
      setAiForm(f);
      setAiFields(Object.fromEntries(f.fields.map((x) => [x.key, x.value])));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleGenerateAiNote = async (override = false) => {
    setAiBusy(true);
    setError(null);
    try {
      const out = await raiseAiNote(txnId, {
        noteId: aiPick,
        fields: aiFields,
        override
      });

      setShowAiModal(false);
      setAiPick(null);
      setAiForm(null);
      setAiConfirm(null);

      if (out.skipped) {
        setSuccessMsg(`Note was skipped — rule ${out.branch?.rule} evaluated to false.`);
        loadCascade();
      } else {
        setSuccessMsg(`✓ Successfully generated and raised Note ${out.note?.seq || ''} (${out.result?.title || aiPick})!`);
        if (out.txnId) {
          navigate(`/noting/note/${out.txnId}`);
        } else {
          load();
        }
      }
    } catch (e) {
      if (e.needsOverride) {
        setAiConfirm({ message: e.message, advised: e.advised });
      } else {
        setError(e.message);
      }
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiHandover = async (toAgency) => {
    setAiBusy(true);
    setError(null);
    try {
      const out = await handOverAiCase(txnId, { toAgency });
      setSuccessMsg(`✓ File custody successfully transferred to the ${out.case?.holdingAgency || toAgency} Agency.`);
      // Immediately clear stale cascade so the Move button disappears right away,
      // then reload fresh cascade data in the background.
      setAiCascade(null);
      loadCascade();
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const handleLinkAiCase = async () => {
    setAiBusy(true);
    setError(null);
    try {
      const out = await linkAiCase(txnId, { sourceCase: aiLinkSource });
      setAiCascade(out);
      setSuccessMsg(`✓ AI case #${out.case?.id} linked to this file.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  const kase = aiCascade?.case;
  const permissions = kase?.permissions;
  const currentStageNo = kase?.node?.stageNo ?? 'pre-tender';

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
          {successMsg}
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
          {kase && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => setShowFormatsModal(true)}
            >
              Formats on File ({kase.formatsOnFile?.length || 0})
            </button>
          )}
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
              Retract Hop
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
              Retrieve from Cabinet
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
              Share (Need-to-Know)
            </button>
          )}

          <ClassificationBadge value={note.classification} />
          <StatusBadge value={note.status} />
        </div>
      </div>

      {/* AI Responsibility Cascade — compact stage chip only */}
      {kase && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{
            background: '#0e4474', color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 20, letterSpacing: '0.03em'
          }}>
            Stage {currentStageNo}: {kase.node?.title || STAGE_STEPS[currentStageNo - 1]?.label || 'In Progress'}
          </span>
          <span className={`pill ${kase.holdingAgency === 'Indenting' ? 'pill-warning' : 'pill-info'}`} style={{ fontSize: 10 }}>
            {kase.holdingAgency} Agency
          </span>
          {permissions?.canHandOver && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => handleAiHandover(permissions.stageOwner || (kase.holdingAgency === 'Indenting' ? 'Tendering' : 'Indenting'))}
              disabled={aiBusy}
            >
              Move to {permissions.stageOwner || (kase.holdingAgency === 'Indenting' ? 'Tendering' : 'Indenting')} Agency
            </button>
          )}
        </div>
      )}

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

          {/* Proposal status: current stage, holder and tender initiator */}
          {proposal?.current && (
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              <span>Proposal <strong>{file.car_no || file.file_id}</strong></span>
              <span>
                Current stage: <strong>S{proposal.current.seq} {proposal.current.stage_title}</strong> — {NOTE_STATUS_LABEL[proposal.current.status] || proposal.current.status}
                {proposal.current.holder_name ? `, with ${proposal.current.holder_name}` : ''}
              </span>
              <span>Tender initiator: <strong>{proposal.file.tender_initiator?.name || 'not assigned'}</strong></span>
            </div>
          )}

          {/* Module E: the internal approval chain this stage must clear before it can be approved here */}
          {approvalChain && (
            <div className={'banner ' + (approvalChain.released ? 'banner-success' : 'banner-restricted')} style={{ marginBottom: 10, fontSize: 12 }}>
              Approval chain <Link to={`/approvals/chain/${approvalChain.id}`}>#{approvalChain.id}</Link>
              {approvalChain.label ? ` (${approvalChain.label})` : ''} — {approvalChain.hops} hop{approvalChain.hops === 1 ? '' : 's'} recorded ·{' '}
              {approvalChain.released
                ? 'released: this stage may now be approved.'
                : `not released${approvalChain.decision ? ` (CFA ${approvalChain.decision}ed)` : ''}: ${approvalChain.releaseBlockedBy.slice(0, 3).join('; ')}${approvalChain.releaseBlockedBy.length > 3 ? '; …' : ''}`}
              {approvalChain.unresolved > 0 && ` ${approvalChain.unresolved} position(s) still to be named on the chain.`}
            </div>
          )}

          {/* Stage files of this proposal (S1..Sn), each with its own minutes N1..Nx */}
          <div className="ef-routing-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {allNotes.length > 0 ? (
              allNotes.map((n, idx) => (
                <Link
                  key={n.txn_id}
                  to={`/noting/note/${n.txn_id}`}
                  className={`ef-routing-tab ${n.txn_id === txnId ? 'active' : ''}`}
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}
                >
                  <span style={{ fontWeight: 600 }}>S{n.seq || idx + 1}: {n.title}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: '#dcfce7',
                    color: '#15803d'
                  }}>
                    N1–N{n.entry_count || 1}
                  </span>
                  <span style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: n.status === 'approved' ? '#e2f4e8' : n.status === 'draft' ? '#fdf3d7' : '#e3eefb',
                    color: n.status === 'approved' ? '#1e7d43' : n.status === 'draft' ? '#8a6100' : '#1d5fa7'
                  }}>
                    {n.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="ef-routing-tab active" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>S{note.seq}: {note.title}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d' }}>
                  N1–N{data?.entries?.length || 1}
                </span>
              </div>
            )}
          </div>

          {/* Closed stage file: rests in the cabinet; next comes the hand-over or the next stage */}
          {closed && (
            <div className={`banner ${note.status === 'approved' ? 'banner-success' : 'banner-error'}`} style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{note.status === 'approved' ? '✓' : '✕'}</span> S{note.seq} ({note.title}) {NOTE_STATUS_LABEL[note.status]} — Closed &amp; Resting in Cabinet
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Minutes N1 to N{data?.entries?.length || 1} are archived on the Green Sheet. The file rests in the cabinets of its initiator, routing members and the proposal's owners.
                  {proposal?.current?.seq === note.seq && (
                    proposal.awaitingHandOver
                      ? ' Next: the initiator sends it to a tender initiator.'
                      : proposal.next.length > 0
                        ? ` Next: ${proposal.next.map((o) => o.title).join(' / ')}.`
                        : ' The proposal is closed.'
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {proposal?.canHandOver && note.stage_id === 'provisioning' && proposal.current?.seq === note.seq && (
                  <button
                    type="button"
                    className="btn"
                    style={{ background: '#15803d', fontSize: 12 }}
                    disabled={busy}
                    onClick={() => {
                      setMemberPickerPurpose('tender');
                      setShowMemberPicker(true);
                    }}
                  >
                    {proposal.file.tender_initiator ? 'Change Tender Initiator' : 'Send to Tender Initiator'}
                  </button>
                )}
                <Link to="/noting/cabinet" className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
                  Open Cabinet →
                </Link>
              </div>
            </div>
          )}

          {/* Planned Routing Trail for this Stage */}
          {data?.plannedRouting && data.plannedRouting.length > 0 && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#1e40af', marginBottom: 6 }}>
                Planned Stage Routing Trail ({data.plannedRouting.length} Officers)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                {data.plannedRouting.map((m, i) => (
                  <span key={m.id || i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <span style={{ color: '#93c5fd', fontWeight: 'bold' }}>→</span>}
                    <span style={{ background: '#fff', border: '1px solid #dbeafe', padding: '2px 8px', borderRadius: 4 }}>
                      <strong>{m.name}</strong> <span style={{ color: '#64748b', fontSize: 11 }}>({m.designation || m.pb})</span>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Green Noting Sheet: Displays All Chronological Notes N1, N2.. Nx */}
          {isEditingDraft ? (
            <form onSubmit={handleSaveDraft} className="form-section" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div className="form-grid">
                <label className="field-wide">
                  <span className="field-label">Stage Note Title</span>
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
                <span className="field-label">Stage Initial Note (N1) Content</span>
                <RichTextEditor value={newNoteBody} onChange={setNewNoteBody} />
              </div>
              <div className="form-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="btn" disabled={busy}>Save Draft</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingDraft(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="ef-green-sheet">
              <div className="ef-green-sheet-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ef-sheet-badge">HAL GREEN NOTING SHEET</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1b4332' }}>
                    S{note.seq}: {note.title}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#2d6a4f', fontWeight: 600 }}>
                  Sequential Minutes: N1 to N{data?.entries?.length || 1}
                </span>
              </div>

              {(data?.entries && data.entries.length > 0 ? data.entries : [
                {
                  id: 'fallback-1',
                  seq: 1,
                  title: note.title,
                  body: note.body,
                  entry_type: 'initial',
                  author_name: initiator?.name,
                  author_designation: initiator?.designation,
                  author_pb: initiator?.pb,
                  created_at: note.created_at
                }
              ]).map((entry) => (
                <div key={entry.id || entry.seq} className={`ef-noting-item ${entry.entry_type || ''}`}>
                  <div className="ef-noting-item-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="ef-note-tag">N{entry.seq}</span>
                      <span className="ef-note-title">{entry.title || `Minute N${entry.seq}`}</span>
                      <span className={`tag tag-${entry.entry_type === 'approval' ? 'note-approved' : entry.entry_type === 'query' ? 'note-in-check' : 'note-routed'}`} style={{ fontSize: 10 }}>
                        {entry.entry_type === 'initial' ? 'Initial Stage Note' :
                         entry.entry_type === 'query' ? 'Query / Clarification' :
                         entry.entry_type === 'clarification' ? 'Reply / Clarification' :
                         entry.entry_type === 'forward' ? 'Forward Minute' :
                         entry.entry_type === 'sendback' ? 'Return / Send Back' :
                         entry.entry_type === 'approval' ? 'Final Approval' :
                         entry.entry_type === 'rejection' ? 'Rejection' : 'Noting Minute'}
                      </span>
                    </div>
                    <span className="ef-note-time">
                      {new Date(entry.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {entry.remark && entry.remark.trim() !== '' && (
                    <div style={{ background: '#f8fafc', borderLeft: '3px solid #64748b', padding: '6px 12px', margin: '8px 0 12px 0', fontSize: 12, fontStyle: 'italic', color: '#334155', borderRadius: '0 4px 4px 0' }}>
                      <strong>Officer Remark / Concurrence:</strong> {entry.remark}
                    </div>
                  )}

                  <div className="ef-noting-item-body">
                    {entry.seq === 1 && note.source === 'ai' && note.body_text ? (
                      // The pipeline's note: pipe-delimited rows become real tables (NoteRenderer).
                      <NoteRenderer bare note={{ title: note.title, meta: {}, fullOutput: note.body_text, annexures: [] }} />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: entry.body || '<p>—</p>' }} />
                    )}
                  </div>

                  <div className="ef-noting-item-signature">
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Hindustan Aeronautics Limited — e-Governance Division
                    </div>
                    <div className="ef-sig-box">
                      <span className="ef-sig-tick">✓</span>
                      <div style={{ fontSize: 11, lineHeight: 1.3 }}>
                        <div><strong>{entry.author_name || initiator?.name || 'Authorized Officer'}</strong></div>
                        <div style={{ color: '#475569' }}>
                          {entry.author_designation || initiator?.designation || 'HAL Officer'}
                          {entry.author_pb ? ` (PB: ${entry.author_pb})` : initiator?.pb ? ` (PB: ${initiator.pb})` : ''}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          Signed: {new Date(entry.created_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Toolbar for Current Holder */}
          {isHolder && routable && (
            <div className="form-section" style={{ marginTop: 24 }}>
              <div className="form-section-title">Stage Workflow &amp; Noting Actions</div>
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ borderColor: '#2d6a4f', color: '#2d6a4f', fontWeight: 600 }}
                  onClick={() => {
                    setMinuteTitle(`Minute on S${note.seq}`);
                    setMinuteType('minute');
                    setMinuteBody('');
                    setMinuteRemark('');
                    setShowAddMinuteModal(true);
                  }}
                >
                  + Add Noting Minute (N{(data?.entries?.length || 0) + 1})
                </button>

                {note.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditingDraft((v) => !v)}
                    >
                      {isEditingDraft ? 'Close Editor' : 'Edit Draft (N1)'}
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
                      Send for Check
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

          {/* AI Cascade Next Note Actions */}
          {/* AI Cascade: Next Note Options — now in right panel as accordion, removed from main column */}
        </div>

        {/* Right Accordion Panel */}
        <div className="ef-right-panel">
          <div className="ef-panel-actions">
            <button type="button" className="ef-panel-action" onClick={() => window.print()}>
              Download PDF
            </button>
            <button
              type="button"
              className="ef-panel-action"
              onClick={() => {
                if (!summary) fetchSummary(txnId).then((d) => setSummary(d.summary));
              }}
            >
              Proposal Summary
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

          {/* No AI case yet: offer to link one (read-only GET never creates it) */}
          {aiCascade && aiCascade.linked === false && aiCascade.canLink && (
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger"><span>AI Cascade</span></div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <p className="field-hint" style={{ marginTop: 0 }}>
                  No AI case is linked to this file. Link one to draft the next stages with the cascade.
                </p>
                <select
                  className="field-input"
                  value={aiLinkSource}
                  onChange={(e) => setAiLinkSource(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  {(aiCascade.sources || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.label}{s.fixture ? ' [fabricated]' : ''}</option>
                  ))}
                </select>
                <button type="button" className="btn" style={{ width: '100%', fontSize: 11 }} disabled={aiBusy} onClick={handleLinkAiCase}>
                  Link AI case
                </button>
              </div>
            </div>
          )}

          {/* AI Cascade: Allowed Notes — compact accordion in right panel */}
          {kase && kase.status === 'open' && kase.options?.length > 0 && (
            <div className={`ef-accordion-item${accordionOpen.cascade ? ' open' : ''}`}>
              <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('cascade')}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  AI Cascade: Next Notes ({kase.options.length})
                </span>
                <span className="arrow">▼</span>
              </button>
              <div className="ef-accordion-content">
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, padding: '0 4px' }}>
                  Stage {currentStageNo}: {kase.node?.title || 'Next Step'} · {kase.holdingAgency} Agency
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kase.options.map((opt) => (
                    <div key={opt.noteId} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>
                        {opt.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                        {opt.advice?.advised && <span className="pill pill-warning" style={{ fontSize: 9 }}>advised</span>}
                        {opt.needBased && <span className="tag" style={{ fontSize: 9 }}>need-based</span>}
                        {opt.terminal && <span className="pill pill-danger" style={{ fontSize: 9 }}>closes file</span>}
                      </div>
                      {opt.advice?.note && (
                        <div className="field-hint" style={{ fontSize: 10, marginBottom: 6 }}>{opt.advice.note}</div>
                      )}
                      <button
                        type="button"
                        className="btn"
                        style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
                        disabled={aiBusy}
                        onClick={() => handleOpenAiModal(opt.noteId)}
                      >
                        Draft &amp; Raise with AI →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Formats on File Accordion */}
          {kase && kase.formatsOnFile?.length > 0 && (
            <div className="ef-accordion-item open">
              <div className="ef-accordion-trigger" style={{ cursor: 'pointer' }} onClick={() => setShowFormatsModal(true)}>
                <span>Formats on File ({kase.formatsOnFile.length})</span>
                <span className="arrow">↗</span>
              </div>
              <div className="ef-accordion-content" style={{ display: 'block' }}>
                <ul style={{ paddingLeft: 16, margin: 0, fontSize: 11 }}>
                  {kase.formatsOnFile.map((f) => (
                    <li key={f.id} style={{ marginBottom: 4 }}>
                      <strong>{f.title}</strong>{' '}
                      <span className="tag" style={{ fontSize: 9 }}>{f.owner}</span>
                    </li>
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
              <Attachments txnId={txnId} isInitiator={me && me.id === note.initiator_id} canAdd={isHolder} requisitionId={file.requisition_id} />
            </div>
          </div>

          {/* Clarifications: two-party threads (asker + asked), never part of the note body */}
          <div className={`ef-accordion-item${accordionOpen.clarifications ? ' open' : ''}`}>
            <button type="button" className="ef-accordion-trigger" onClick={() => toggleAccordion('clarifications')}>
              <span>Clarifications</span>
              <span className="arrow">▼</span>
            </button>
            <div className="ef-accordion-content">
              {accordionOpen.clarifications && <Clarifications txnId={txnId} me={me} people={members} />}
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

      {/* AI Note Generator Modal */}
      {showAiModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>AI Note Generator: {aiForm?.title || aiPick}</h2>
              <button type="button" className="btn-close" onClick={() => setShowAiModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {!aiForm ? (
                <div className="grid-empty">Loading note inputs and seeded facts…</div>
              ) : (
                <>
                  <div className="field-hint" style={{ marginBottom: 12 }}>
                    {aiForm.hint}
                  </div>

                  {aiForm.carryFrom && (
                    <div className="banner banner-info" style={{ marginBottom: 12 }}>
                      Carries forward prose from <strong>{aiForm.carryFrom}</strong> in code. Only new fields below are drafted by the language model.
                    </div>
                  )}

                  {aiForm.prereqWarnings?.length > 0 && (
                    <div className="banner banner-warning" style={{ marginBottom: 12 }}>
                      <strong>Prerequisite Formats Pending (Warning):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {aiForm.prereqWarnings.map((w) => (
                          <li key={w.id}>
                            {w.title} — owned by {w.owner} Agency {w.required ? '(Required)' : '(Optional)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiConfirm && (
                    <div className="banner banner-restricted" style={{ marginBottom: 12 }}>
                      ⚠️ {aiConfirm.message}
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: 11 }}
                          onClick={() => handleGenerateAiNote(true)}
                          disabled={aiBusy}
                        >
                          Raise Anyway (Record Advisory Override)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="form-grid">
                    {aiForm.fields?.map((f) => (
                      <label className="field-label field-wide" key={f.key}>
                        <span>
                          {f.label} {f.seeded && <span className="tag" style={{ fontSize: 9 }}>seeded</span>}
                        </span>
                        {f.list ? (
                          <textarea
                            className="field-input"
                            rows={2}
                            value={aiFields[f.key] ?? ''}
                            placeholder="semicolons separate list items"
                            onChange={(e) => setAiFields({ ...aiFields, [f.key]: e.target.value })}
                          />
                        ) : (
                          <input
                            className="field-input"
                            value={aiFields[f.key] ?? ''}
                            onChange={(e) => setAiFields({ ...aiFields, [f.key]: e.target.value })}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                disabled={aiBusy || !aiForm}
                onClick={() => handleGenerateAiNote(false)}
              >
                {aiBusy ? 'Generating with AI (SLM)…' : 'Generate Note & Add to File'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={aiBusy}
                onClick={() => setShowAiModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formats on File Modal */}
      {showFormatsModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 750, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Formats on File ({kase?.formatsOnFile?.length || 0})</h2>
              <button type="button" className="btn-close" onClick={() => setShowFormatsModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {(!kase?.formatsOnFile || kase.formatsOnFile.length === 0) ? (
                <div className="grid-empty">No annexure formats generated yet.</div>
              ) : (
                <div>
                  <table className="mini-table" style={{ width: '100%', marginBottom: 16 }}>
                    <thead>
                      <tr>
                        <th>Annexure Name</th>
                        <th>Owning Agency</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kase.formatsOnFile.map((f) => (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 600 }}>{f.title}</td>
                          <td><span className="tag">{f.owner || '—'}</span></td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-inline"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => setSelectedFormat(selectedFormat?.id === f.id ? null : f)}
                            >
                              {selectedFormat?.id === f.id ? 'Hide Data' : 'View Data'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {selectedFormat && (
                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--accent)' }}>
                        Annexure Details: {selectedFormat.title}
                      </h4>
                      <pre style={{ fontSize: 11, background: '#fff', padding: 10, borderRadius: 4, overflowX: 'auto', border: '1px solid var(--border)' }}>
                        {JSON.stringify(selectedFormat.fields, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowFormatsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Noting Minute Modal */}
      {showAddMinuteModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Add Noting Minute (N{(data?.entries?.length || 0) + 1}) — S{note.seq}</h2>
              <button type="button" className="btn-close" onClick={() => setShowAddMinuteModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMinute}>
              <div className="modal-body">
                <div className="form-grid">
                  <label className="field-wide">
                    <span className="field-label">Minute Title</span>
                    <input
                      className="field-input"
                      value={minuteTitle}
                      onChange={(e) => setMinuteTitle(e.target.value)}
                      placeholder={`e.g. Query / Clarification / Sanction Minute N${(data?.entries?.length || 0) + 1}`}
                    />
                  </label>
                  <label>
                    <span className="field-label">Minute Type</span>
                    <select
                      className="field-input"
                      value={minuteType}
                      onChange={(e) => setMinuteType(e.target.value)}
                    >
                      <option value="minute">General Minute (N)</option>
                      <option value="query">Clarification Query</option>
                      <option value="clarification">Clarification Reply</option>
                      <option value="concurrence">Concurrence / Audit Review</option>
                    </select>
                  </label>
                  <label className="field-wide">
                    <span className="field-label">Remark / Comment (Optional)</span>
                    <input
                      className="field-input"
                      value={minuteRemark}
                      onChange={(e) => setMinuteRemark(e.target.value)}
                      placeholder="e.g. Reviewed and concurred for technical approval"
                    />
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className="field-label">Noting Content / Detailed Minute</span>
                  <RichTextEditor
                    value={minuteBody}
                    onChange={setMinuteBody}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn" disabled={busy || !minuteBody.trim()}>
                  {busy ? 'Appending Minute…' : `Append Minute N${(data?.entries?.length || 0) + 1} to Green Sheet`}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMinuteModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Picker Modal */}
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
            : memberPickerPurpose === 'tender'
            ? 'Select the Tender Initiator for this Proposal'
            : 'Select Member for Need-to-Know Share Grant'
        }
      />
    </section>
  );
}
