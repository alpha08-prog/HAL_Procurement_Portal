import { useEffect, useState } from 'react';
import DataGrid from '../../components/DataGrid.jsx';
import { MEMBER_COLUMNS, UNIT_KIND_LABEL } from '../../config/notingColumns.jsx';
import { fetchMembers, fetchOrg } from '../../lib/notingApi.js';

// Recursively renders the org tree: Corporate > Complex > Division > Dept > Section.
function OrgNode({ unit }) {
  return (
    <li className="org-node">
      <span className="org-node-label">
        <span className={`org-kind org-kind-${unit.kind}`}>{UNIT_KIND_LABEL[unit.kind] || unit.kind}</span>
        {unit.name}
        {unit.code && <span className="org-code">{unit.code}</span>}
      </span>
      {unit.children?.length > 0 && (
        <ul className="org-children">
          {unit.children.map((c) => (
            <OrgNode key={c.id} unit={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Organisation directory: the member-nesting hierarchy + a flat member table.
export default function Organisation() {
  const [tree, setTree] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchOrg(), fetchMembers()])
      .then(([org, mem]) => {
        if (cancelled) return;
        setTree(org.tree);
        setMembers(mem.members);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="screen">
      <h1 className="screen-title">Organisation</h1>
      <p className="screen-sub">
        Member nesting: Corporate Office › Complex › Division › Department › Section › member.
      </p>

      {error && <div className="grid-empty">Could not load organisation: {error}</div>}

      <h2 className="section-heading">Structure</h2>
      {!tree ? (
        <div className="grid-empty">Loading…</div>
      ) : (
        <ul className="org-tree">
          {tree.map((u) => (
            <OrgNode key={u.id} unit={u} />
          ))}
        </ul>
      )}

      <h2 className="section-heading" style={{ marginTop: 'var(--space-5)' }}>
        Members
      </h2>
      <DataGrid columns={MEMBER_COLUMNS} rows={members} emptyMessage="No members seeded." />
    </section>
  );
}
