import { Router } from 'express';
import { signToken, verifyToken } from '../auth/jwt.js';
import { findByEmail, findById, publicUser, verifyPassword } from '../auth/users.js';

const router = Router();

// POST /api/auth/login  { email, password } -> { token, user }
router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = findByEmail(email);

  // Same response for unknown email and wrong password (don't leak which failed).
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me -> { user }  (restores the session on page reload)
router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const claims = verifyToken(token);
    const user = findById(claims.sub);
    if (!user) return res.status(401).json({ error: 'Unknown user' });
    res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
