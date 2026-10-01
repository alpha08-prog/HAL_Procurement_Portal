import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { groupById, groupForPath, groupsForRole, roleLabel, screensForRole } from '../config/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRole } from '../context/RoleContext.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';
import ModuleIcon from './ModuleIcon.jsx';

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

// The module switcher and the nav row are both read off config/roles.js: GROUPS gives the
// modules, SCREENS[].group says which nav row a screen sits in, and visibleTo trims both
// per role. Adding a screen to SCREENS is all it takes to make it reachable.
export default function Header() {
  const { user, logout } = useAuth();
  const { role, canSwitch } = useRole();
  const location = useLocation();
  const navigate = useNavigate();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const close = (e) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) setSwitcherOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setSwitcherOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [switcherOpen]);

  const activeGroupId = groupForPath(location.pathname);
  const currentMod = groupById(activeGroupId);
  const modules = groupsForRole(role);
  const navScreens = screensForRole(role).filter((s) => s.group === activeGroupId);
  const navClass = ({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '');

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="app-brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/portal" className="app-brand-logo" style={{ textDecoration: 'none' }}>
            <img src="/hal-logo.jpeg" alt="HAL" />
          </Link>
          <div className="app-brand-text">
            <Link to="/portal" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="app-brand-name">HAL Nashik</span>
            </Link>
            <span className="app-brand-sub">Public Procurement &amp; Management Portal</span>
          </div>

          {/* Module switcher */}
          <div ref={switcherRef} className="app-module-switcher" style={{ position: 'relative', marginLeft: 8 }}>
            <button
              type="button"
              className="app-module-btn"
              onClick={() => setSwitcherOpen((v) => !v)}
              title="Click to switch workspace modules"
            >
              <span className="mod-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <ModuleIcon id={currentMod.id} size={15} color="#fff" />
              </span>
              <span className="mod-name">{currentMod.label}</span>
              <span className="mod-arrow">{switcherOpen ? '▲' : '▼'}</span>
            </button>

            {switcherOpen && (
              <div className="app-module-menu">
                <div className="mod-menu-header">SWITCH WORKSPACE MODULE</div>
                {modules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mod-menu-item ${m.id === activeGroupId ? 'active' : ''}`}
                    onClick={() => {
                      setSwitcherOpen(false);
                      navigate(m.home);
                    }}
                  >
                    <span className="item-icon" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}>
                      <ModuleIcon id={m.id} size={18} color="var(--accent)" />
                    </span>
                    <div className="item-details">
                      <div className="item-title">{m.label}</div>
                      <div className="item-desc">{m.desc}</div>
                    </div>
                    {m.id === activeGroupId && <span className="item-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {/* Nav row: the current group's screens; on the hub, one link per module. */}
      <nav className="app-nav">
        {activeGroupId !== 'hub' && (
          <span className="app-nav-item">
            <Link to="/portal" className="app-nav-link app-nav-hub-back">
              ← Portal Hub
            </Link>
          </span>
        )}

        {navScreens.map((s) => (
          <span className="app-nav-item" key={s.path}>
            <NavLink to={s.path} end className={navClass}>
              {s.navLabel}
            </NavLink>
          </span>
        ))}

        {activeGroupId === 'hub' && modules.filter((m) => m.id !== 'hub').map((m) => (
          <span className="app-nav-item" key={m.id}>
            <Link to={m.home} className="app-nav-link">{m.label}</Link>
          </span>
        ))}
      </nav>
    </header>
  );
}
