import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import { CLASSIFICATIONS } from '../../config/notingColumns.jsx';
import {
  fetchCabinet,
  fetchFileStageHistory,
  generateNextStage,
  fetchMembers
} from '../../lib/notingApi.js';

function PriorityBadge({ value }) {
  const cls = value === 'High' ? 'ef-priority-high' : value === 'Medium' ? 'ef-priority-medium' : 'ef-priority-low';
  return <span className={cls}>{value || 'Medium'}</span>;
}

const DEFAULT_STAGE_OPTIONS = [
  { id: 'tender_opened', title: 'Tender Document & NIT Formulation', label: 'Stage 2: Tender / NIT Formulation' },
  { id: 'tec_stage', title: 'Technical Evaluation Committee (TEC) Request', label: 'Stage 3: Technical Evaluation (TEC)' },
  { id: 'post_pbo', title: 'Commercial Bid Opening & Ranking (PBO)', label: 'Stage 4: Price Bid Opening (PBO)' },
  { id: 'pnc_stage', title: 'Price Negotiation Committee (PNC) Sanction', label: 'Stage 5: Price Negotiation (PNC)' },
  { id: 'post_pnc_rec', title: 'Post-PNC Final Purchase Recommendation', label: 'Stage 6: Purchase Recommendation' },
  { id: 'post_pp', title: 'Purchase Proposal (PP) Sanction', label: 'Stage 7: Purchase Proposal (PP)' },
  { id: 'post_po', title: 'Purchase Order (PO) & Contract Issuance', label: 'Stage 8: PO & Contract Issuance' }
];

