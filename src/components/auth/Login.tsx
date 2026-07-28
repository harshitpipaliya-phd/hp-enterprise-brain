import { useState } from 'react';
import { request } from '../../api/client';
import { getTenantId } from '../../utils/tenant';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'dev' | 'form' | 'signup'>('form');
  const [tenantId, setTenantId] = useState(getTenantId());
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await request('/auth/dev-token', { method: 'POST' });
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenantId, email, password }),
      });
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ tenantId, email, password, name }),
      });
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      onLogin();
    } catch (e: any) {
      setError(e.message === 'email_already_exists' ? 'An account with this email already exists.' : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eb-login-shell">
      <div className="eb-login-card eb-fade-in">
        <div className="eb-login-logo">HP</div>
        <h1 style={{ fontSize: 21, marginBottom: 2 }}>Enterprise Brain</h1>
        <p style={{ color: 'var(--content-secondary)', fontSize: 13, marginBottom: 22 }}>
          Sign in to your Organizational Intelligence &amp; Execution System.
        </p>

        <div className="eb-login-tabs">
          {import.meta.env.DEV && (
            <button onClick={() => setMode('dev')} disabled={mode === 'dev'}>Dev Token</button>
          )}
          <button onClick={() => setMode('form')} disabled={mode === 'form'}>Credentials</button>
          <button onClick={() => setMode('signup')} disabled={mode === 'signup'}>Sign Up</button>
        </div>

        {error && <div className="eb-login-error">{error}</div>}

        {import.meta.env.DEV && mode === 'dev' ? (
          <div>
            <p style={{ marginBottom: 16, color: 'var(--content-secondary)', fontSize: 13 }}>
               Use the dev token for local development. This generates an admin JWT for tenant <strong>demo-tenant</strong>.
            </p>
            <button className="eb-login-submit" onClick={handleDevLogin} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in with Dev Token'}
            </button>
          </div>
        ) : mode === 'signup' ? (
          <form onSubmit={handleSignup}>
            <div className="eb-field">
              <label>Tenant ID</label>
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </div>
            <div className="eb-field">
              <label>Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="eb-field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="eb-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginTop: 4 }}>At least 8 characters.</div>
            </div>
            <button className="eb-login-submit" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFormLogin}>
            <div className="eb-field">
              <label>Tenant ID</label>
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </div>
            <div className="eb-field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="eb-field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="eb-login-submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
