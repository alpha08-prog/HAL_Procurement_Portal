// Thin wrappers over apiFetch for the interactive AI cascade (/api/ai/*).
// Same shape as notingApi.js — screens stay free of URL boilerplate.
import { apiFetch } from './api.js';

async function getJson(path) {
  const res = await apiFetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

// Some refusals carry structure the screen needs — an advisory rule pointing elsewhere
// comes back 428 with `needsOverride`, so the error is thrown with those fields attached.
async function postJson(path, payload) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `API error ${res.status}`);
    err.status = res.status;
    err.needsOverride = Boolean(data?.needsOverride);
    err.advised = data?.advised ?? null;
    throw err;
  }
  return data;
}

// Who am I, in cascade terms — which of the two agencies may this position act for?
export const fetchMyPosition = () => getJson('/api/ai/me');
export const fetchSlmHealth = () => getJson('/api/ai/slm');
export const fetchCascade = () => getJson('/api/ai/cascade');
export const fetchBlock1 = () => getJson('/api/ai/checklist-block1');
export const fetchSources = () => getJson('/api/ai/cases/sources');

// Cases — shared files, each flagged with whether it is waiting on this position.
export const fetchCases = () => getJson('/api/ai/cases');
export const fetchCase = (id) => getJson(`/api/ai/cases/${id}`);
export const openCase = (payload) => postJson('/api/ai/cases', payload);

// The editable, pre-filled form for one note.
export const fetchNoteForm = (id, noteId) => getJson(`/api/ai/cases/${id}/form/${noteId}`);

// Raise a note — generation happens server-side and can take a while on first call.
export const raiseNote = (id, payload) => postJson(`/api/ai/cases/${id}/notes`, payload);

// Take the file across to your agency.
export const handOver = (id, toAgency) => postJson(`/api/ai/cases/${id}/handover`, { toAgency });

// The read-only view of what the Python CLI wrote (the existing AI Documents screen).
export const fetchAiNotes = () => getJson('/api/ai/notes');
