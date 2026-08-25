// Resolves the acting noting member from the JWT-authenticated request WITHOUT
// touching the shared auth middleware. authMiddleware puts { id, name, role } on
// req.user; findById recovers the full auth user (incl. pb/email), which we match
// to a seeded noting member by pb (fallback email). Unlike the payment state
// machine, Module C stamps the actor from the real signed-in user, not a role.
import { findById } from '../auth/users.js';
import { get } from './db.js';

export function currentMember(req) {
  const authUser = req.user && findById(req.user.id);
  if (!authUser) return null;
  return (
    get('SELECT * FROM members WHERE pb = ? OR email = ?', authUser.pb, authUser.email) || null
  );
}
