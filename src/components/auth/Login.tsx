import { useState } from 'react';
import { API_BASE } from '../../api/client';

interface LoginProps {
  onLogin: (userData?: {
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    organizationLogo?: string | null;
    role: string;
  }) => void;
}

/**
 * Fixed particle field, generated ONCE at module load.
 *
 * These positions used to be computed with Math.random() inside the render
 * body. React re-renders on every keystroke, so each character typed into the
 * email field re-rolled all forty particles and the whole background jumped —
 * a distracting flicker precisely while the user is trying to type, and one
 * that got worse the more they typed.
 *
 * Hoisting it out of the component makes the field a constant: the elements
 * keep their identity across renders and only their CSS animation moves them.
 */
const PARTICLES = Array.from({ length: 34 }, (_, i) => {
  // Deterministic scatter rather than Math.random(): a fixed seed means the
  // layout is identical between the server-rendered and hydrated markup, and
  // it stays stable across a Fast Refresh while someone is styling it.
  const golden = 0.6180339887;
  const a = ((i + 1) * golden) % 1;
  const b = ((i + 1) * golden * 3.3) % 1;
  const c = ((i + 1) * golden * 7.7) % 1;

  return {
    left: +(a * 100).toFixed(2),
    top: +(b * 100).toFixed(2),
    size: c > 0.82 ? 3 : 2,
    delay: +(c * 9).toFixed(2),
    duration: +(11 + b * 12).toFixed(2),
  };
});

/**
 * The email kept by "Remember me", if any.
 *
 * The checkbox used to WRITE hpbrain-user and nothing ever read it back, so
 * ticking it had no observable effect on any subsequent sign-in. Reading it
 * here is what the box has always claimed to do.
 *
 * Deliberately only the email. A remembered password is a stored credential,
 * and "remember me" on a shared workstation must not become "sign in as me".
 */
function rememberedEmail(): string {
  try {
    const raw = localStorage.getItem('hpbrain-user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.email === 'string' ? parsed.email : '';
  } catch {
    return '';
  }
}

export default function Login({ onLogin }: LoginProps) {
  const initialEmail = rememberedEmail();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(initialEmail !== '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || `Login failed (HTTP ${res.status})`);
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      const userData = data.user || {};
      const org = data.organization || {};
      const fullName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email || email;

      if (remember) {
        localStorage.setItem('hpbrain-user', JSON.stringify({
          email: userData.email || email,
          name: fullName,
        }));
      } else {
        // Unticking it has to forget a previously remembered address, or the
        // box becomes one-way and the user cannot undo it.
        localStorage.removeItem('hpbrain-user');
      }

      onLogin({
        email: userData.email || email,
        name: fullName,
        organizationId: String(org.id || ''),
        organizationName: String(org.name || ''),
        organizationLogo: org.logo ?? null,
        role: String(userData.role || ''),
      });
    } catch (e: any) {
      setError(e.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setError(null);
    setNotice('Google Sign-In is not configured yet.');
  };

  const handleMicrosoftLogin = () => {
    setError(null);
    setNotice('Microsoft Sign-In is not configured yet.');
  };

  return (
    /*
      PINNED TO THE LIGHT INSTRUMENT, DELIBERATELY.

      The layout's whole idea is a light form panel against a dark brand panel;
      that contrast is what makes the split read. The form card is therefore a
      light surface by design, not by theme.

      Without this pin it breaks on any machine set to dark mode: the card's
      background is an explicit white, but everything inside it — headings,
      input backgrounds, labels — resolves from theme tokens, so the text turned
      near-white ON white and the inputs turned navy inside a white card. The
      screen was unreadable while looking, at a glance, like it had rendered.

      Scoped to this element, so the rest of the app still follows the user's
      preference. The dark half opposite uses explicit navy values and is
      unaffected either way.
    */
    <div className="eb-login-page" data-theme="light">
      {/*
        Ambient motion sits BEHIND the card, at page level, so the card reads as
        floating on a living field rather than as a panel with a busy corner.
        aria-hidden throughout: none of it carries information, and a screen
        reader announcing forty decorative spans before the email field would be
        actively hostile. It is also the first thing disabled under
        prefers-reduced-motion.
      */}
      <div className="eb-login-bg" aria-hidden="true">
        <span className="eb-login-orb eb-login-orb-1" />
        <span className="eb-login-orb eb-login-orb-2" />
        <span className="eb-login-orb eb-login-orb-3" />
        <div className="eb-login-particles">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="eb-login-particle"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="eb-login-shell">
      <div className="eb-login-visual" aria-hidden="true">
        <div className="eb-login-brand">
          <div className="eb-login-logo">HP</div>
          <div>
            <h1>Enterprise Brain</h1>
            <p>Powering Human Productivity with AI</p>
          </div>
        </div>

        <div className="eb-login-hero" aria-hidden="true">
          <div className="eb-login-brain">
            <div className="eb-login-brain-ring" />
            <div className="eb-login-brain-ring" />
            <div className="eb-login-brain-ring" />
            <div className="eb-login-brain-core">◈</div>
          </div>
          {/* Fills the dead space between the brandmark and the metrics strip.
              The panel is aria-hidden, so this is decoration and carries no
              information a screen-reader user would miss. */}
          <p className="eb-login-tagline">
            Signals in. Evidence weighed.<br />Decisions out.
          </p>
        </div>

        <div className="eb-login-metrics" aria-hidden="true">
          <div>
            <span>Decision Clarity</span>
            <strong>94%</strong>
          </div>
          <div>
            <span>Signal Velocity</span>
            <strong>2.8×</strong>
          </div>
          <div>
            <span>Execution Loop</span>
            <strong>Live</strong>
          </div>
        </div>
      </div>

      <section className="eb-login-card" aria-label="Sign in">
        <div className="eb-login-card-head">
          <span className="eb-login-kicker">Command access</span>
          <h2>Welcome back</h2>
          <p>Sign in to your organizational intelligence workspace.</p>
        </div>

        {error && <div className="eb-login-error" role="alert">{error}</div>}
        {notice && <div className="eb-login-notice" role="status">{notice}</div>}

        <form onSubmit={handleSubmit}>
          <div className="eb-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="eb-field">
            <label htmlFor="password">Password</label>
            <div className="eb-password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="eb-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="eb-login-options">
            <label className="eb-login-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="eb-login-link"
              onClick={() => {
                setError(null);
                setNotice('Password reset is handled by your organization administrator.');
              }}
            >
              Forgot password?
            </button>
          </div>

          <button className="eb-login-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="eb-login-divider"><span>or</span></div>

          <button
            className="eb-login-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <span className="eb-google-mark" aria-hidden="true">G</span>
            Sign in with Google
          </button>

          <button
            className="eb-login-microsoft"
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            <span className="eb-google-mark" aria-hidden="true">M</span>
            Sign in with Microsoft
          </button>
        </form>

        <p className="eb-login-footnote">
          Access is provisioned by your organization administrator.
        </p>
      </section>
      </div>
    </div>
  );
}
