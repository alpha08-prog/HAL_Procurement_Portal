// Indian-system grouping (lakh/crore), always rounded: 9905883 -> ₹99,05,883.
// Display-only — amounts always come from the mock API, never computed here.
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatINR(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return '₹' + inr.format(Math.round(Number(value)));
}

// Plain grouped amount with two decimals (no ₹), e.g. 2016384 -> "20,16,384.00".
// Used by the HAL payment documents, which render figures the way IFS prints them.
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAmount(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return inr2.format(Number(value));
}
