// First (and only) server-side role guard: the STC library may be amended only by an
// authorised admin after legal vetting. Safe to trust — authMiddleware sets req.user.role
// from the server-side user store, never from client claims. The RoleSwitcher preview is
// client-side only; a non-admin ACCOUNT previewing 'admin' still gets 403 here.
export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Standard clauses can be amended only by an authorised admin after legal vetting' });
}
