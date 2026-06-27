import { NavLink } from 'react-router-dom';
import { roleLabel, screensForRole } from '../config/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRole } from '../context/RoleContext.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';

// Two-letter monogram for the avatar: initials of the first two names, else first two letters.
function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

export default function Header() {
  const { user, logout } = useAuth();
  const { role, canSwitch } = useRole();
  const screens = screensForRole(role);

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="app-brand">
          <span className="app-brand-logo">
            <img src="/hal-logo.jpeg" alt="HAL" />
          </span>
          <span className="app-brand-text">
            <span className="app-brand-name">HAL Nashik</span>
            <span className="app-brand-sub">Procurement Portal — Payment Module</span>
          </span>
        </div>

        <div className="app-user">
          {canSwitch && <RoleSwitcher />}
          <span className="app-user-divider" />
          <div className="app-user-id">
            <span className="app-user-avatar" aria-hidden="true">
              {initialsOf(user?.name)}
            </span>
            <span className="app-user-meta">
              <span className="app-user-name">{user?.name}</span>
              <span className="app-user-role">{roleLabel(role)}</span>
            </span>
          </div>
          <button type="button" className="app-logout" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <nav className="app-nav">
        {screens.map((s) => (
          <NavLink
            key={s.path}
            to={s.path}
            className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}
          >
            {s.navLabel}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
