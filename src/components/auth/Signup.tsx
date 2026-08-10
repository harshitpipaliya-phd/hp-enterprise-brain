import { useState } from 'react';
import { API_BASE } from '../../api/client';
import { AuthBackdrop, BrandMark, CheckIcon, AlertIcon, IntelligenceFlow } from './authChrome';

interface SignupProps {
  /** Called with the new administrator's email, to prefill the login form. */
  onCreated: (email: string) => void;
  onSwitchToLogin: () => void;
}

/**
 * Create an organization.
 *
 * IT ASKS FOR AN ORGANIZATION, NOT FOR A PERSON. Four inputs — name, email, an
 * optional mobile, and a password. There is no administrator section, because
 * there is nothing in it the product needs: the tenant administrator is still
 * created, in full, by the backend, from the organization itself. The schema is
 * what permits that (first_name, last_name, mobile and user_name are nullable),
 * not a shortcut.
 *
 * THE ORGANIZATION EMAIL IS THE LOGIN. One address, entered once, which is both
 * the organization's contact address and the credential the administrator signs
 * in with. Nothing else would be honest about what the single email field does.
 *
 * NO COMPOSITION RULES ON THE PASSWORD. No mixed case, no digit, no symbol, no
 * strength meter — those push people towards 'Password1!' and are not what
 * makes the stored credential safe. The server enforces a length floor and the
 * confirmation, and hashes with bcrypt. That is the whole rule, and the form
 * says exactly that rather than performing security theatre.
 *
 * SUCCESS ENDS AT SIGN IN, NOT IN THE WORKSPACE. The API does return a usable
 * session, but the user has just chosen a password and has not yet used it; one
 * deliberate sign-in confirms it works while the memory is fresh, and it is the
 * flow the product describes. The email is carried across so they type it once.
 */

const EMPTY = {
  organizationName: '',
  organizationEmail: '',
  organizationMobile: '',
  password: '',
  password_confirmation: '',
};

type Fields = typeof EMPTY;

