// Thin wrappers over apiFetch for the Module C noting API (/api/noting/*).
// Keeps screens free of URL/JSON boilerplate; all calls carry the Bearer token.
import { apiFetch } from './api.js';

async function getJson(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function postJson(path, payload) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export const fetchOverview = () => getJson('/api/noting/overview');
export const fetchOrg = () => getJson('/api/noting/org');
export const fetchMembers = () => getJson('/api/noting/members');
export const fetchMe = () => getJson('/api/noting/me');

// Files & notes (Phase 1)
export const fetchFiles = () => getJson('/api/noting/files');
export const fetchNote = (txnId, grant) =>
  getJson(`/api/noting/notes/${encodeURIComponent(txnId)}${grant ? `?grant=${encodeURIComponent(grant)}` : ''}`);
export const initiateFile = (payload) => postJson('/api/noting/files', payload);
export const addNote = (filePk, payload) => postJson(`/api/noting/files/${filePk}/notes`, payload);
export const saveDraft = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/draft`, payload);
export const sendForCheck = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/send-check`, payload);

// Routing (Phase 2)
export const fetchInbox = () => getJson('/api/noting/inbox');
export const fetchCabinet = () => getJson('/api/noting/cabinet');
export const fetchHistory = (txnId) => getJson(`/api/noting/notes/${encodeURIComponent(txnId)}/history`);
export const forwardNote = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/forward`, payload);
export const sendBackNote = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/send-back`, payload);
export const retractNote = (txnId) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/retract`, {});
export const decideNote = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/decision`, payload);
export const retrieveNote = (txnId) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/retrieve`, {});

// Reports (Phase 6) + summary (Phase 7)
export const fetchReport = (name) => getJson(`/api/noting/reports/${name}`);
export const fetchSummary = (txnId) => getJson(`/api/noting/notes/${encodeURIComponent(txnId)}/summary`);

// Attachments (Phase 5)
export const fetchAttachments = (txnId) => getJson(`/api/noting/notes/${encodeURIComponent(txnId)}/attachments`);
export const addAttachment = (txnId, payload) => {
  if (payload instanceof FormData) {
    return apiFetch(`/api/noting/notes/${encodeURIComponent(txnId)}/attachments`, {
      method: 'POST',
      body: payload
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
      return data;
    });
  }
  return postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/attachments`, payload);
};

// Clarifications (Phase 4)
export const fetchClarifications = (txnId) => getJson(`/api/noting/notes/${encodeURIComponent(txnId)}/clarifications`);
export const raiseClarification = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/clarifications`, payload);
export const replyClarification = (id, payload) => postJson(`/api/noting/clarifications/${id}/messages`, payload);

// Classification & access (Phase 3)
export const grantAccess = (txnId, payload) => postJson(`/api/noting/notes/${encodeURIComponent(txnId)}/grant`, payload);
export const fetchGrants = (txnId) => getJson(`/api/noting/notes/${encodeURIComponent(txnId)}/grants`);
export const fetchAlerts = () => getJson('/api/noting/alerts');

// AI pipeline notes (existing bridge) — source for AI-drafted N1.
export const fetchAiNotes = () => getJson('/api/ai/notes');

// eFile FLITE additions
export const fetchSentBox = () => getJson('/api/noting/sentbox');
export const fetchUpcoming = () => getJson('/api/noting/upcoming');
export const fetchDashboard = () => getJson('/api/noting/dashboard');
export const delegateAuthority = (payload) => postJson('/api/noting/delegation', payload);
export const cancelDelegation = () => postJson('/api/noting/delegation/cancel', {});
