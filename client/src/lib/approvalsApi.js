// Thin wrappers over apiFetch for the Module E approvals API (/api/approvals/*).
// Same shape as notingApi.js / contractsApi.js — screens stay free of URL boilerplate.
import { apiFetch } from './api.js';

async function getJson(path) {
  const res = await apiFetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
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

const qs = (params) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

// Reference data
export const fetchMeta = () => getJson('/api/approvals/meta');
export const fetchDirectory = (params = {}) => getJson(`/api/approvals/directory${qs(params)}`);
export const fetchHead = (division, dept) => getJson(`/api/approvals/head${qs({ division, dept })}`);

// The indentor checklist — the intake form whose answers decide who must approve
export const fetchChecklist = () => getJson('/api/approvals/checklist');
export const previewInjections = (answers) => postJson('/api/approvals/checklist/preview', { answers });
export const submitChecklist = (payload) => postJson('/api/approvals/checklist/submissions', payload);
export const fetchSubmissions = () => getJson('/api/approvals/checklist/submissions');

// Resolve a chain without starting it
export const planChain = (payload) => postJson('/api/approvals/plan', payload);

// Live chains
export const fetchChains = () => getJson('/api/approvals/chains');
export const fetchChain = (id) => getJson(`/api/approvals/chains/${id}`);
export const startChain = (payload) => postJson('/api/approvals/chains', payload);
export const actOnChain = (id, payload) => postJson(`/api/approvals/chains/${id}/hops`, payload);

// Committees (TEC, PNC)
export const fetchCommittees = () => getJson('/api/approvals/committees');
export const fetchCommittee = (id) => getJson(`/api/approvals/committees/${id}`);
export const createCommittee = (payload) => postJson('/api/approvals/committees', payload);
export const signCommitteeMember = (id, memberId, payload) =>
  postJson(`/api/approvals/committees/${id}/members/${memberId}/sign`, payload);

// Bid evaluation — the EMD and TEC decisions
export const fetchBids = () => getJson('/api/approvals/bids');
