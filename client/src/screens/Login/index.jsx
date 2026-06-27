import { Fragment, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { firstScreenForRole } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';

// The procurement case lifecycle shown as a workflow in the hero. Last step is "current".
const PROCUREMENT_FLOW = [
  'Provisioning',
  'Tendering',
  'Evaluation',
  'PO / Contract',
  'Receipt',
  'Payment'
];

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the form.
  if (isAuthenticated) {
    return <Navigate to={firstScreenForRole(user.role)} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password, remember);
      const fallback = firstScreenForRole(user.role);
      const dest = location.state?.from?.pathname ?? fallback;
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      {/* IIIT Dharwad — round badge pinned to the top-right-most corner of the page */}
      <div className="login-badge-iiit" title="Developed by IIIT Dharwad">
        <img src="/iiit-dharwad.png" alt="IIIT Dharwad" />
      </div>

      {/* Left — brand hero */}
      <section className="login-hero">
        <header className="login-hero-bar">
          <div className="login-logo-hal">
            <img src="/hal-logo.jpeg" alt="Hindustan Aeronautics Limited" />
          </div>
        </header>

        <div className="login-hero-body">
          <span className="login-hero-eyebrow">Hindustan Aeronautics Limited &middot; Nashik</span>
          <h1 className="login-hero-title">Procurement Portal</h1>
          <p className="login-hero-subtitle">Integrated Materials Management</p>
          <p className="login-hero-tagline">
            One auditable workflow — from provisioning to payment.
          </p>
          <div className="login-flow">
            {PROCUREMENT_FLOW.map((step, i) => (
              <Fragment key={step}>
                <span
                  className={
                    'login-flow-step' + (i === PROCUREMENT_FLOW.length - 1 ? ' is-active' : '')
                  }
                >
                  {step}
                </span>
                {i < PROCUREMENT_FLOW.length - 1 && (
                  <span className="login-flow-arrow" aria-hidden="true">›</span>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <footer className="login-hero-foot">Developed by IIIT Dharwad</footer>
      </section>

      {/* Right — login card */}
      <section className="login-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <p className="login-welcome">
            Welcome to the official HAL Nashik Public Procurement Portal
          </p>
          <h2 className="login-card-title">
            <span className="login-card-tick" /> Portal Login
          </h2>
          <p className="login-card-sub">Sign in with your departmental credentials</p>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <label className="login-field">
            <span className="login-field-label">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="login-field">
            <span className="login-field-label">Password</span>
            <div className="login-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-show"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <label className="login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me</span>
          </label>

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="login-footer">
          © 2026 Hindustan Aeronautics Limited, Nashik
        </p>
      </section>
    </div>
  );
}
