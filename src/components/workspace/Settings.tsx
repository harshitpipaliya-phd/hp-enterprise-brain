import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Building2, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { settingsApi, authApi } from '../../api/notification';
import { api as organizationApi } from '../../api/organization';
import type { DeletionPreview, DeletionResult } from '../../api/organization';
import type { Organization } from '../../App';
import { getThemeOverride, setThemeOverride } from '../../hooks/useTheme';
import {
  PageHeader, Card, CardHeader, CardBody, CardFooter,
  Button, Switch, Field, TextInput, Select, StatusBadge, Alert, Modal,
} from '../../ui';
import './Settings.css';

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
  organization,
  onDeleted,
}: {
  tenantId: string;
  organizationName?: string;
  orgStatus?: string;
  organization?: Organization;
  onDeleted?: (organization: Organization, result: DeletionResult) => void;
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [acknowledgeSourceData, setAcknowledgeSourceData] = useState(false);
  const [sourceSystemPrompt, setSourceSystemPrompt] = useState<
    { message: string; tables: { table: string; rows: number }[]; rows: number } | null
  >(null);

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

  const openDeleteDialog = useCallback(async () => {
    if (!organization) return;

    setDeleteOpen(true);
    setDeleteConfirm('');
    setDeleteError(null);
    setAcknowledgeSourceData(false);
    setSourceSystemPrompt(null);
    setDeletePreview(null);
    setPreviewLoading(true);

    try {
      setDeletePreview(await organizationApi.getDeletionPreview(organization.tenantId, organization.id));
    } catch (e: any) {
      setDeleteError(e.message || 'Could not load the deletion summary. Counts are unavailable.');
    } finally {
      setPreviewLoading(false);
    }
  }, [organization]);

  const canonicalName = deletePreview?.organizationName ?? null;

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
    setSourceSystemPrompt(null);
  }, [deleting]);

  const deletePermanently = useCallback(async () => {
    if (!organization || canonicalName === null || deleteConfirm !== canonicalName) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await organizationApi.deleteOrganizationPermanently(
        organization.tenantId,
        deleteConfirm,
        acknowledgeSourceData,
      );
      setDeleteOpen(false);
      onDeleted?.(organization, result);
    } catch (e: any) {
      const body = e?.responseJson ?? null;
      const detail = body?.message || e?.message || 'Unable to delete organization.';

      if (e?.status === 409 && body?.error === 'source_system_data_present') {
        setSourceSystemPrompt({ message: detail, tables: body.tables ?? [], rows: body.rows ?? 0 });
        setDeleteError(null);
      } else {
        setDeleteError(detail);
      }
    } finally {
      setDeleting(false);
    }
  }, [acknowledgeSourceData, canonicalName, deleteConfirm, onDeleted, organization]);

  const themeOptions: { value: 'light' | 'dark' | null; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: null, label: 'Follow System' },
  ];

  return (
    <div className="u-stack" style={{ gap: 'var(--eb-space-5)' }}>
      <PageHeader
        variant="settings"
        icon={<SettingsIcon />}
        title="Organization Settings"
        description="Manage organization configuration, access and system preferences."
        meta={[organizationName ? { icon: <Building2 />, label: organizationName } : null]}
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

      <Card className="settings-danger">
        <CardHeader
          title={(
            <span className="settings-danger__title">
              <AlertTriangle size={18} aria-hidden="true" />
              Danger Zone
            </span>
          )}
        />
        <CardBody>
          <div className="settings-danger__body">
            <div>
              <h4>Delete organization</h4>
              <p>
                Permanently delete this organization and all organization-owned data.
                This includes users, departments, imported records, ingestion history,
                intelligence, signals, evidence, cases, and organization-specific records.
                This action cannot be undone.
              </p>
            </div>
            <Button
              variant="danger-solid"
              icon={<Trash2 size={16} aria-hidden="true" />}
              onClick={openDeleteDialog}
              disabled={!organization}
            >
              Delete Organization
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteDialog}
        title="Delete Organization?"
        description={canonicalName ? `Organization: ${canonicalName}` : 'Loading organization details...'}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={closeDeleteDialog} disabled={deleting}>Cancel</Button>
            <Button
              variant="danger-solid"
              icon={<Trash2 size={16} aria-hidden="true" />}
              loading={deleting}
              disabled={
                canonicalName === null
                || deleteConfirm !== canonicalName
                || (sourceSystemPrompt !== null && !acknowledgeSourceData)
              }
              onClick={deletePermanently}
            >
              Delete Permanently
            </Button>
          </>
        )}
      >
        <div className="settings-delete">
          <Alert tone="danger" title="Permanent deletion">
            This permanently deletes the organization, users, departments, imported data,
            operational records, intelligence, signals, evidence, cases, ingestion history,
            and organization-specific records. Other organizations are not affected.
          </Alert>

          {previewLoading && <p className="u-muted">Calculating what will be deleted...</p>}

          {deletePreview && (
            <div className="settings-delete__summary">
              <strong>{deletePreview.totals.rows.toLocaleString()}</strong> records across{' '}
              <strong>{deletePreview.totals.tables}</strong> tables will be destroyed.
              <ul>
                <li>{deletePreview.totals.identity.toLocaleString()} organization, user, and login records</li>
                <li>{deletePreview.totals.brain.toLocaleString()} intelligence, ingestion, and configuration records</li>
                {deletePreview.totals.sourceSystem > 0 && (
                  <li>{deletePreview.totals.sourceSystem.toLocaleString()} records held by connected source systems</li>
                )}
              </ul>
            </div>
          )}

          {sourceSystemPrompt && (
            <div className="settings-delete__source">
              <p>{sourceSystemPrompt.message}</p>
              <ul>
                {sourceSystemPrompt.tables.slice(0, 8).map((table) => (
                  <li key={table.table}><code>{table.table}</code>: {table.rows.toLocaleString()} rows</li>
                ))}
                {sourceSystemPrompt.tables.length > 8 && (
                  <li>{sourceSystemPrompt.tables.length - 8} more tables</li>
                )}
              </ul>
              <label>
                <input
                  type="checkbox"
                  checked={acknowledgeSourceData}
                  onChange={(event) => setAcknowledgeSourceData(event.target.checked)}
                  disabled={deleting}
                />
                Also permanently delete these {sourceSystemPrompt.rows.toLocaleString()} connected-system records
              </label>
            </div>
          )}

          <Field
            label={canonicalName ? `Type ${canonicalName} to confirm` : 'Loading organization name'}
            required
          >
            <TextInput
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="Type organization name"
              disabled={deleting || canonicalName === null}
              autoComplete="off"
            />
          </Field>

          {deleteError && <Alert tone="danger" title="Deletion failed">{deleteError}</Alert>}
        </div>
      </Modal>
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
