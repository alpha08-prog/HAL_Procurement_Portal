// Thin wrappers over apiFetch for the Module D contracts API (/api/contracts/*).
// Keeps screens free of URL/JSON boilerplate; all calls carry the Bearer token.
import { apiFetch } from './api.js';

async function getJson(path) {
  const res = await apiFetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

async function sendJson(method, path, payload) {
  const res = await apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

// Contract Generation window lookups
export const fetchTenders = () => getJson('/api/contracts/tenders');
export const lookupTender = (tenderNo) => getJson(`/api/contracts/lookup?tender=${encodeURIComponent(tenderNo)}`);
export const lookupPo = (tenderNo, poNo) =>
  getJson(`/api/contracts/lookup/po?tender=${encodeURIComponent(tenderNo)}&po=${encodeURIComponent(poNo)}`);
export const fetchClausePlan = (typeId) => getJson(`/api/contracts/clause-plan?type=${encodeURIComponent(typeId)}`);
export const fetchFormats = () => getJson('/api/contracts/formats');

// Lifecycle + register (contract nos contain slashes → numeric id in paths)
export const fetchRegister = () => getJson('/api/contracts');
export const fetchContract = (id) => getJson(`/api/contracts/${id}`);
export const generateContract = (payload) => sendJson('POST', '/api/contracts', payload);
export const patchContract = (id, payload) => sendJson('PATCH', `/api/contracts/${id}`, payload);
export const finaliseContract = (id) => sendJson('POST', `/api/contracts/${id}/finalise`, {});
export const verifyContract = (id) => getJson(`/api/contracts/${id}/verify`);

// STC clause library (amendment is admin-only — the server enforces the account role)
export const fetchLibrary = () => getJson('/api/contracts/library');
export const fetchClauseHistory = (clauseId) => getJson(`/api/contracts/library/clauses/${clauseId}/history`);
export const amendClause = (clauseId, payload) => sendJson('PUT', `/api/contracts/library/clauses/${clauseId}`, payload);
