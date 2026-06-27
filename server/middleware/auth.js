// Gate for the data routes: requires a valid, unexpired Bearer JWT. The token's role
// stamping in the state machine is unchanged — this only proves the caller is signed in.
import { verifyToken } from '../auth/jwt.js';
import { findById } from '../auth/users.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const claims = verifyToken(token);
    const user = findById(claims.sub);
    if (!user) return res.status(401).json({ error: 'Unknown user' });
    req.user = { id: user.id, name: user.name, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
