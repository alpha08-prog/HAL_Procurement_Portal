// Thin wrappers over apiFetch for the requisition register (/api/requisitions/*).
// Requisition nos contain slashes, so every path uses the numeric id.
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
    body: JSON.stringify(payload ?? {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `API error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const fetchRequisitionKinds = () => getJson('/api/requisitions/kinds');
export const fetchRequisitions = (params) => getJson(`/api/requisitions${qs(params)}`);
export const fetchRequisition = (id) => getJson(`/api/requisitions/${id}`);
export const createRequisition = (payload) => sendJson('POST', '/api/requisitions', payload);
export const patchRequisition = (id, payload) => sendJson('PATCH', `/api/requisitions/${id}`, payload);
export const estimateRequisition = (id, inputs) => sendJson('POST', `/api/requisitions/${id}/estimate`, inputs);
export const fetchTenderDoc = (id) => getJson(`/api/requisitions/${id}/tender-doc`);
