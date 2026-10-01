// Demo one-time password issuance (server/auth/otp.js). The server verifies the code; this
// only fetches the current one for the signed-in user so a demo can be walked without an
// authenticator app. Hidden when the server sets OTP_DEMO_ENDPOINT=false.
import { apiFetch } from './api.js';

export async function fetchDemoOtp() {
  const res = await apiFetch('/api/auth/otp-demo');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return data;
}
