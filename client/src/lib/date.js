// Fixtures store ISO dates (YYYY-MM-DD); the UI shows DD/MM/YYYY everywhere.
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('T')[0].split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}
