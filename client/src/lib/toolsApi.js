// Thin wrappers over apiFetch for the Portal Hub tools: the formats library (/api/formats),
// the fixture-backed trackers (/api/trackers), the LD calculator (/api/payment-advices/ld-calc)
// and the price estimate (/api/requisitions/estimate). Nothing here computes anything.
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

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

// Formats library
export const fetchFormats = (params) => getJson(`/api/formats${qs(params)}`);
export const fetchFormat = (id, params) => getJson(`/api/formats/${encodeURIComponent(id)}${qs(params)}`);
export const renderFormat = (id, payload) => postJson(`/api/formats/${encodeURIComponent(id)}/render`, payload);
export const fetchDop = () => getJson('/api/formats/dop');

// Trackers
export const fetchTrackers = () => getJson('/api/trackers');
export const fetchTracker = (name) => getJson(`/api/trackers/${encodeURIComponent(name)}`);

// Calculators (server-side math)
export const ldCalc = (payload) => postJson('/api/payment-advices/ld-calc', payload);
export const priceEstimate = (payload) => postJson('/api/requisitions/estimate', payload);
