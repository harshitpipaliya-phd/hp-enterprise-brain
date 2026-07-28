import { useState, useEffect } from 'react';
import { settingsApi, authApi } from '../../api/notification';
import { useTheme, getThemeOverride, setThemeOverride } from '../../hooks/useTheme';

/**
 * Settings screen. Real, bounded: manual theme override (previously
 * OS-preference-only), plus org-wide notification preferences persisted
 * through the real settings store. Not built: AI settings (nothing to
 * configure — generation isn't wired up), licensing, feature flags.
 */
export default function Settings({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [override, setOverride] = useState<'light' | 'dark' | null>(getThemeOverride());
  const [notifyOnRecommendation, setNotifyOnRecommendation] = useState(true);
  const [notifyOnDecision, setNotifyOnDecision] = useState(true);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    settingsApi.list(tenantId, 'personal').then((settings: Array<{ key: string; value: unknown }>) => {
      const prefs = settings.find((s) => s.key === 'notification_preferences')?.value as any;
      if (prefs) {
        setNotifyOnRecommendation(prefs.recommendation ?? true);
        setNotifyOnDecision(prefs.decision ?? true);
      }
    }).catch(() => {});
  }, [tenantId]);

  const changeTheme = (value: 'light' | 'dark' | null) => {
    setThemeOverride(value);
    setOverride(value);
  };

  const saveNotificationPrefs = async () => {
    await settingsApi.set(tenantId, 'notification_preferences', { recommendation: notifyOnRecommendation, decision: notifyOnDecision }, 'personal');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changePassword = async (e: React.FormEvent) => {
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
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 24 }}>Settings</h1>

      <section style={{ marginBottom: 32 }}>
        <h3>Appearance</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {(['light', 'dark', null] as const).map((opt) => (
            <button
              key={opt ?? 'auto'}
              onClick={() => changeTheme(opt)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${theme.border}`,
                backgroundColor: override === opt ? '#3b82f620' : 'transparent',
                color: override === opt ? '#3b82f6' : theme.text,
              }}
            >
              {opt === 'light' ? 'Light' : opt === 'dark' ? 'Dark' : 'Follow System'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Notification Preferences</h3>
        <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={notifyOnRecommendation} onChange={(e) => setNotifyOnRecommendation(e.target.checked)} style={{ marginRight: 8 }} />
          Notify me when a new Recommendation is generated
        </label>
        <label style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={notifyOnDecision} onChange={(e) => setNotifyOnDecision(e.target.checked)} style={{ marginRight: 8 }} />
          Notify me when a Decision is made
        </label>
        <button onClick={saveNotificationPrefs} style={{ marginTop: 16 }}>{saved ? 'Saved ✓' : 'Save Preferences'}</button>
      </section>

      <section style={{ marginTop: 32 }}>
        <h3>Change Password</h3>
        <form onSubmit={changePassword} style={{ marginTop: 8, display: 'grid', gap: 8, maxWidth: 300 }}>
          {passwordError && <div style={{ color: '#ef4444', fontSize: 12 }}>{passwordError}</div>}
          {passwordSuccess && <div style={{ color: '#22c55e', fontSize: 12 }}>Password changed successfully.</div>}
          <input
            type="password" placeholder="Current password" value={currentPassword} required
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
          />
          <input
            type="password" placeholder="New password (min 8 characters)" value={newPassword} required minLength={8}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
          />
          <button type="submit">Change Password</button>
        </form>
      </section>
    </div>
  );
}