export default function Signup({ onCreated, onSwitchToLogin }: SignupProps) {
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const set = (name: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [name]: value }));
    // Clear the server's verdict on a field as soon as it is edited. Leaving it
    // up while the user fixes it makes a corrected field look still-broken.
    setErrors((prev) => (prev[name]?.length ? { ...prev, [name]: [] } : prev));
  };

  const mismatch =
    values.password_confirmation !== '' && values.password_confirmation !== values.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Caught here so the user is not made to wait on a round trip for something
    // the form can already see. The server checks it too.
    if (mismatch) return;

    setLoading(true);
    setBanner(null);
    setErrors({});

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        setErrors(data.errors || {});
        // Only banner what could not be attached to a field, so the user is not
        // told the same thing twice.
        if (!data.errors || Object.keys(data.errors).length === 0) {
          setBanner(data.message || 'Please check the form and try again.');
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || `Signup failed (HTTP ${res.status})`);
      }

      setCreatedName(String(data.organization?.name || values.organizationName));
    } catch (err: any) {
      setBanner(err?.message || 'We could not create your organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (name: string): string | null => errors[name]?.[0] ?? null;

  const field = (
    name: keyof Fields,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { optional?: boolean } = {},
  ) => {
    const { optional, ...input } = props;
    const err = fieldError(name);

    return (
      <div className="eb-auth-field">
        <label htmlFor={name}>
          {label}
          {optional && <span className="eb-auth-opt">optional</span>}
        </label>
        <input
          id={name}
          name={name}
          value={values[name]}
          onChange={set(name)}
          disabled={loading}
          aria-invalid={err ? 'true' : undefined}
          aria-describedby={err ? `${name}-err` : undefined}
          {...input}
        />
        {err && (
          <p className="eb-auth-msg" id={`${name}-err`} role="alert">
            <AlertIcon />
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="eb-auth" data-theme="light">
      <AuthBackdrop />

      <div className="eb-auth-shell eb-auth-split">
        {/* ---- Brand rail ---- */}
        <aside className="eb-auth-rail">
          <BrandMark />

          <div className="eb-auth-pitch">
            <h2>
              Turn your organization into <em>intelligence</em>.
            </h2>
            <IntelligenceFlow />
          </div>

          <p className="eb-auth-rail-foot">
            Your organization&apos;s data stays isolated to your tenant.
          </p>
        </aside>

        {/* ---- Form ---- */}
        <main className="eb-auth-panel">
          {createdName ? (
            <div className="eb-auth-done">
              <div className="eb-auth-done-mark" aria-hidden="true">
                <CheckIcon size={28} />
              </div>
              <h2>Organization created successfully</h2>
              <p>
                <strong>{createdName}</strong> is ready. Sign in with your organization
                email and password to start adding your data.
              </p>

              <button
                className="eb-auth-submit"
                type="button"
                onClick={() => onCreated(values.organizationEmail)}
                autoFocus
              >
                Continue to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="eb-auth-head">
                <h2>Create your organization</h2>
                <p>
                  Set up your organization and start turning your operational data into
                  intelligence.
                </p>
              </div>

              {banner && (
                <div className="eb-auth-alert eb-auth-alert-error" role="alert">
                  <AlertIcon />
                  <span>{banner}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <section className="eb-auth-section">
                  <h3 className="eb-auth-legend">Organization</h3>

                  {field('organizationName', 'Organization name', {
                    type: 'text',
                    placeholder: 'Northwind Logistics',
                    autoComplete: 'organization',
                    autoFocus: true,
                    required: true,
                  })}

                  {field('organizationEmail', 'Organization email', {
                    type: 'email',
                    placeholder: 'ops@northwind.com',
                    autoComplete: 'email',
                    required: true,
                  })}
                  <p className="eb-auth-hint">
                    You will sign in with this address.
                  </p>

                  {field('organizationMobile', 'Organization mobile', {
                    type: 'tel',
                    placeholder: '9876543210',
                    inputMode: 'numeric',
                    maxLength: 10,
                    autoComplete: 'tel',
                    optional: true,
                  })}
                </section>

                <section className="eb-auth-section">
                  <h3 className="eb-auth-legend">Security</h3>

                  <div className="eb-auth-field">
                    <label htmlFor="password">Password</label>
                    <div className="eb-auth-pw">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={values.password}
                        onChange={set('password')}
                        disabled={loading}
                        autoComplete="new-password"
                        aria-invalid={fieldError('password') ? 'true' : undefined}
                        aria-describedby={fieldError('password') ? 'password-err' : undefined}
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
                    {fieldError('password') && (
                      <p className="eb-auth-msg" id="password-err" role="alert">
                        <AlertIcon />
                        {fieldError('password')}
                      </p>
                    )}
                  </div>

                  <div className="eb-auth-field">
                    <label htmlFor="password_confirmation">Confirm password</label>
                    <div className="eb-auth-pw">
                      <input
                        id="password_confirmation"
                        name="password_confirmation"
                        type={showPassword ? 'text' : 'password'}
                        value={values.password_confirmation}
                        onChange={set('password_confirmation')}
                        disabled={loading}
                        autoComplete="new-password"
                        aria-invalid={mismatch ? 'true' : undefined}
                        aria-describedby={mismatch ? 'confirm-err' : undefined}
                        required
                      />
                    </div>
                    {mismatch && (
                      <p className="eb-auth-msg" id="confirm-err" role="alert">
                        <AlertIcon />
                        The two passwords do not match.
                      </p>
                    )}
                  </div>
                </section>

                <button className="eb-auth-submit" type="submit" disabled={loading}>
                  {loading && <span className="eb-auth-spin" aria-hidden="true" />}
                  {loading ? 'Creating organization…' : 'Create organization'}
                </button>

                <p className="eb-auth-consent">
                  Your password is hashed before it is stored. We never keep or email a
                  plaintext password.
                </p>
              </form>

              <p className="eb-auth-foot">
                Already have an account?
                <button type="button" className="eb-auth-link" onClick={onSwitchToLogin}>
                  Sign in
                </button>
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
