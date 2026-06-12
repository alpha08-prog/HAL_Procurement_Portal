import { NavLink } from 'react-router-dom';
import { screensForRole } from '../config/roles.js';
import { useRole } from '../context/RoleContext.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';

export default function Header() {
  const { role } = useRole();
  const screens = screensForRole(role);

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div className="app-brand">
          <span className="app-brand-name">HAL Nashik</span>
          <span className="app-brand-sub">Procurement Portal — Payment Module</span>
        </div>
        <RoleSwitcher />
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
