// Indian-system grouping (lakh/crore), always rounded: 9905883 -> ₹99,05,883.
// Display-only — amounts always come from the mock API, never computed here.
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatINR(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return '₹' + inr.format(Math.round(Number(value)));
}
