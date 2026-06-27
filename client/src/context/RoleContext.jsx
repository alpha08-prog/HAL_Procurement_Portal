import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { canSwitchRoles } from '../config/roles.js';
import { useAuth } from './AuthContext.jsx';

const RoleContext = createContext(null);

// The role used for nav/gating now comes from the logged-in account. Admin
// accounts may temporarily override it (the top-bar dropdown) to preview other roles;
// everyone else is pinned to their account role. useRole()'s shape is unchanged, so
// the screens that consume { role, setRole } need no edits.
export function RoleProvider({ children }) {
  const { user } = useAuth();
  const accountRole = user?.role ?? null;
  const [override, setOverride] = useState(null);

  // Reset any preview override whenever the signed-in account changes.
  useEffect(() => {
    setOverride(null);
  }, [accountRole]);

  const canSwitch = canSwitchRoles(accountRole);
  const role = canSwitch && override ? override : accountRole;

  const setRole = (next) => {
    if (canSwitch) setOverride(next);
  };

  const value = useMemo(
    () => ({ role, setRole, accountRole, canSwitch }),
    [role, accountRole, canSwitch]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
