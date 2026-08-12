import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
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

// Dropdown menu that closes on outside click or Escape.
function NavDropdown({ label, isActive, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={`app-nav-dropdown${open ? ' open' : ''}${isActive ? ' active' : ''}`}
    >
      <button
        type="button"
        className="app-nav-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="app-nav-dropdown-arrow">▼</span>
      </button>
      <div className="app-nav-dropdown-menu" onClick={() => setOpen(false)}>
        {children}
      </div>
    </span>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { role, canSwitch } = useRole();
  const location = useLocation();
  const screens = screensForRole(role);

  // Group screens by their group property for rendering.
  const paymentScreens = screens.filter((s) => !s.group);
  const notingScreens = screens.filter((s) => s.group === 'Noting');
  const contractScreens = screens.filter((s) => s.group === 'Contracts');

  const isNotingActive = location.pathname.startsWith('/noting');
  const isContractsActive = location.pathname.startsWith('/contracts');

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
        {/* Payment module screens — flat links */}
        {paymentScreens.map((s) => (
          <span key={s.path} className="app-nav-item">
            <NavLink
              to={s.path}
              className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}
            >
              {s.navLabel}
            </NavLink>
          </span>
        ))}

        {/* Divider before Noting */}
        {notingScreens.length > 0 && <span className="app-nav-divider" aria-hidden="true" />}

        {/* eFiles dropdown (FLITE-style) */}
        {notingScreens.length > 0 && (
          <NavDropdown label="eFiles" isActive={isNotingActive}>
            <Link to="/noting/inbox">Inbox</Link>
            <Link to="/noting/sentbox">SentBox</Link>
            <Link to="/noting/cabinet">Cabinet</Link>
            <div className="menu-divider" />
            <Link to="/noting/initiate">Create</Link>
            <Link to="/noting/files">Drafts &amp; Files</Link>
          </NavDropdown>
        )}

        {/* Workspace dropdown */}
        {notingScreens.length > 0 && (
          <NavDropdown label="Workspace" isActive={false}>
            <Link to="/noting/upcoming">Upcoming Files</Link>
            <Link to="/noting">Dashboard</Link>
          </NavDropdown>
        )}

        {/* Other noting links */}
        {notingScreens.length > 0 && (
          <>
            <NavLink
              to="/noting/reports"
              className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}
            >
              Reports
            </NavLink>
            <NavLink
              to="/noting/org"
              className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}
            >
              Organisation
            </NavLink>
          </>
        )}

        {/* Contracts dropdown */}
        {contractScreens.length > 0 && (
          <>
            <span className="app-nav-divider" aria-hidden="true" />
            <NavDropdown label="Contracts" isActive={isContractsActive}>
              {contractScreens.map((s) => (
                <Link key={s.path} to={s.path}>{s.navLabel}</Link>
              ))}
            </NavDropdown>
          </>
        )}
      </nav>
    </header>
  );
}
