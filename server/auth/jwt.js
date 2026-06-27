// JWT signing/verification helpers. Prototype: the secret comes from JWT_SECRET when
// set, otherwise a fixed dev constant. Tokens carry { sub, name, role } and expire in 8h.
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'hal-nashik-prototype-dev-secret-change-me';
const EXPIRES_IN = '8h';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: EXPIRES_IN });

export const verifyToken = (token) => jwt.verify(token, SECRET);
