// Payment-advice document uploads (/api/payment-advices/attachments). Files are real multipart
// uploads; viewing fetches the bytes with the Bearer token and opens them in a new tab.
import { apiFetch } from './api.js';

async function toJson(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export const fetchPaFiles = (paNo) => apiFetch(`/api/payment-advices/attachments?pa=${encodeURIComponent(paNo)}`).then(toJson);

export function uploadPaFile(paNo, key, file) {
  const fd = new FormData();
  fd.append('paNo', paNo);
  fd.append('key', key);
  fd.append('file', file);
  return apiFetch('/api/payment-advices/attachments', { method: 'POST', body: fd }).then(toJson);
}

export async function openPaFile(paNo, key) {
  const res = await apiFetch(`/api/payment-advices/attachments/download?pa=${encodeURIComponent(paNo)}&key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `API error ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
