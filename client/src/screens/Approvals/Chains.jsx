import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataGrid from '../../components/DataGrid.jsx';
import { CHAIN_COLUMNS } from '../../config/approvalColumns.jsx';
import { canAccessPath } from '../../config/roles.js';
import { useRole } from '../../context/RoleContext.jsx';
import { fetchChains } from '../../lib/approvalsApi.js';

// Every file currently moving through an approval chain, and whether the gate has let it go.
export default function Chains() {
  const { role } = useRole();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChains().then((d) => setRows(d.chains)).catch((e) => setError(e.message));
  }, []);

  const open = (rows ?? []).filter((r) => !r.decision).length;
  const held = (rows ?? []).filter((r) => r.decision === 'approve' && !r.released).length;

  return (
    <section className="screen">
      <h1 className="screen-title">Approval Files</h1>
      <p className="screen-sub">
        Files travelling their internal approval chain. A file is released to the next agency
        only once the CFA has approved and every authority the indentor’s checklist obliged
        has acted.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="metric-cards">
        <div className="metric-card">
          <div className="metric-value">{rows?.length ?? '—'}</div>
          <div className="metric-label">files</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{rows ? open : '—'}</div>
          <div className="metric-label">still moving</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{rows ? held : '—'}</div>
          <div className="metric-label">approved but held by the gate</div>
        </div>
      </div>

      {canAccessPath(role, '/approvals/intake') && (
        <div className="form-actions">
          <Link className="btn" to="/approvals/intake">+ New indent intake</Link>
        </div>
      )}

      <DataGrid
        columns={CHAIN_COLUMNS}
        rows={rows}
        emptyMessage="No approval files yet — start one from the Indent Intake screen."
      />
    </section>
  );
}
