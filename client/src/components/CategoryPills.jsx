import StatusPill from './StatusPill.jsx';

// The doc's three vendor categories (MSE/Non-MSE, Women/NA, SC-ST/NA) in one cell.
// The MSE pill always shows; Women / SC-ST pills appear only when applicable.
export default function CategoryPills({ category, women, scSt }) {
  return (
    <div className="pill-row">
      <StatusPill status={category ?? 'Non-MSE'} />
      {women && women !== 'NA' && <StatusPill status="Women" />}
      {scSt && scSt !== 'NA' && <StatusPill status="SC-ST" />}
    </div>
  );
}
