import { createContext, useContext, useState } from 'react';
import { DEFAULT_ROLE } from '../config/roles.js';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState(DEFAULT_ROLE);
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
