export function requireRoles(roles, message = 'This action is not available for your role') {
  const allowed = new Set(roles);
  return (req, res, next) => {
    if (allowed.has(req.user?.role)) return next();
    return res.status(403).json({ error: message });
  };
}
