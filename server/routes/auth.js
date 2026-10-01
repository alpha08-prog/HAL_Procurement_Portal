import { Router } from 'express';
import { signToken, verifyToken } from '../auth/jwt.js';
import { code as otpCode, demoEnabled, secondsLeft } from '../auth/otp.js';
import { findByEmail, findById, publicUser, verifyPassword } from '../auth/users.js';
import { authMiddleware } from '../middleware/auth.js';

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

// GET /api/auth/otp-demo -> { code, expiresIn }  the signed-in user's current one-time
// password. Demo issuance in place of an authenticator app; hidden when OTP_DEMO_ENDPOINT=false.
router.get('/otp-demo', authMiddleware, (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo OTP issuance is disabled on this server' });
  const user = findById(req.user.id);
  if (!user?.pb) return res.status(422).json({ error: 'No PB on this account' });
  res.json({ code: otpCode(user.pb), expiresIn: secondsLeft(), pb: user.pb, demo: true });
});

export default router;
