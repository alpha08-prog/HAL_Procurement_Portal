// Presentation-only derivations for the HAL payment documents. None of this is money
// math (all amounts come from the server) — just labels/ids/dates the printed forms
// carry that aren't stored explicitly on the PA.
export const controlNo = (pa) => `NSK/${pa.paNo}`;

export function fyOf(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function paymentSlNo(pa) {
  const seq = pa.paNo.match(/(\d+)$/)?.[1] ?? '000';
  return `HAL/NK/${fyOf(pa.createdDate)}/${seq}`;
}

// GSTIN embeds the PAN at positions 3–12 (2 state digits + 10-char PAN + 3).
export const panFromGstin = (gstin) =>
  gstin && gstin.length >= 12 ? gstin.slice(2, 12) : '—';

export function vendorEmail(pa) {
  const slug = (pa.vendorName ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  return slug ? `${slug}@gmail.com` : '—';
}

const DAY = 86400000;
export function delayDays(pa) {
  if (!pa.deliveryDueDate || !pa.receiptDate) return 0;
  const d = Math.round((new Date(pa.receiptDate) - new Date(pa.deliveryDueDate)) / DAY);
  return d > 0 ? d : 0;
}

// Date a PA reached a lifecycle state, from its history (for document "Dated" fields).
export const dateReached = (pa, to) => pa.history?.find((h) => h.to === to)?.date ?? null;

export const isMsme = (pa) => pa.mseCategory && pa.mseCategory !== 'Non-MSE';
