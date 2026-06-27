// Single source of truth for the auth token + a fetch wrapper that attaches it.
// "Remember me" stores the session in localStorage (survives browser restart);
// otherwise sessionStorage (cleared when the tab closes).
const TOKEN_KEY = 'hal_token';
const USER_KEY = 'hal_user';

const stores = () => [window.localStorage, window.sessionStorage];

export function getToken() {
  for (const s of stores()) {
    const t = s.getItem(TOKEN_KEY);
    if (t) return t;
  }
  return null;
}

export function getStoredUser() {
  for (const s of stores()) {
    const raw = s.getItem(USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setSession(token, user, remember) {
  clearSession();
  const store = remember ? window.localStorage : window.sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  for (const s of stores()) {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  }
}

// Fetch wrapper: injects the Bearer token and, on a 401, clears the session and
// broadcasts so the AuthProvider can drop the user (RequireAuth then redirects to /login).
export async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...opts, headers });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  return res;
}
