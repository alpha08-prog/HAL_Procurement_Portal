import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { canAccessPath, roleLabel, screensForRole } from '../config/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRole } from '../context/RoleContext.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';
import ModuleIcon from './ModuleIcon.jsx';

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

const MODULES_CONFIG = [
  { id: 'hub', label: 'Portal Hub', path: '/portal', desc: 'Welcome Launchpad (6 Tabs)' },
  { id: 'provisioning', label: 'Provisioning', path: '/provisioning', desc: 'MPR/CAR, Estimations & Certs' },
  { id: 'noting', label: 'Procurement & Noting', path: '/noting/inbox', desc: 'Tendering & 26 Formats' },
  { id: 'contracts', label: 'Contract Management', path: '/contracts/register', desc: 'PO Release & 72 STC' },
  { id: 'payments', label: 'Payment Desk', path: '/rv-inbox', desc: 'RV Status, LD & CPPC' },
  { id: 'claims', label: 'Claim Management', path: '/claims', desc: 'Rejections & Discrepancies' },
  { id: 'kpis', label: 'KPI & MIS Reports', path: '/kpis', desc: '16 Statutory Metrics & SLAs' }
];

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

  // Determine current active module from path
  const path = location.pathname;
  let activeModuleId = 'hub';
  if (path.startsWith('/provisioning')) {
    activeModuleId = 'provisioning';
  } else if (path.startsWith('/noting') || path.startsWith('/ai-cases') || path === '/ai-documents' || path.startsWith('/ai-documents')) {
    activeModuleId = 'noting';
  } else if (
    path === '/rv-inbox' ||
    path === '/payment-advice' ||
    path === '/forward-advice' ||
    path === '/process-payment' ||
    path === '/hod-approval' ||
    path === '/payment-register' ||
    path === '/payment-kpis'
  ) {
    activeModuleId = 'payments';
  } else if (path.startsWith('/approvals')) {
    activeModuleId = 'noting';
  } else if (path.startsWith('/contracts')) {
    activeModuleId = 'contracts';
  } else if (path.startsWith('/claims')) {
    activeModuleId = 'claims';
  } else if (path.startsWith('/kpis')) {
    activeModuleId = 'kpis';
  }

  const currentMod = MODULES_CONFIG.find((m) => m.id === activeModuleId) || MODULES_CONFIG[0];

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

          {/* Module Selector Pill / Dropdown */}
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
                {MODULES_CONFIG.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mod-menu-item ${m.id === activeModuleId ? 'active' : ''}`}
                    onClick={() => {
                      setSwitcherOpen(false);
                      navigate(m.path);
                    }}
                  >
                    <span className="item-icon" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}>
                      <ModuleIcon id={m.id} size={18} color="var(--accent)" />
                    </span>
                    <div className="item-details">
                      <div className="item-title">{m.label}</div>
                      <div className="item-desc">{m.desc}</div>
                    </div>
                    {m.id === activeModuleId && <span className="item-check">✓</span>}
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

      {/* Scoped Nav Row — clean, professional labels without gimmicky emojis */}
      <nav className="app-nav">
        {activeModuleId !== 'hub' && (
          <span className="app-nav-item">
            <Link to="/portal" className="app-nav-link app-nav-hub-back">
              ← Portal Hub
            </Link>
          </span>
        )}

        {/* 1. Hub Navigation */}
        {activeModuleId === 'hub' && (
          <>
            <span className="app-nav-item">
              <NavLink to="/portal" className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                Portal Overview (6 Tabs)
              </NavLink>
            </span>
            <span className="app-nav-item">
              <Link to="/provisioning" className="app-nav-link">Provisioning</Link>
            </span>
            {canAccessPath(role, '/noting') && (
              <span className="app-nav-item">
                <Link to="/noting/inbox" className="app-nav-link">Procurement</Link>
              </span>
            )}
            {canAccessPath(role, '/contracts/register') && (
              <span className="app-nav-item">
                <Link to="/contracts/register" className="app-nav-link">Contract Mgmt</Link>
              </span>
            )}
            {canAccessPath(role, '/rv-inbox') && (
              <span className="app-nav-item">
                <Link to="/rv-inbox" className="app-nav-link">Payment Desk</Link>
              </span>
            )}
            <span className="app-nav-item">
              <Link to="/claims" className="app-nav-link">Claim Mgmt</Link>
            </span>
            <span className="app-nav-item">
              <Link to="/kpis" className="app-nav-link">KPI &amp; MIS</Link>
            </span>
          </>
        )}

        {/* 2. Provisioning Navigation */}
        {activeModuleId === 'provisioning' && (
          <>
            {[
              { path: '/provisioning', label: 'Provisioning Workspace' },
              { path: '/approvals/intake', label: 'Indentor Checklist' },
              { path: '/noting/initiate', label: '+ Initiate Provisioning Note' },
              { path: '/contracts/library', label: 'Standard Terms & Conditions' }
            ].map((item) => (
              <span className="app-nav-item" key={item.path + item.label}>
                <NavLink to={item.path} className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                  {item.label}
                </NavLink>
              </span>
            ))}
          </>
        )}

        {/* 3. E-File Noting & Procurement Navigation */}
        {activeModuleId === 'noting' && (
          <>
            {[
              { path: '/noting/inbox', label: 'Inbox' },
              { path: '/noting/sentbox', label: 'SentBox' },
              { path: '/noting/cabinet', label: 'Cabinet' },
              { path: '/noting/initiate', label: '+ Create E-File' },
              { path: '/noting/files', label: 'Drafts & Files' },
              { path: '/noting/upcoming', label: 'Upcoming' },
              { path: '/noting/reports', label: 'Reports' },
              { path: '/noting/org', label: 'Organisation' },
              { path: '/noting/ai-documents', label: 'AI Documents' }
            ].filter((item) => canAccessPath(role, item.path)).map((item) => (
              <span className="app-nav-item" key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                  {item.label}
                </NavLink>
              </span>
            ))}
          </>
        )}

        {/* 4. Payment Desk Navigation */}
        {activeModuleId === 'payments' && (
          <>
            {[
              { path: '/rv-inbox', label: 'RV Inbox' },
              { path: '/payment-advice', label: 'Payment Advice' },
              { path: '/forward-advice', label: 'Forward Advice' },
              { path: '/process-payment', label: 'Process Payment' },
              { path: '/hod-approval', label: 'HOD Approval' },
              { path: '/payment-register', label: 'Payment Register' },
              { path: '/payment-kpis', label: 'Payment KPIs' }
            ].filter((item) => canAccessPath(role, item.path)).map((item) => (
              <span className="app-nav-item" key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                  {item.label}
                </NavLink>
              </span>
            ))}
          </>
        )}

        {/* 5. Contracts Navigation */}
        {activeModuleId === 'contracts' && (
          <>
            {[
              { path: '/contracts/register', label: 'Contract Register' },
              { path: '/contracts/generate', label: 'Generate Contract' },
              { path: '/contracts/library', label: '72 STC Clause Library' }
            ].filter((item) => canAccessPath(role, item.path)).map((item) => (
              <span className="app-nav-item" key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                  {item.label}
                </NavLink>
              </span>
            ))}
          </>
        )}

        {/* 6. Claim Management Navigation */}
        {activeModuleId === 'claims' && (
          <>
            <span className="app-nav-item">
              <NavLink to="/claims" className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                Claim Status &amp; Register
              </NavLink>
            </span>
          </>
        )}

        {/* 7. KPI & MIS Reports Navigation */}
        {activeModuleId === 'kpis' && (
          <>
            <span className="app-nav-item">
              <NavLink to="/kpis" className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
                16 Statutory KPIs &amp; MIS
              </NavLink>
            </span>
          </>
        )}
      </nav>
    </header>
  );
}
