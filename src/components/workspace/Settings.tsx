import { useState, useEffect, useCallback } from 'react';
import { settingsApi, authApi } from '../../api/notification';
import { getThemeOverride, setThemeOverride } from '../../hooks/useTheme';
import {
  PageHeader, Card, CardHeader, CardBody, CardFooter,
  Button, Switch, Field, TextInput, Select, StatusBadge, Alert,
} from '../../ui';

/**
 * Settings screen.
 *
 * Redesigned as a card-based enterprise settings page. Functionality is unchanged
 * from the previous build:
 *   - Manual theme override (Light / Dark / Follow System) via setThemeOverride.
 *   - Org-wide notification preferences persisted through the real settings store.
 *   - Password change through authApi.changePassword (validation untouched).
 *
 * Two additions are strictly frontend-only, local preferences (no backend calls,
 * no invented APIs): default landing page and sidebar behavior. The Organization
 * card shows read-only context from the already-authenticated tenant — it never
 * reaches into another organization's data.
 */
export default function Settings({
  tenantId,
  organizationName,
  orgStatus,
}: {
  tenantId: string;
  organizationName?: string;
  orgStatus?: string;
}) {
  const [override, setOverride] = useState<'light' | 'dark' | null>(getThemeOverride());
  const [notifyOnRecommendation, setNotifyOnRecommendation] = useState(true);
  const [notifyOnDecision, setNotifyOnDecision] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Frontend-only preferences — persisted to localStorage, not the backend.
  const [landingPage, setLandingPage] = useState<string>(
    () => readLocalPref('hpbrain-landing-view', 'home'),
  );
  const [sidebarBehavior, setSidebarBehavior] = useState<string>(
    () => readLocalPref('hpbrain-sidebar-behavior', 'remember'),
  );

  // Rows come back as the raw settings table: setting_key / setting_value, with
  // camelCase aliases added by the client. Swallowing the failure here is what
  // made a broken settings table look like "no preferences saved yet".
  useEffect(() => {
    setLoading(true);
    setPrefsError(null);
    settingsApi
      .list(tenantId, 'personal')
      .then((settings: any) => {
        const rows: any[] = Array.isArray(settings) ? settings : [];
        const row = rows.find((s) => (s.settingKey ?? s.key) === 'notification_preferences');
        const raw = row?.settingValue ?? row?.value;
        const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (prefs) {
          setNotifyOnRecommendation(prefs.recommendation ?? true);
          setNotifyOnDecision(prefs.decision ?? true);
        }
      })
      .catch((e: any) => setPrefsError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  // Persist local preferences whenever they change.
  useEffect(() => { writeLocalPref('hpbrain-landing-view', landingPage); }, [landingPage]);
  useEffect(() => { writeLocalPref('hpbrain-sidebar-behavior', sidebarBehavior); }, [sidebarBehavior]);

  const changeTheme = useCallback((value: 'light' | 'dark' | null) => {
    setThemeOverride(value);
    setOverride(value);
  }, []);

  const saveNotificationPrefs = useCallback(async () => {
    setPrefsError(null);
    try {
      await settingsApi.set(
        tenantId, 'notification_preferences',
        { recommendation: notifyOnRecommendation, decision: notifyOnDecision },
        'personal',
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setPrefsError(e.message);
    }
  }, [tenantId, notifyOnRecommendation, notifyOnDecision]);

  const changePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message === 'invalid_current_password' ? 'Current password is incorrect.' : err.message);
    }
  }, [currentPassword, newPassword]);

  const themeOptions: { value: 'light' | 'dark' | null; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: null, label: 'Follow System' },
  ];

  return (
    <div className="u-stack" style={{ gap: 'var(--eb-space-5)' }}>
      <PageHeader
        title="Settings"
        description="Manage your appearance, notifications, security, and workspace preferences."
      />

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" />
        <CardBody>
          <p className="u-page-desc" style={{ marginBottom: 'var(--eb-space-4)' }}>
            Choose how the Enterprise Brain interface looks.
          </p>
          <div className="u-row u-gap-2" role="radiogroup" aria-label="Theme">
            {themeOptions.map((opt) => {
              const selected = override === opt.value;
              return (
                <Button
                  key={opt.value ?? 'auto'}
                  variant={selected ? 'primary' : 'secondary'}
                  aria-pressed={selected}
                  onClick={() => changeTheme(opt.value)}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader
          title="Notifications"
          action={saved ? <StatusBadge tone="success">Saved</StatusBadge> : null}
        />
        <CardBody>
          <div className="u-stack" style={{ gap: 'var(--eb-space-4)' }}>
            {loading && <p className="u-muted">Loading preferences…</p>}
            {prefsError && (
              <Alert tone="danger" title="Could not load preferences">{prefsError}</Alert>
            )}
            <Switch
              label="Notify me when a new Recommendation is generated"
              checked={notifyOnRecommendation}
              onCheckedChange={setNotifyOnRecommendation}
            />
            <Switch
              label="Notify me when a Decision is made"
              checked={notifyOnDecision}
              onCheckedChange={setNotifyOnDecision}
            />
          </div>
        </CardBody>
        <CardFooter>
          <Button variant="primary" onClick={saveNotificationPrefs}>
            {saved ? 'Saved' : 'Save Preferences'}
          </Button>
        </CardFooter>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader title="Security" />
        <CardBody>
          <div className="u-stack" style={{ gap: 'var(--eb-space-4)' }}>
            {passwordError && (
              <Alert tone="danger" title="Password change failed">{passwordError}</Alert>
            )}
            {passwordSuccess && (
              <Alert tone="success" title="Password updated">
                Your password has been changed successfully.
              </Alert>
            )}
            <form
              onSubmit={changePassword}
              className="u-stack"
              style={{ gap: 'var(--eb-space-4)', maxWidth: 420 }}
            >
              <Field label="Current Password" required>
                <TextInput
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field
                label="New Password"
                required
                help="At least 8 characters."
              >
                <TextInput
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <div>
                <Button type="submit" variant="primary">Change Password</Button>
              </div>
            </form>
          </div>
        </CardBody>
      </Card>

      {/* Workspace Preferences */}
      <Card>
        <CardHeader title="Workspace Preferences" />
        <CardBody>
          <p className="u-page-desc" style={{ marginBottom: 'var(--eb-space-5)' }}>
            These options are stored on this device only and do not affect other users.
          </p>
          <div className="u-stack" style={{ gap: 'var(--eb-space-5)' }}>
            <Field label="Default landing page" help="The screen you open to when you sign in.">
              <Select value={landingPage} onChange={(e) => setLandingPage(e.target.value)}>
                <option value="home">Organization</option>
                <option value="executive">Executive Dashboard</option>
                <option value="workspace">Intelligence Workspace</option>
                <option value="commandcenter">Command Center</option>
              </Select>
            </Field>
            <Field label="Sidebar behavior" help="How the navigation rail starts on desktop.">
              <Select value={sidebarBehavior} onChange={(e) => setSidebarBehavior(e.target.value)}>
                <option value="expanded">Expanded</option>
                <option value="collapsed">Collapsed</option>
                <option value="remember">Remember last state</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader title="Organization" />
        <CardBody>
          <p className="u-page-desc" style={{ marginBottom: 'var(--eb-space-4)' }}>
            Read-only context for the organization you are currently signed in to.
          </p>
          <dl className="eb-org-info">
            <div className="eb-org-info-row">
              <dt className="u-muted">Name</dt>
              <dd>{organizationName || '—'}</dd>
            </div>
            <div className="eb-org-info-row">
              <dt className="u-muted">Status</dt>
              <dd>
                <StatusBadge tone={orgStatus === 'active' ? 'success' : 'neutral'}>
                  {orgStatus
                    ? orgStatus.charAt(0).toUpperCase() + orgStatus.slice(1)
                    : 'Unknown'}
                </StatusBadge>
              </dd>
            </div>
            <div className="eb-org-info-row">
              <dt className="u-muted">Account</dt>
              <dd className="eb-org-tenant">{tenantId}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

function readLocalPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeLocalPref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage unavailable (private mode) — preference simply won't persist. */
  }
}
