/**
 * AI Provider & Model Management — the Add/Edit half of the providers screen.
 * Ported from G2G's app/ai/_components/ConfigurationManager.tsx.
 *
 * THE FLOW IS THE POINT
 *
 * Module → Provider → Model → API key → Save. Each step narrows the next: the model
 * list is the selected provider's models and nothing else, so the form cannot produce
 * a pairing the provider would reject. The model list comes from the same catalogue
 * Model Management edits — one list, read in two places, never two lists that drift.
 *
 * WHAT THE TWO TABLES SAY, AND WHY BOTH
 *
 * `Saved configurations` is what someone typed. `What each module calls` is what the
 * runtime will actually do — including for modules nobody has configured, which still
 * resolve to the shared pool. Showing only the first would let an administrator
 * conclude that an unconfigured module is not calling anything, when it is.
 *
 * CREDENTIALS ARE ONE-WAY
 *
 * A saved key never comes back from the server, so the edit form starts with the key
 * field blank and a note that leaving it blank keeps the stored one. That is why the
 * field is not pre-filled with a mask: a masked value in an input invites someone to
 * edit around the dots and submit the mask as the new key.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, ShieldAlert, X } from 'lucide-react';

import {
  Alert, Button, Checkbox, ConfirmationDialog, Field, IconButton, Select, StatusBadge, TextInput,
} from '../../../../ui';
import {
  createAiConfiguration,
  fetchAiConfigurationOptions,
  fetchAiConfigurations,
  isPlatformRow,
  retireAiConfiguration,
  updateAiConfiguration,
  type AiConfigurationIndex,
  type AiConfigurationOptions,
  type AiConfigurationRow,
  type AiModelOption,
  type AiProviderOption,
} from '../../../../api/aiIntelligence/configuration';
import { AiApiError, describeAiError } from '../../../../api/aiIntelligence/client';
import {
  LoadErrorCard, LoadingCard, NotWiredBadge, ResultRegion, firstError, scopeLabel,
} from './shared';

interface FormState {
  /** The row being edited, or null when adding. */
  id: string | null;
  ai_module: string;
  provider: string;
  model: string;
  api_key: string;
  account_email: string;
  api_limit: string;
  status: number;
}

const EMPTY_FORM: FormState = {
  id: null,
  ai_module: '',
  provider: '',
  model: '',
  api_key: '',
  account_email: '',
  api_limit: '',
  status: 1,
};

