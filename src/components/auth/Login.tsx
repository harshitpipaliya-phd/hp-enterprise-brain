import { useState } from 'react';
import { API_BASE } from '../../api/client';
import { AuthBackdrop, BrandMark, AlertIcon, IntelligenceFlow } from './authChrome';
import { persistTokens, sessionFromResponse } from './session';
import type { AuthSession } from './session';

interface LoginProps {
  onLogin: (session: AuthSession) => void;
  onSwitchToSignup: () => void;
  /** Prefilled after signup, so the address is typed once. */
  initialEmail?: string;
}

/**
 * Sign in.
 *
 * SAME PRODUCT, DIFFERENT COMPOSITION. It shares every token, control and
 * behaviour with Signup — the same field system, button, password toggle,
 * alert, brand rail and ambient field — but the split is reversed and the rail
 * is quieter. Signup argues for the product to someone who has not bought it;
 * this screen belongs to someone who already has, so the shortest path to the
 * password box is the design.
 *
 * ONLY WHAT IS REQUIRED. Email, password, show/hide, sign in. There is no
 * "forgot password" link, because there is no forgot-password implementation
 * behind it — the previous version showed one that only printed "ask your
 * administrator", which is a control that looks like a feature and is not one.
 * When a real reset flow exists, this is where it goes.
 */
export default function Login({ onLogin, onSwitchToSignup, initialEmail = '' }: LoginProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let session: AuthSession | null = null;

    try {
      const normalizedEmail = email.trim();
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || `Login failed (HTTP ${res.status})`);
      }

      session = sessionFromResponse(data, normalizedEmail);
      if (!session.accessToken || !session.refreshToken || !session.organizationId) {
        throw new Error('Login response was missing session details.');
      }

      persistTokens(session);
    } catch (err: any) {
      setError(err?.message || 'Incorrect email or password.');
      setLoading(false);
      return;
    }

    try {
      onLogin(session);
    } catch (err: any) {
      setError(err?.message || 'Signed in, but the workspace could not open.');
      setLoading(false);
      return;
    }

    setLoading(false);
    if (email !== email.trim()) {
      setEmail(email.trim());
    }
  };

  return (
    <div className="eb-auth" data-theme="light">
      <AuthBackdrop />

      <div className="eb-auth-shell eb-auth-split eb-auth-reversed">
        <main className="eb-auth-panel">
          <BrandMark tone="light" />

          <div className="eb-auth-head">
            <h2>Welcome back</h2>
            <p>Sign in to your organizational intelligence workspace.</p>
          </div>

          {error && (
            <div className="eb-auth-alert eb-auth-alert-error" role="alert">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="eb-auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@northwind.com"
                disabled={loading}
                autoFocus={initialEmail === ''}
                required
              />
            </div>

            <div className="eb-auth-field">
              <label htmlFor="password">Password</label>
              <div className="eb-auth-pw">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus={initialEmail !== ''}
                  required
                />
                <button
                  type="button"
                  className="eb-auth-pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button className="eb-auth-submit" type="submit" disabled={loading}>
              {loading && <span className="eb-auth-spin" aria-hidden="true" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="eb-auth-foot">
            New to Enterprise Brain?
            <button type="button" className="eb-auth-link" onClick={onSwitchToSignup}>
              Create your organization
            </button>
          </p>
        </main>

        {/* The rail sits second in the DOM so a screen reader and a keyboard
            reach the form first — it is decoration-with-content, not the task. */}
        <aside className="eb-auth-rail">
          <BrandMark />

          <div className="eb-auth-pitch">
            <h2>
              Your organization, as <em>intelligence</em>.
            </h2>
            <IntelligenceFlow />
          </div>

          <p className="eb-auth-rail-foot">
            Signals, evidence and decisions from your own operational data.
          </p>
        </aside>
      </div>
    </div>
  );
}
