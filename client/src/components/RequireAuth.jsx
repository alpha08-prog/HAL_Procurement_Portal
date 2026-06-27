import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { SCREENS, canAccessPath, firstScreenForRole } from '../config/roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRole } from '../context/RoleContext.jsx';
import Header from './Header.jsx';

// Layout route for everything behind login. Unauthenticated visitors are bounced to
// /login (remembering where they were headed). Authenticated visitors who hit a screen
// their role can't see are redirected to their own first screen.
export default function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const { role } = useRole();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isKnownScreen = SCREENS.some((s) => s.path === location.pathname);
  if (isKnownScreen && !canAccessPath(role, location.pathname)) {
    return <Navigate to={firstScreenForRole(role)} replace />;
  }

  return (
    <>
      <Header />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
