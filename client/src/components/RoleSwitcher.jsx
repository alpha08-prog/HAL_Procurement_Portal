import { ROLES } from '../config/roles.js';
import { useRole } from '../context/RoleContext.jsx';

export default function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <label className="role-switcher">
      <span className="role-switcher-label">Role</span>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