export default function Cabinet() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [error, setError] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'open' | 'closed'
  const [subTab, setSubTab] = useState('all'); // 'all' | 'approved' | 'rejected'
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Stage History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeHistoryFile, setActiveHistoryFile] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Next Stage Generator Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeGenFile, setActiveGenFile] = useState(null);
  const [genStageId, setGenStageId] = useState('');
  const [genTitle, setGenTitle] = useState('');
  const [genClassification, setGenClassification] = useState('normal');
  const [genPriority, setGenPriority] = useState('Medium');
  const [genBody, setGenBody] = useState('');
  const [genRoutingList, setGenRoutingList] = useState([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  const load = () =>
    fetchCabinet()
      .then((d) => setRows(d.cabinet || []))
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
    fetchMembers().then((d) => setAllMembers(d?.members || [])).catch(() => setAllMembers([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterTab, subTab]);

  // Open Stage History Viewer
  const openStageHistory = async (row) => {
    setActiveHistoryFile(row);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const data = await fetchFileStageHistory(row.file_pk);
      setHistoryData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Next Stage Generator
  const openGenerateStage = (row) => {
    setActiveGenFile(row);
    // Find next allowed options
    const options = row.allowed_options && row.allowed_options.length > 0
      ? row.allowed_options
      : DEFAULT_STAGE_OPTIONS;
    const initialStage = options[0]?.id || row.next_stage || 'tender_opened';
    const initialTitle = options[0]?.title || row.next_stage_title || 'Tender Document & NIT Formulation';

    setGenStageId(initialStage);
    setGenTitle(initialTitle);
    setGenClassification(row.classification || 'normal');
    setGenPriority(row.priority || 'Medium');
    setGenBody(
      `<p>Placed below for review and consideration is the draft stage note for <strong>${initialTitle}</strong> regarding e-file <strong>${row.title}</strong>.</p><p>All prerequisites from preceding stages have been fulfilled.</p>`
    );
    // Default initial routing with Chief Manager / Gaurav Yadav if available
    const gaurav = allMembers.find((m) => m.pb === 'PB-41060');
    setGenRoutingList(gaurav ? [gaurav] : []);
    setShowGenerateModal(true);
  };

  const handleStageSelectChange = (stageId) => {
    setGenStageId(stageId);
    const opt = (activeGenFile?.allowed_options || DEFAULT_STAGE_OPTIONS).find((o) => o.id === stageId);
    const title = opt?.title || opt?.label || 'Next Stage Note';
    setGenTitle(title);
    setGenBody(
      `<p>Placed below for review and consideration is the draft stage note for <strong>${title}</strong> regarding e-file <strong>${activeGenFile?.title || ''}</strong>.</p><p>Prerequisites from previous stages have been verified and placed on record.</p>`
    );
  };

  const addMemberToGenRouting = (member) => {
    if (genRoutingList.some((m) => m.id === member.id)) return;
    setGenRoutingList((prev) => [...prev, member]);
  };

  const removeMemberFromGenRouting = (idx) => {
    setGenRoutingList((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveGenRouting = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= genRoutingList.length) return;
    setGenRoutingList((prev) => {
      const arr = [...prev];
      const temp = arr[idx];
      arr[idx] = arr[nextIdx];
      arr[nextIdx] = temp;
      return arr;
    });
  };

  const handleCreateNextStage = async (e) => {
    e?.preventDefault?.();
    if (!genTitle.trim()) return setError('Stage note title is required.');
    setGenBusy(true);
    setError(null);
    try {
      const res = await generateNextStage(activeGenFile.file_pk, {
        stageId: genStageId,
        title: genTitle,
        body: genBody,
        classification: genClassification,
        priority: genPriority,
        routingList: genRoutingList.map((m) => m.id)
      });
      setShowGenerateModal(false);
      navigate(`/noting/note/${res.txn_id}`);
    } catch (err) {
      setError(err.message);
      setGenBusy(false);
    }
  };

  const safeRows = Array.isArray(rows) ? rows : [];

  const filtered = safeRows.filter((r) => {
    if (filterTab === 'open' && r.file_status !== 'open') return false;
    if (filterTab === 'closed' && r.file_status === 'open') return false;

    if (subTab === 'approved' && r.status === 'rejected') return false;
    if (subTab === 'rejected' && r.status !== 'rejected') return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.title || '').toLowerCase().includes(q) ||
      (r.file_id || '').toLowerCase().includes(q) ||
      (r.initiator_name || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

  const totalFiltered = filtered?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered?.slice((safePage - 1) * pageSize, safePage * pageSize) || [];

  const openCount = safeRows.filter((r) => r.file_status === 'open').length;
  const closedCount = safeRows.filter((r) => r.file_status !== 'open').length;

  return (
    <section className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <div>
          <h1 className="screen-title" style={{ margin: 0 }}>CABINET</h1>
          <p className="screen-sub" style={{ margin: '4px 0 0 0' }}>
            Files resting after stage completion. Inspect multi-stage noting history (N1..Nx) and generate subsequent procurement stages with configured routing trails.
          </p>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#16a34a', fontWeight: 800 }}>🏛️</span>
          <span>
            <strong>Gaurav Yadav</strong> (Chief Manager / Purchase Manager, PB-41060)
          </span>
        </div>
      </div>

      {/* Top Filter Tabs */}
      <div className="ef-filter-tabs">
        <button
          type="button"
          className={`ef-filter-tab${filterTab === 'all' ? ' active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All Cabinet Files ({safeRows.length})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-open${filterTab === 'open' ? ' active' : ''}`}
          onClick={() => setFilterTab('open')}
        >
          Open Stages ({openCount})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-closed-read${filterTab === 'closed' ? ' active' : ''}`}
          onClick={() => setFilterTab('closed')}
        >
          Completed Stages ({closedCount})
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="ef-tabs" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`ef-tab${subTab === 'all' ? ' active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          ALL ({safeRows.length})
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'approved' ? ' active' : ''}`}
          onClick={() => setSubTab('approved')}
        >
          APPROVED FILES ({safeRows.filter((r) => r.status !== 'rejected').length})
        </button>
        <button
          type="button"
          className={`ef-tab${subTab === 'rejected' ? ' active' : ''}`}
          onClick={() => setSubTab('rejected')}
        >
          REJECTED FILES ({safeRows.filter((r) => r.status === 'rejected').length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="ef-search-bar" style={{ maxWidth: 400, marginTop: 12 }}>
        <input
          className="ef-search-input"
          placeholder="Search on Subject / Ref No / Initiator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

      {!rows ? (
        <div className="grid-empty">Loading cabinet…</div>
      ) : filtered.length === 0 ? (
        <div className="grid-empty">Your cabinet is empty for this view.</div>
      ) : (
        <div className="grid-container" style={{ marginTop: 12 }}>
          <div className="grid-wrap">
            <table className="ef-inbox-table">
              <thead>
                <tr>
                  <th>SL</th>
                  <th>Placed Date</th>
                  <th>File Ref.No</th>
                  <th>SUBJECT</th>
                  <th>ORIGINATOR</th>
                  <th>ROLE IN FILE</th>
                  <th>STAGES COMPLETED</th>
                  <th>STAGE HISTORY &amp; NOTES</th>
                  <th>GENERATE NEXT STAGE</th>
                  <th>FILE ID</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const sl = (safePage - 1) * pageSize + i + 1;
                  const stagesCount = r.stages?.length || 1;
                  return (
                    <tr key={r.file_pk || i}>
                      <td>{sl}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                        {r.placed_at ? new Date(r.placed_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>{r.file_id}</td>
                      <td style={{ maxWidth: 260 }}>
                        <Link to={`/noting/note/${r.txn_id || r.last_txn}`} className="subject-link">
                          {r.title}
                        </Link>
                      </td>
                      <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                      <td>
                        <span className="tag" style={{ textTransform: 'capitalize', fontSize: 10 }}>
                          {r.reason || 'Resting at Cabinet'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {r.stages && r.stages.length > 0 ? (
                            r.stages.map((st) => (
                              <span
                                key={st.stage_no}
                                style={{
                                  fontSize: 10,
                                  background: st.status === 'approved' ? '#e2f4e8' : '#e3eefb',
                                  color: st.status === 'approved' ? '#1e7d43' : '#1d5fa7',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontWeight: 600
                                }}
                              >
                                Stage {st.stage_no}: {st.title} (N1–N{st.entry_count || 1})
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 10, background: '#e2f4e8', color: '#1e7d43', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              Stage 1: Provisioning (N1–N5)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => openStageHistory(r)}
                        >
                          <span>📜</span>
                          <span>View History (N1..Nx)</span>
                        </button>
                      </td>
                      <td>
                        {r.file_status !== 'closed' ? (
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: 11, padding: '4px 10px', background: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => openGenerateStage(r)}
                          >
                            <span>⚡</span>
                            <span>Generate Next Stage</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Closed &amp; Archived</span>
                        )}
                      </td>
                      <td><span className="ef-file-id">#{r.file_id}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid-footer">
            <Pagination
              currentPage={safePage}
              totalItems={totalFiltered}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[20, 50, 100]}
            />
          </div>
        </div>
      )}

      {/* ── STAGE HISTORY MODAL ── */}
      {showHistoryModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 880, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
                  File Stage History &amp; Chronological Notes (N1..Nx)
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  File #{activeHistoryFile?.file_id}: <strong>{activeHistoryFile?.title}</strong>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {historyLoading ? (
                <div className="grid-empty">Loading stage history and noting entries…</div>
              ) : !historyData || !historyData.stages || historyData.stages.length === 0 ? (
                <div className="grid-empty">No stage history recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="banner banner-info" style={{ fontSize: 12 }}>
                    ℹ️ <strong>Stage Audit Trail:</strong> Each procurement stage (e.g., Provisioning, Tender, Technical Evaluation) possesses its own separate routing trail and green sheet entries (N1, N2.. Nx) detailing queries, replies, concurrences, and approvals.
                  </div>

                  {historyData.stages.map((st) => (
                    <div
                      key={st.stage_no}
                      style={{
                        background: '#fcfdfc',
                        border: '1px solid #b7e4c7',
                        borderLeft: '5px solid #1e7d43',
                        borderRadius: 'var(--radius)',
                        padding: 16
                      }}
                    >
                      {/* Stage Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#1e7d43', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                              STAGE {st.stage_no}
                            </span>
                            <strong style={{ fontSize: 14, color: '#14532d' }}>{st.title}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                            Stage ID: <code>{st.stage_id}</code> | Ref: <code>{st.ref_no}</code> | Status: <strong style={{ textTransform: 'uppercase' }}>{st.status}</strong>
                          </div>
                        </div>

                        <Link
                          to={`/noting/note/${st.txn_id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setShowHistoryModal(false)}
                        >
                          Open Stage Green Sheet ↗
                        </Link>
                      </div>

                      {/* Stage Routing Steps Summary */}
                      {st.routing_steps && st.routing_steps.length > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Stage Routing Trail: </span>
                          {st.routing_steps.map((step, sIdx) => (
                            <span key={sIdx} style={{ marginRight: 8 }}>
                              {sIdx > 0 && ' → '}
                              <strong>{step.from_name || 'Desk'}</strong>
                              {step.comment && ` ("${step.comment}")`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Green Noting Sheet for this Stage */}
                      <div className="ef-green-sheet" style={{ margin: 0, background: '#f6faf7' }}>
                        <div className="ef-green-sheet-header" style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1b4332' }}>
                            Minutes on Green Sheet (N1 to N{st.entries?.length || 1})
                          </span>
                          <span style={{ fontSize: 10, color: '#2d6a4f' }}>
                            Stage {st.stage_no}
                          </span>
                        </div>

                        {st.entries && st.entries.length > 0 ? (
                          st.entries.map((entry) => (
                            <div key={entry.id || entry.seq} className={`ef-noting-item ${entry.entry_type || ''}`} style={{ margin: '8px 12px', padding: 12 }}>
                              <div className="ef-noting-item-head" style={{ marginBottom: 8, paddingBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className="ef-note-tag">N{entry.seq}</span>
                                  <strong style={{ fontSize: 12, color: '#1e293b' }}>{entry.title || `Minute N${entry.seq}`}</strong>
                                  <span className={`tag tag-${entry.entry_type === 'approval' ? 'note-approved' : entry.entry_type === 'query' ? 'note-in-check' : 'note-routed'}`} style={{ fontSize: 9 }}>
                                    {entry.entry_type === 'initial' ? 'Initial Stage Note' :
                                     entry.entry_type === 'query' ? 'Query / Clarification' :
                                     entry.entry_type === 'clarification' ? 'Clarification Reply' :
                                     entry.entry_type === 'approval' ? 'Approval Decision' :
                                     entry.entry_type === 'rejection' ? 'Rejection' : 'Noting Minute'}
                                  </span>
                                </div>
                                <span className="ef-note-time" style={{ fontSize: 10 }}>
                                  {new Date(entry.created_at).toLocaleString('en-IN')}
                                </span>
                              </div>

                              {entry.remark && entry.remark.trim() !== '' && (
                                <div style={{ background: '#f8fafc', borderLeft: '3px solid #64748b', padding: '4px 10px', margin: '4px 0 8px 0', fontSize: 11, fontStyle: 'italic', color: '#334155' }}>
                                  <strong>Remark:</strong> {entry.remark}
                                </div>
                              )}

                              <div className="ef-noting-item-body" style={{ fontSize: 12, lineHeight: 1.6 }}>
                                <div dangerouslySetInnerHTML={{ __html: entry.body || '<p>—</p>' }} />
                              </div>

                              <div className="ef-noting-item-signature" style={{ marginTop: 8, paddingTop: 6 }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                  Digitally Signed on e-Office
                                </div>
                                <div className="ef-sig-box" style={{ padding: '4px 8px' }}>
                                  <span className="ef-sig-tick" style={{ fontSize: 13 }}>✓</span>
                                  <div style={{ fontSize: 10 }}>
                                    <div><strong>{entry.author_name || 'Officer'}</strong></div>
                                    <div style={{ color: '#475569' }}>
                                      {entry.author_designation || 'HAL Officer'}
                                      {entry.author_pb ? ` (PB: ${entry.author_pb})` : ''}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>
                            No detailed minutes recorded for this stage yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEXT STAGE GENERATOR MODAL ── */}
      {showGenerateModal && activeGenFile && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 16, color: '#1d4ed8' }}>
                  ⚡ Generate Next Stage Note
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  File #{activeGenFile.file_id}: <strong>{activeGenFile.title}</strong>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowGenerateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateNextStage}>
              <div className="modal-body">
                <div className="banner banner-info" style={{ marginBottom: 14, fontSize: 12 }}>
                  🏛️ <strong>Purchase Manager Desk (Gaurav Yadav / PB-41060):</strong> As the file rests at the Cabinet following completion of the prior stage, you can now generate the next sequential stage (e.g. Tender Formulation, TEC Scrutiny, Commercial Opening) and establish its fresh routing trail. Sequential minutes (N1, N2.. Nx) will begin anew for this stage.
                </div>

                <div className="form-grid">
                  <label className="field-wide">
                    <span className="field-label">Select Next Stage</span>
                    <select
                      className="field-input"
                      value={genStageId}
                      onChange={(e) => handleStageSelectChange(e.target.value)}
                    >
                      {(activeGenFile.allowed_options && activeGenFile.allowed_options.length > 0
                        ? activeGenFile.allowed_options
                        : DEFAULT_STAGE_OPTIONS
                      ).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label || opt.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-wide">
                    <span className="field-label">Stage Note Title</span>
                    <input
                      className="field-input"
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                      placeholder="e.g. Notice Inviting Tender &amp; Tender Document Formulation"
                    />
                  </label>

                  <label>
                    <span className="field-label">Classification</span>
                    <select
                      className="field-input"
                      value={genClassification}
                      onChange={(e) => setGenClassification(e.target.value)}
                    >
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="field-label">Priority</span>
                    <select
                      className="field-input"
                      value={genPriority}
                      onChange={(e) => setGenPriority(e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                </div>

                {/* Stage Initial Note (N1) Content */}
                <div style={{ marginTop: 14 }}>
                  <span className="field-label">Initial Stage Note (N1) Content</span>
                  <RichTextEditor
                    value={genBody}
                    onChange={setGenBody}
                  />
                  <span className="field-hint" style={{ fontSize: 11, marginTop: 4 }}>
                    This will be published as Minute N1 on the Green Sheet of this stage. Officers in the routing trail will append subsequent minutes (N2, N3.. Nx).
                  </span>
                </div>

                {/* Configure Stage Routing Trail */}
                <div style={{ marginTop: 18, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span className="form-section-title" style={{ color: 'var(--accent)', margin: 0 }}>
                        Configure Stage Routing Trail ({genRoutingList.length} Officers)
                      </span>
                      <div className="field-hint" style={{ fontSize: 11 }}>
                        Define the ordered trail of officers who will review, question (N2, N3..), clarify, and approve this stage.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '4px 10px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      onClick={() => setShowMemberPicker(true)}
                    >
                      + Add Officer to Trail
                    </button>
                  </div>

                  {genRoutingList.length === 0 ? (
                    <div style={{ padding: 12, background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 6, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                      No officers added yet. Click "+ Add Officer to Trail" to configure sequential reviewers.
                    </div>
                  ) : (
                    <table className="mini-table" style={{ width: '100%', background: '#fff', borderRadius: 4, overflow: 'hidden', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Hop</th>
                          <th>Officer Name</th>
                          <th>Designation</th>
                          <th>PB No</th>
                          <th>Department / Unit</th>
                          <th>Reorder / Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {genRoutingList.map((m, idx) => (
                          <tr key={m.id || idx}>
                            <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                            <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.name}</td>
                            <td>{m.designation || '—'}</td>
                            <td><code>{m.pb}</code></td>
                            <td>{m.unit_path || m.unit || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" className="action-btn" onClick={() => moveGenRouting(idx, -1)} disabled={idx === 0}>↑</button>
                                <button type="button" className="action-btn" onClick={() => moveGenRouting(idx, 1)} disabled={idx === genRoutingList.length - 1}>↓</button>
                                <button type="button" className="action-btn danger" onClick={() => removeMemberFromGenRouting(idx)}>✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn" disabled={genBusy || !genTitle.trim()} style={{ background: '#2563eb' }}>
                  {genBusy ? 'Generating Stage…' : 'Generate Stage Note (N1) & Start Routing →'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Picker Modal for Stage Routing Builder */}
      <MemberPickerModal
        isOpen={showMemberPicker}
        onClose={() => setShowMemberPicker(false)}
        members={allMembers}
        onSelect={(m) => {
          addMemberToGenRouting(m);
          setShowMemberPicker(false);
        }}
        title="Select Officer to Add to Stage Routing Trail"
      />
    </section>
  );
}
