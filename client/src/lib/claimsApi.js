// Thin wrappers over apiFetch for the claims API (/api/claims/*). Claim nos contain slashes,
// so they travel in the JSON body, never as path segments.
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
    body: JSON.stringify(payload ?? {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export const fetchClaims = (tab) => getJson(`/api/claims${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`);
export const fetchClaimEnums = () => getJson('/api/claims/enums');
export const fetchDiscrepancies = () => getJson('/api/claims/discrepancies');
export const raiseClaim = (payload) => postJson('/api/claims', payload);
export const transitionClaim = (claimNo, action, payload) => postJson('/api/claims/transition', { claimNo, action, ...(payload || {}) });
