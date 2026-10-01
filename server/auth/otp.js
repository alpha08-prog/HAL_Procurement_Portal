// Demo one-time passwords: a 6-digit code per user (keyed by PB) over 30-second windows,
// derived from the JWT secret. It replaces the client-side "any six digits" check with a
// server-side verification, without enrolment: GET /api/auth/otp-demo issues the current
// code to the signed-in user (disable with OTP_DEMO_ENDPOINT=false). Real TOTP enrolment
// against an authenticator app is future scope; the verification path is the same.
import crypto from 'node:crypto';
import { SECRET } from './jwt.js';

export const STEP_SECONDS = 30;

export function code(pb, at = Date.now()) {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const h = crypto.createHmac('sha256', SECRET).update(`${pb}:${counter}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

// Accepts the current window and one either side (clock skew).
export function verify(pb, input) {
  if (!pb || !/^\d{6}$/.test(String(input ?? '').trim())) return false;
  const now = Date.now();
  const given = String(input).trim();
  return [-1, 0, 1].some((w) => code(pb, now + w * STEP_SECONDS * 1000) === given);
}

export const secondsLeft = (at = Date.now()) => STEP_SECONDS - Math.floor(at / 1000) % STEP_SECONDS;

export const demoEnabled = () => String(process.env.OTP_DEMO_ENDPOINT ?? 'true').toLowerCase() !== 'false';

export default { STEP_SECONDS, code, verify, secondsLeft, demoEnabled };
