import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination.jsx';
import MemberPickerModal from '../../components/noting/MemberPickerModal.jsx';
import RichTextEditor from '../../components/noting/RichTextEditor.jsx';
import { CLASSIFICATIONS, NOTE_STATUS_LABEL } from '../../config/notingColumns.jsx';
import {
  fetchCabinet,
  fetchFileStageHistory,
  fetchMembers,
  generateNextStage,
  sendToTenderInitiator
} from '../../lib/notingApi.js';

const REASON_LABEL = {
  initiator: 'Initiator',
  router: 'Router',
  approver: 'Approver',
  tender_initiator: 'Tender initiator'
};

const TONE = {
  approved: ['#e2f4e8', '#1e7d43'],
  rejected: ['#fde2e1', '#b3261e'],
  draft: ['#fdf3d7', '#8a6100']
};

const chipStyle = (status) => {
  const [background, color] = TONE[status] || ['#e3eefb', '#1d5fa7'];
  return { fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap', background, color };
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const stageBody = (title, row) => {
  const cur = row.proposal.current;
  return `<p>Placed below for review and consideration is the <strong>${esc(title)}</strong> for proposal <strong>${esc(row.car_no || row.file_id)}</strong> — ${esc(row.title)}.</p><p>Raised on the result of ${cur ? `S${cur.seq} ${esc(cur.stage_title)}` : 'the previous stage'}; its notes and attachments are placed on record.</p>`;
};

export default function Cabinet() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // proposal: 'all' | 'open' | 'closed'
  const [subTab, setSubTab] = useState('all'); // stage outcome: 'all' | 'approved' | 'rejected'
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Stage History Modal State
  const [historyRow, setHistoryRow] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  // Next Stage Generator Modal State
  const [genRow, setGenRow] = useState(null);
  const [genStageId, setGenStageId] = useState('');
  const [genTitle, setGenTitle] = useState('');
  const [genClassification, setGenClassification] = useState('normal');
  const [genBody, setGenBody] = useState('');
  const [genRoutingList, setGenRoutingList] = useState([]);
  const [genBusy, setGenBusy] = useState(false);

  // Member picker: 'routing' adds an officer to the generator trail, 'tender' hands a proposal over
  const [picker, setPicker] = useState(null);

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

  const openStageHistory = async (row) => {
    setHistoryRow(row);
    setHistoryData(null);
    try {
      setHistoryData(await fetchFileStageHistory(row.file_pk));
    } catch (err) {
      setError(err.message);
      setHistoryRow(null);
    }
  };

  const stageOptions = (row) => [...(row?.proposal.next || []), ...(row?.proposal.other || [])];

  const openGenerate = (row, option) => {
    setGenRow(row);
    setGenStageId(option.stageId);
    setGenTitle(option.title);
    setGenClassification(row.classification || 'normal');
    setGenBody(stageBody(option.title, row));
    setGenRoutingList([]);
    setGenBusy(false);
    setError(null);
  };

  const handleStageSelectChange = (stageId) => {
    const opt = stageOptions(genRow).find((o) => o.stageId === stageId);
    if (!opt) return;
    setGenStageId(stageId);
    setGenTitle(opt.title);
    setGenBody(stageBody(opt.title, genRow));
  };

  const removeMemberFromGenRouting = (idx) => {
    setGenRoutingList((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveGenRouting = (idx, dir) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= genRoutingList.length) return;
    setGenRoutingList((prev) => {
      const arr = [...prev];
      [arr[idx], arr[nextIdx]] = [arr[nextIdx], arr[idx]];
      return arr;
    });
  };

  const handleCreateNextStage = async (e) => {
    e?.preventDefault?.();
    if (!genTitle.trim()) return setError('Stage note title is required.');
    setGenBusy(true);
    setError(null);
    try {
      const res = await generateNextStage(genRow.file_pk, {
        stageId: genStageId,
        title: genTitle,
        body: genBody,
        classification: genClassification,
        routingList: genRoutingList.map((m) => m.id)
      });
      navigate(`/noting/note/${res.txnId}`);
    } catch (err) {
      setError(err.message);
      setGenBusy(false);
    }
  };

  const handlePicked = async (member) => {
    const { purpose, row } = picker;
    setPicker(null);
    if (purpose === 'routing') {
      if (!genRoutingList.some((m) => m.id === member.id)) setGenRoutingList((prev) => [...prev, member]);
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await sendToTenderInitiator(row.file_pk, { memberId: member.id });
      setNotice(`${row.car_no || row.file_id} sent to ${member.name} (${member.pb}) as tender initiator — it now rests in their cabinet.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const nextAction = (r) => {
    const p = r.proposal;
    const cur = p.current;
    const muted = { fontSize: 11, color: 'var(--muted)' };
    const parts = [];
    if (p.canHandOver && r.stage_id === 'provisioning' && r.is_latest) {
      parts.push(
        <button
          key="handover"
          type="button"
          className="btn"
          style={{ fontSize: 11, padding: '4px 10px', background: '#15803d' }}
          onClick={() => setPicker({ purpose: 'tender', row: r })}
        >
          {p.file.tender_initiator ? 'Change Tender Initiator' : 'Send to Tender Initiator'}
        </button>
      );
    }
    if (!r.is_latest && cur) {
      parts.push(<span key="moved" style={muted}>Moved on → S{cur.seq} {cur.stage_title}</span>);
    } else if (p.awaitingHandOver) {
      if (!p.canHandOver) parts.push(<span key="await" style={muted}>Awaiting hand-over to a tender initiator</span>);
    } else if (p.canGenerate) {
      for (const o of p.next) {
        parts.push(
          <button
            key={o.stageId}
            type="button"
            className="btn"
            style={{ fontSize: 11, padding: '4px 10px', background: o.needBased ? '#7c3aed' : '#2563eb' }}
            onClick={() => openGenerate(r, o)}
          >
            Generate {o.title}
          </button>
        );
      }
      if (p.other.length > 0) {
        parts.push(
          <button
            key="other"
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => openGenerate(r, p.other[0])}
          >
            Skip to another stage…
          </button>
        );
      }
    } else if (p.file.status !== 'open') {
      parts.push(<span key="closed" style={muted}>{r.status === 'rejected' ? 'Proposal closed (rejected)' : 'Proposal closed'}</span>);
    }
    if (parts.length === 0) return <span style={muted}>—</span>;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>{parts}</div>;
  };

  const safeRows = Array.isArray(rows) ? rows : [];

  const filtered = safeRows.filter((r) => {
    if (filterTab === 'open' && r.file_status !== 'open') return false;
    if (filterTab === 'closed' && r.file_status === 'open') return false;
    if (subTab !== 'all' && r.status !== subTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [r.title, r.file_id, r.ref_no, r.car_no, r.initiator_name, r.stage_title, REASON_LABEL[r.reason]]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openCount = safeRows.filter((r) => r.file_status === 'open').length;
  const closedCount = safeRows.length - openCount;

  return (
    <section className="screen">
      <div style={{ marginBottom: 8 }}>
        <h1 className="screen-title" style={{ margin: 0 }}>CABINET</h1>
        <p className="screen-sub" style={{ margin: '4px 0 0 0' }}>
          Closed stage files resting after decision. Each stage (S1 Provisioning, S2 EMD / TEC, … Retender, PO Amendment) is its own file with minutes N1..Nx.
          Follow the proposal's current stage, send an approved provisioning to the tender initiator, and generate the next stage.
        </p>
      </div>

      {/* Top Filter Tabs */}
      <div className="ef-filter-tabs">
        <button
          type="button"
          className={`ef-filter-tab${filterTab === 'all' ? ' active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All Stage Files ({safeRows.length})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-open${filterTab === 'open' ? ' active' : ''}`}
          onClick={() => setFilterTab('open')}
        >
          Proposal Open ({openCount})
        </button>
        <button
          type="button"
          className={`ef-filter-tab tab-closed-read${filterTab === 'closed' ? ' active' : ''}`}
          onClick={() => setFilterTab('closed')}
        >
          Proposal Closed ({closedCount})
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="ef-tabs" style={{ marginTop: 12 }}>
        <button type="button" className={`ef-tab${subTab === 'all' ? ' active' : ''}`} onClick={() => setSubTab('all')}>
          ALL ({safeRows.length})
        </button>
        <button type="button" className={`ef-tab${subTab === 'approved' ? ' active' : ''}`} onClick={() => setSubTab('approved')}>
          APPROVED ({safeRows.filter((r) => r.status === 'approved').length})
        </button>
        <button type="button" className={`ef-tab${subTab === 'rejected' ? ' active' : ''}`} onClick={() => setSubTab('rejected')}>
          REJECTED ({safeRows.filter((r) => r.status === 'rejected').length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="ef-search-bar" style={{ maxWidth: 400, marginTop: 12 }}>
        <input
          className="ef-search-input"
          placeholder="Search on Subject / Ref No / MPR No / Stage / Initiator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {notice && <div className="banner banner-success" style={{ marginTop: 12 }}>{notice}</div>}
      {error && !genRow && <div className="banner banner-error" style={{ marginTop: 12 }}>{error}</div>}

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
                  <th>Filed</th>
                  <th>STAGE FILE</th>
                  <th>SUBJECT</th>
                  <th>ORIGINATOR</th>
                  <th>MY ROLE</th>
                  <th>PROPOSAL PROGRESS</th>
                  <th>NOTES</th>
                  <th>NEXT ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const sl = (safePage - 1) * pageSize + i + 1;
                  const p = r.proposal;
                  const cur = p.current;
                  return (
                    <tr key={`${r.file_pk}-${r.seq}`}>
                      <td>{sl}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>
                        {r.placed_at ? new Date(r.placed_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        <Link to={`/noting/note/${r.txn_id}`} className="subject-link">{r.ref_no}</Link>
                        <div style={{ marginTop: 3 }}>
                          <span style={chipStyle(r.status)}>S{r.seq} {r.stage_title} · {NOTE_STATUS_LABEL[r.status] || r.status}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <Link to={`/noting/note/${r.txn_id}`} className="subject-link">{r.title}</Link>
                        {r.car_no && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.car_no}</div>}
                      </td>
                      <td style={{ fontSize: 11 }}>{r.initiator_name || '—'}</td>
                      <td>
                        <span className="tag" style={{ fontSize: 10 }}>{REASON_LABEL[r.reason] || r.reason}</span>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                          {p.stages.map((st, idx) => (
                            <span key={st.seq} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {idx > 0 && <span style={{ color: '#94a3b8', fontSize: 10 }}>→</span>}
                              <span
                                style={{ ...chipStyle(st.status), outline: st.seq === r.seq ? '1px solid currentColor' : 'none' }}
                                title={`${st.ref_no} · ${NOTE_STATUS_LABEL[st.status] || st.status}`}
                              >
                                S{st.seq} {st.stage_title}
                              </span>
                            </span>
                          ))}
                        </div>
                        {cur && (
                          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                            Current: <strong>S{cur.seq} {cur.stage_title}</strong> — {NOTE_STATUS_LABEL[cur.status] || cur.status}
                            {cur.holder_name ? `, with ${cur.holder_name}` : ''}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: '#475569' }}>
                          Tender initiator: <strong>{p.file.tender_initiator?.name || 'not assigned'}</strong>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                          onClick={() => openStageHistory(r)}
                        >
                          📜 History (N1..Nx)
                        </button>
                      </td>
                      <td>{nextAction(r)}</td>
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
      {historyRow && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 880, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>
                  Proposal Stage Files &amp; Notes (N1..Nx)
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  File #{historyRow.file_id}: <strong>{historyRow.title}</strong>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setHistoryRow(null)}>✕</button>
            </div>

            <div className="modal-body">
              {!historyData ? (
                <div className="grid-empty">Loading stage history and noting entries…</div>
              ) : historyData.stages.length === 0 ? (
                <div className="grid-empty">No stage history recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="banner banner-info" style={{ fontSize: 12 }}>
                    ℹ️ <strong>Stage Audit Trail:</strong> Each stage file (Provisioning, EMD, TEC, PBO …) is generated from the result of the one before, carries its own routing trail and starts its minutes afresh at N1.
                  </div>

                  {historyData.stages.map((st) => (
                    <div
                      key={st.seq}
                      style={{
                        background: '#fcfdfc',
                        border: '1px solid #b7e4c7',
                        borderLeft: '5px solid #1e7d43',
                        borderRadius: 'var(--radius)',
                        padding: 16
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#1e7d43', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                              S{st.seq}
                            </span>
                            <strong style={{ fontSize: 14, color: '#14532d' }}>{st.title}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                            Stage: {st.stageTitle} | Ref: <code>{st.ref_no}</code> | Status: <strong style={{ textTransform: 'uppercase' }}>{st.status}</strong>
                          </div>
                        </div>

                        <Link
                          to={`/noting/note/${st.txn_id}`}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setHistoryRow(null)}
                        >
                          Open Stage Green Sheet ↗
                        </Link>
                      </div>

                      {st.history?.length > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>Routing Trail: </span>
                          {st.history.map((step, sIdx) => (
                            <span key={sIdx} style={{ marginRight: 8 }}>
                              {sIdx > 0 && ' → '}
                              <strong>{step.from_name || 'Desk'}</strong>
                              {step.to_id !== step.from_id && <> → {step.to_name}</>}
                              {step.comment && ` ("${step.comment}")`}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="ef-green-sheet" style={{ margin: 0, background: '#f6faf7' }}>
                        <div className="ef-green-sheet-header" style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1b4332' }}>
                            Minutes on Green Sheet (N1 to N{st.entries?.length || 1})
                          </span>
                          <span style={{ fontSize: 10, color: '#2d6a4f' }}>S{st.seq}</span>
                        </div>

                        {st.entries?.length > 0 ? (
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
                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Digitally Signed on e-Office</div>
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
              <button type="button" className="btn btn-secondary" onClick={() => setHistoryRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEXT STAGE GENERATOR MODAL ── */}
      {genRow && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 16, color: '#1d4ed8' }}>
                  ⚡ Generate Stage File S{(genRow.proposal.current?.seq || 0) + 1}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Proposal #{genRow.file_id}{genRow.car_no ? ` (${genRow.car_no})` : ''}: <strong>{genRow.title}</strong>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setGenRow(null)}>✕</button>
            </div>

            <form onSubmit={handleCreateNextStage}>
              <div className="modal-body">
                {error && <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div>}
                <div className="banner banner-info" style={{ marginBottom: 14, fontSize: 12 }}>
                  🏛️ <strong>S{genRow.proposal.current?.seq} {genRow.proposal.current?.stage_title}</strong> is {NOTE_STATUS_LABEL[genRow.proposal.current?.status]?.toLowerCase()}.
                  The new stage is a fresh file under the same proposal: it starts at N1, gets its own routing trail, and rests in the cabinet once decided.
                </div>

                <div className="form-grid">
                  <label className="field-wide">
                    <span className="field-label">Stage</span>
                    <select
                      className="field-input"
                      value={genStageId}
                      onChange={(e) => handleStageSelectChange(e.target.value)}
                    >
                      {genRow.proposal.next.length > 0 && (
                        <optgroup label="Next per the responsibility cascade">
                          {genRow.proposal.next.map((o) => (
                            <option key={o.stageId} value={o.stageId}>{o.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {genRow.proposal.other.length > 0 && (
                        <optgroup label="Skip to another stage">
                          {genRow.proposal.other.map((o) => (
                            <option key={o.stageId} value={o.stageId}>{o.title}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>

                  <label className="field-wide">
                    <span className="field-label">Stage Note Title</span>
                    <input
                      className="field-input"
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                      placeholder="e.g. TEC Request Note"
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
                </div>

                <div style={{ marginTop: 14 }}>
                  <span className="field-label">Initial Stage Note (N1) Content</span>
                  <RichTextEditor value={genBody} onChange={setGenBody} />
                  <span className="field-hint" style={{ fontSize: 11, marginTop: 4 }}>
                    Published as minute N1 of the new stage file. Officers in the routing trail append N2, N3.. Nx.
                  </span>
                </div>

                <div style={{ marginTop: 18, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span className="form-section-title" style={{ color: 'var(--accent)', margin: 0 }}>
                        Configure Stage Routing Trail ({genRoutingList.length} Officers)
                      </span>
                      <div className="field-hint" style={{ fontSize: 11 }}>
                        The ordered officers who will review, question (N2, N3..), clarify and approve this stage.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '4px 10px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                      onClick={() => setPicker({ purpose: 'routing' })}
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
                  {genBusy ? 'Generating Stage…' : 'Generate Stage File (N1) & Open →'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setGenRow(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MemberPickerModal
        isOpen={Boolean(picker)}
        onClose={() => setPicker(null)}
        members={allMembers}
        onSelect={handlePicked}
        title={picker?.purpose === 'tender' ? 'Select the Tender Initiator for this Proposal' : 'Select Officer to Add to Stage Routing Trail'}
      />
    </section>
  );
}