export function ConfigurationManager() {
  const [options, setOptions] = useState<AiConfigurationOptions | null>(null);
  const [index, setIndex] = useState<AiConfigurationIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // G2G asked with window.confirm; HP Brain has an accessible dialog for this.
  const [pendingRetire, setPendingRetire] = useState<AiConfigurationRow | null>(null);
  const [retiring, setRetiring] = useState(false);

  // Bumping this re-runs the effect below. The alternative — a load() the effect
  // calls — sets state synchronously inside the effect body, which React flags as a
  // cascading render. Only the promise callbacks touch state, matching the pattern
  // CapabilityLiveData already uses on this screen.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Both in flight together: the form is useless without the options and the table
    // is useless without the rows, so there is nothing to show until both land.
    Promise.all([fetchAiConfigurationOptions(), fetchAiConfigurations()])
      .then(([nextOptions, nextIndex]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setIndex(nextIndex);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  /** An event handler, so setting state here is not the effect problem above. */
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadToken((token) => token + 1);
  }, []);

  const formProvider = form?.provider ?? '';

  /** Models for the provider currently selected in the form. */
  const modelsForProvider = useMemo(() => {
    if (!options || !formProvider) return [];
    return options.models[formProvider] ?? [];
  }, [options, formProvider]);

  const selectedProvider = useMemo(
    () => options?.providers.find((p) => p.key === formProvider) ?? null,
    [options, formProvider],
  );

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const openEdit = (row: AiConfigurationRow) => {
    setForm({
      id: row.id,
      ai_module: row.ai_module ?? '',
      provider: row.provider,
      model: row.model ?? '',
      // Deliberately blank — see the file note. Blank on save means "keep the stored key".
      api_key: '',
      account_email: row.account_email ?? '',
      api_limit: row.api_limit === null || row.api_limit === undefined ? '' : String(row.api_limit),
      status: row.status,
    });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const closeForm = () => {
    setForm(null);
    setFormError(null);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      ai_module: form.ai_module,
      provider: form.provider,
      model: form.model.trim() === '' ? null : form.model.trim(),
      account_email: form.account_email.trim() === '' ? null : form.account_email.trim(),
      api_limit: form.api_limit.trim() === '' ? null : Number(form.api_limit),
      status: form.status,
      // Omitted entirely on an edit with no new key, so the server leaves the stored
      // credential alone rather than being sent an empty string to store.
      ...(form.api_key.trim() === '' ? {} : { api_key: form.api_key.trim() }),
    };

    try {
      if (form.id === null) {
        await createAiConfiguration(payload);
        setNotice('Configuration saved.');
      } else {
        await updateAiConfiguration(form.id, payload);
        setNotice('Configuration updated.');
      }

      closeForm();
      load();
    } catch (cause) {
      if (cause instanceof AiApiError) {
        setFormError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setFormError(describeAiError(cause));
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmRetire = async () => {
    const row = pendingRetire;
    if (!row) return;

    setRetiring(true);
    try {
      await retireAiConfiguration(row.id);
      setNotice('Configuration retired.');
      load();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetiring(false);
      setPendingRetire(null);
    }
  };

  if (loading && !index) {
    return <LoadingCard>Loading AI configuration…</LoadingCard>;
  }

  if (error && !index) {
    return <LoadErrorCard message={error} onRetry={load} />;
  }

  return (
    <section className="aii-pm-section" aria-labelledby="aii-pm-config-heading">
      <header className="aii-row aii-row--between">
        <div style={{ minWidth: 0 }}>
          <h2 id="aii-pm-config-heading" className="aii-pm-heading">Provider &amp; model configuration</h2>
          <p className="aii-card-desc">
            Point each AI module at the provider, model and credential it should use.
          </p>
        </div>
        <div className="aii-row">
          <Button
            size="sm"
            onClick={load}
            aria-busy={loading || undefined}
            icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
          >
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={openAdd} icon={<Plus size={14} aria-hidden="true" />}>
            Add configuration
          </Button>
        </div>
      </header>

      {/* The error state before this component's return only renders on the FIRST
          load. Without this banner a failed Retire set `error` and showed nothing —
          the row stayed on screen, apparently still active, and the administrator
          had no way to know the write had been refused. */}
      <ResultRegion notice={notice} error={error && index ? error : null} />

      {form && options && (
        <ConfigurationForm
          form={form}
          setForm={setForm}
          options={options}
          models={modelsForProvider}
          provider={selectedProvider}
          saving={saving}
          error={formError}
          fieldErrors={fieldErrors}
          onSubmit={submit}
          onCancel={closeForm}
        />
      )}

      <SavedConfigurations
        rows={index?.configurations ?? []}
        onEdit={openEdit}
        onRetire={setPendingRetire}
      />
      <ResolvedModules rows={index?.resolved ?? []} />

      <ConfirmationDialog
        open={pendingRetire !== null}
        onCancel={() => setPendingRetire(null)}
        onConfirm={confirmRetire}
        title="Retire configuration"
        description={
          pendingRetire
            ? `Retire the ${pendingRetire.provider_label} configuration for ${pendingRetire.module_label}?`
            : undefined
        }
        confirmLabel="Retire"
        destructive
        loading={retiring}
      />
    </section>
  );
}

function ConfigurationForm({
  form,
  setForm,
  options,
  models,
  provider,
  saving,
  error,
  fieldErrors,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  options: AiConfigurationOptions;
  models: AiModelOption[];
  provider: AiProviderOption | null;
  saving: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  // Not named `module`: G2G's Next bundle refused that identifier in client code,
  // and the name is kept so the two files still read side by side.
  const selectedModule = options.modules.find((m) => m.key === form.ai_module) ?? null;
  const isEdit = form.id !== null;

  const moduleErr = firstError(fieldErrors, 'ai_module');
  const providerErr = firstError(fieldErrors, 'provider');
  const modelErr = firstError(fieldErrors, 'model');

  return (
    <form onSubmit={onSubmit} className="aii-card aii-form" aria-labelledby="aii-pm-config-form-title">
      <div className="aii-row aii-row--between">
        <h3 id="aii-pm-config-form-title" className="aii-card-title">
          {isEdit ? 'Edit configuration' : 'Add configuration'}
        </h3>
        <IconButton label="Close" size="sm" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="aii-form-grid">
        <div>
          <Field label="AI module" required error={moduleErr}>
            <Select
              required
              value={form.ai_module}
              onChange={(e) => setForm({ ...form, ai_module: e.target.value })}
              aria-describedby={!moduleErr && selectedModule ? 'aii-pm-module-note' : undefined}
            >
              <option value="">Select a module…</option>
              {options.modules.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          {selectedModule && (
            <div id="aii-pm-module-note">
              <p className="aii-pm-note">{selectedModule.description}</p>
              {!selectedModule.wired && (
                // Said before Save, not after. A settings screen that accepts a value it
                // does not yet control has to say so at the moment of choosing.
                <p className="aii-pm-warn">
                  <ShieldAlert size={14} aria-hidden="true" />
                  This module does not read centralised configuration yet. The setting is saved
                  and shown, but it will not change what this module calls until it is migrated.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <Field label="AI provider" required error={providerErr}>
            <Select
              required
              value={form.provider}
              // Changing provider clears the model: a model belongs to one provider, and
              // carrying it across is how an invalid pairing reaches Save.
              onChange={(e) => setForm({ ...form, provider: e.target.value, model: '' })}
              aria-describedby={!providerErr && provider ? 'aii-pm-provider-note' : undefined}
            >
              <option value="">Select a provider…</option>
              {options.providers.map((p) => (
                <option key={p.key} value={p.key} disabled={!p.driveable}>
                  {p.label}
                  {p.driveable ? '' : ' — not callable yet'}
                </option>
              ))}
            </Select>
          </Field>
          {provider && (
            <p id="aii-pm-provider-note" className="aii-pm-note">
              Credentials stored as <code className="aii-mono">{provider.api_type}</code>.{' '}
              {provider.docs && (
                <a href={provider.docs} target="_blank" rel="noreferrer" className="aii-pm-inline-link">
                  Get a key
                </a>
              )}
            </p>
          )}
        </div>

        <div>
          <Field label="Model" error={modelErr}>
            <Select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              disabled={!form.provider}
              aria-describedby={
                !modelErr && form.provider && models.length === 0 ? 'aii-pm-model-note' : undefined
              }
            >
              <option value="">
                {form.provider ? 'Provider default' : 'Select a provider first'}
              </option>
              {models.map((m) => (
                <option key={m.id} value={m.model_id}>
                  {m.label} ({m.model_id})
                </option>
              ))}
            </Select>
          </Field>
          {form.provider && models.length === 0 && (
            <p id="aii-pm-model-note" className="aii-pm-note">
              No models in the catalogue for this provider. Add one in Model Management,
              or leave this blank to use the provider default.
            </p>
          )}
        </div>

        <Field
          label={isEdit ? 'API key (leave blank to keep the stored key)' : 'API key'}
          required={!isEdit}
          error={firstError(fieldErrors, 'api_key')}
        >
          <TextInput
            type="password"
            autoComplete="off"
            required={!isEdit}
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={isEdit ? '••••••••' : 'Paste the provider API key'}
          />
        </Field>

        <Field label="Account email (optional)" error={firstError(fieldErrors, 'account_email')}>
          <TextInput
            type="email"
            value={form.account_email}
            onChange={(e) => setForm({ ...form, account_email: e.target.value })}
            placeholder="Which account this key belongs to"
          />
        </Field>

        <Field label="Max output tokens (optional)" error={firstError(fieldErrors, 'api_limit')}>
          <TextInput
            type="number"
            min={1}
            value={form.api_limit}
            onChange={(e) => setForm({ ...form, api_limit: e.target.value })}
            placeholder="Provider default"
          />
        </Field>
      </div>

      <div>
        <Checkbox
          label="Active"
          checked={form.status === 1}
          onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
        />
        {firstError(fieldErrors, 'status') && (
          <p className="aii-pm-missing" role="alert">{firstError(fieldErrors, 'status')}</p>
        )}
      </div>

      <div aria-live="polite">
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <div className="aii-row">
        <Button type="submit" variant="primary" loading={saving}>
          {isEdit ? 'Update' : 'Save'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function SavedConfigurations({
  rows,
  onEdit,
  onRetire,
}: {
  rows: AiConfigurationRow[];
  onEdit: (row: AiConfigurationRow) => void;
  onRetire: (row: AiConfigurationRow) => void;
}) {
  return (
    <div className="aii-pm-table-block">
      <h3 id="aii-pm-saved-heading" className="aii-card-title">Saved configurations</h3>

      <div className="aii-table-wrap">
        <table className="aii-table aii-table--wide aii-pm-table" aria-labelledby="aii-pm-saved-heading">
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Provider</th>
              <th scope="col">Model</th>
              <th scope="col">Key</th>
              <th scope="col">Scope</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="u-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="aii-pm-empty-cell">
                  No credentials are stored for this organisation yet.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const platform = isPlatformRow(row);
              return (
                <tr key={row.id}>
                  <td>
                    <span className="aii-row">
                      <strong style={{ fontWeight: 500 }}>{row.module_label}</strong>
                      {row.ai_module && !row.module_wired && <NotWiredBadge />}
                    </span>
                  </td>
                  <td>{row.provider_label}</td>
                  <td className="aii-mono">{row.model ?? 'provider default'}</td>
                  {/* Only the preview ever reaches the browser — the key itself is write-only. */}
                  <td className="aii-mono">{row.key_preview ?? '—'}</td>
                  <td className="aii-small aii-muted">{scopeLabel(platform)}</td>
                  <td>
                    <StatusBadge tone={row.status === 1 ? 'success' : 'neutral'}>
                      {row.status === 1 ? 'Active' : 'Retired'}
                    </StatusBadge>
                  </td>
                  <td>
                    {row.editable && !platform ? (
                      <div className="aii-row">
                        <Button
                          size="sm"
                          onClick={() => onEdit(row)}
                          icon={<Pencil size={12} aria-hidden="true" />}
                          aria-label={`Edit ${row.provider_label} configuration for ${row.module_label}`}
                        >
                          Edit
                        </Button>
                        {row.status === 1 && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onRetire(row)}
                            aria-label={`Retire ${row.provider_label} configuration for ${row.module_label}`}
                          >
                            Retire
                          </Button>
                        )}
                      </div>
                    ) : (
                      // Platform rows are shared by every organisation on the estate. The API
                      // refuses them too — this is the explanation, not the control.
                      <span className="aii-small aii-muted">Shared — read only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  module: 'This organisation’s configuration',
  module_platform: 'Platform configuration',
  pool: 'This organisation’s shared key',
  pool_platform: 'Platform shared key',
  env: 'Environment fallback',
  config: 'No credential',
};

function ResolvedModules({ rows }: { rows: AiConfigurationIndex['resolved'] }) {
  return (
    <div className="aii-pm-table-block">
      <div>
        <h3 id="aii-pm-resolved-heading" className="aii-card-title">What each module calls right now</h3>
        <p className="aii-card-sub">
          Resolved live, including modules with nothing configured — those fall back to the
          shared pool, so they are still calling a provider.
        </p>
      </div>

      <div className="aii-table-wrap">
        <table className="aii-table aii-table--wide aii-pm-table" aria-labelledby="aii-pm-resolved-heading">
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Provider</th>
              <th scope="col">Model</th>
              <th scope="col">Resolved from</th>
              <th scope="col">Credential</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.module}>
                <td>
                  <span className="aii-row">
                    <strong style={{ fontWeight: 500 }}>{row.module_label}</strong>
                    {!row.wired && <NotWiredBadge />}
                  </span>
                </td>
                <td>{row.provider_label}</td>
                <td className="aii-mono">{row.model ?? '—'}</td>
                <td className="aii-small aii-muted">{SOURCE_LABELS[row.source] ?? row.source}</td>
                <td>
                  {row.has_key ? (
                    <span className="aii-pm-ok">Present</span>
                  ) : (
                    <span className="aii-pm-missing">Missing</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
