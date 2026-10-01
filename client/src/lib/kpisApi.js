// Thin wrappers over apiFetch for the computed KPIs (/api/kpis) and the payment-desk
// analytics (/api/payment-advices/kpis). Every number comes from the server.
import { apiFetch } from './api.js';

async function getJson(path) {
  const res = await apiFetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}

export const fetchKpis = (months) => getJson(`/api/kpis${months ? `?months=${encodeURIComponent(months)}` : ''}`);
export const fetchKpi = (code, months) => getJson(`/api/kpis/${encodeURIComponent(code)}${months ? `?months=${encodeURIComponent(months)}` : ''}`);
export const fetchPaymentKpis = (months) => getJson(`/api/payment-advices/kpis${months ? `?months=${encodeURIComponent(months)}` : ''}`);
