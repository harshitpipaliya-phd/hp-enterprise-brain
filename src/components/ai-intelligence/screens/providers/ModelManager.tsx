/**
 * AI Model Management — the catalogue the provider screen's model dropdown reads.
 * Ported from G2G's app/ai/_components/ModelManager.tsx.
 *
 * ONE CATALOGUE, NOT A SECOND SYSTEM
 *
 * Every model offered anywhere in the platform is a row here. The provider screen does
 * not keep its own list; it reads this one filtered by the selected provider. So adding
 * a model makes it selectable immediately, and retiring one removes it from every
 * dropdown at once.
 *
 * PLATFORM ROWS ARE READ-ONLY HERE
 *
 * Rows seeded for the whole estate (tenant_id '*') are shared by every organisation, so
 * one organisation renaming or retiring one would change what every other organisation
 * sees. They are listed — an administrator needs to know what is available — but only an
 * organisation's own rows can be edited. The API enforces the same rule; this is the
 * explanation, not the control.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, X } from 'lucide-react';

import {
  Alert, Button, Checkbox, Field, IconButton, Select, StatusBadge, TextInput,
} from '../../../../ui';
import {
  createAiModel,
  fetchAiModels,
  isPlatformRow,
  updateAiModel,
  type AiModelIndex,
  type AiModelOption,
} from '../../../../api/aiIntelligence/configuration';
import { AiApiError, describeAiError } from '../../../../api/aiIntelligence/client';
import {
  LoadErrorCard, LoadingCard, NotWiredBadge, ResultRegion, firstError, scopeLabel,
} from './shared';

interface ModelForm {
  id: string | null;
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens: string;
  input_cost_per_1k: string;
  output_cost_per_1k: string;
  sort_order: string;
  status: number;
}

const EMPTY: ModelForm = {
  id: null,
  provider: '',
  model_id: '',
  label: '',
  max_output_tokens: '',
  input_cost_per_1k: '',
  output_cost_per_1k: '',
  sort_order: '',
  status: 1,
};

export function ModelManager() {
  const [index, setIndex] = useState<AiModelIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<ModelForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // See ConfigurationManager: the effect may not set state synchronously, so a token
  // bump re-runs it and only the promise callbacks touch state.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchAiModels()
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
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

  // Providers that have at least one model, in catalogue order, plus any provider the
  // platform supports so an empty one can still be seen to be empty.
  const providers = useMemo(() => index?.providers ?? [], [index]);

  const openAdd = () => {
    setForm({ ...EMPTY });
    setFormError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const openEdit = (model: AiModelOption) => {
    setForm({
      id: model.id,
      provider: model.provider,
      model_id: model.model_id,
      label: model.label,
      max_output_tokens: model.max_output_tokens?.toString() ?? '',
      input_cost_per_1k: model.input_cost_per_1k?.toString() ?? '',
      output_cost_per_1k: model.output_cost_per_1k?.toString() ?? '',
      // Carried through the round trip so an edit
      // preserves the model's place in the list.
      sort_order: model.sort_order?.toString() ?? '',
      status: model.status,
    });
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
      provider: form.provider,
      model_id: form.model_id.trim(),
      label: form.label.trim(),
      max_output_tokens: form.max_output_tokens.trim() === '' ? null : Number(form.max_output_tokens),
      input_cost_per_1k: form.input_cost_per_1k.trim() === '' ? null : Number(form.input_cost_per_1k),
      output_cost_per_1k: form.output_cost_per_1k.trim() === '' ? null : Number(form.output_cost_per_1k),
      // Sent even when unchanged. The API defaults an omitted sort_order to 0 and
      // writes it, so leaving it out of an edit silently moved the model to the
      // top of every dropdown that reads this catalogue.
      sort_order: form.sort_order.trim() === '' ? 0 : Number(form.sort_order),
      status: form.status,
    };

    try {
      if (form.id === null) {
        await createAiModel(payload);
        setNotice('Model added.');
      } else {
        await updateAiModel(form.id, payload);
        setNotice('Model updated.');
      }

      setForm(null);
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

  if (loading && !index) {
    return <LoadingCard>Loading the model catalogue…</LoadingCard>;
  }

  if (error && !index) {
    return <LoadErrorCard message={error} onRetry={load} />;
  }

  return (
    <section className="aii-pm-section" aria-labelledby="aii-pm-catalogue-heading">
      <header className="aii-row aii-row--between">
        <div style={{ minWidth: 0 }}>
          <h2 id="aii-pm-catalogue-heading" className="aii-pm-heading">Model catalogue</h2>
          <p className="aii-card-desc">
            The models each provider offers. This is the list the provider screen&apos;s model
            dropdown reads.
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
            Add model
          </Button>
        </div>
      </header>

      {/* The full-page error state above only renders before the first successful
          load. Once the catalogue is on screen a failed Refresh used to leave the
          stale list showing with no sign that it was stale — which is the worst
          outcome for a screen whose whole purpose is to say what is configured. */}
      <ResultRegion notice={notice} error={error && index ? error : null} />

      {form && (
        <form onSubmit={submit} className="aii-card aii-form" aria-labelledby="aii-pm-model-form-title">
          <div className="aii-row aii-row--between">
            <h3 id="aii-pm-model-form-title" className="aii-card-title">
              {form.id === null ? 'Add model' : 'Edit model'}
            </h3>
            <IconButton label="Close" size="sm" onClick={() => setForm(null)}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>

          <div className="aii-form-grid">
            <Field label="Provider" required error={firstError(fieldErrors, 'provider')}>
              <Select
                required
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
              >
                <option value="">Select a provider…</option>
                {providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Model id (sent to the provider)" required error={firstError(fieldErrors, 'model_id')}>
              <TextInput
                required
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                placeholder="e.g. gemini-3.6-flash"
                className="aii-mono"
              />
            </Field>

            <Field label="Label (shown in dropdowns)" required error={firstError(fieldErrors, 'label')}>
              <TextInput
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Gemini 3.6 Flash"
              />
            </Field>

            <Field label="Max output tokens (optional)" error={firstError(fieldErrors, 'max_output_tokens')}>
              <TextInput
                type="number"
                min={1}
                value={form.max_output_tokens}
                onChange={(e) => setForm({ ...form, max_output_tokens: e.target.value })}
              />
            </Field>

            <Field label="Input cost per 1K tokens (USD, optional)" error={firstError(fieldErrors, 'input_cost_per_1k')}>
              <TextInput
                type="number"
                step="0.000001"
                min={0}
                value={form.input_cost_per_1k}
                onChange={(e) => setForm({ ...form, input_cost_per_1k: e.target.value })}
              />
            </Field>

            <Field label="Output cost per 1K tokens (USD, optional)" error={firstError(fieldErrors, 'output_cost_per_1k')}>
              <TextInput
                type="number"
                step="0.000001"
                min={0}
                value={form.output_cost_per_1k}
                onChange={(e) => setForm({ ...form, output_cost_per_1k: e.target.value })}
              />
            </Field>
          </div>

          <div>
            <Checkbox
              label="Selectable"
              checked={form.status === 1}
              onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
            />
            {firstError(fieldErrors, 'status') && (
              <p className="aii-pm-missing" role="alert">{firstError(fieldErrors, 'status')}</p>
            )}
          </div>

          <div aria-live="polite">
            {formError && <Alert tone="danger">{formError}</Alert>}
          </div>

          <div className="aii-row">
            <Button type="submit" variant="primary" loading={saving}>
              {form.id === null ? 'Save' : 'Update'}
            </Button>
            <Button onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="aii-stack" style={{ gap: 'var(--space-6)' }}>
        {providers.map((provider) => {
          const models = index?.models[provider.key] ?? [];
          const headingId = `aii-pm-provider-${provider.key}`;

          return (
            <div key={provider.key} className="aii-pm-table-block">
              <h3 id={headingId} className="aii-card-title aii-row">
                {provider.label}
                {!provider.driveable && <NotWiredBadge>no client yet</NotWiredBadge>}
              </h3>

              <div className="aii-table-wrap">
                <table className="aii-table aii-table--wide aii-pm-table" aria-labelledby={headingId}>
                  <thead>
                    <tr>
                      <th scope="col">Label</th>
                      <th scope="col">Model id</th>
                      <th scope="col">Max output</th>
                      <th scope="col">Cost / 1K (in / out)</th>
                      <th scope="col">Scope</th>
                      <th scope="col">Status</th>
                      <th scope="col"><span className="u-sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.length === 0 && (
                      <tr>
                        <td colSpan={7} className="aii-pm-empty-cell">
                          No models in the catalogue for this provider.
                        </td>
                      </tr>
                    )}
                    {models.map((model) => {
                      const platform = isPlatformRow(model);
                      return (
                        <tr key={model.id}>
                          <td style={{ fontWeight: 500 }}>{model.label}</td>
                          <td className="aii-mono">{model.model_id}</td>
                          <td className="aii-num">{model.max_output_tokens ?? '—'}</td>
                          <td className="aii-small aii-num">
                            {/* A blank cost is honest rather than a guessed rate: this
                                column exists so a bill can be explained. */}
                            {model.input_cost_per_1k === null && model.output_cost_per_1k === null
                              ? '—'
                              : `${model.input_cost_per_1k ?? '—'} / ${model.output_cost_per_1k ?? '—'}`}
                          </td>
                          <td className="aii-small aii-muted">{scopeLabel(platform)}</td>
                          <td>
                            <StatusBadge tone={model.status === 1 ? 'success' : 'neutral'}>
                              {model.status === 1 ? 'Selectable' : 'Retired'}
                            </StatusBadge>
                          </td>
                          <td>
                            {!platform ? (
                              <Button
                                size="sm"
                                onClick={() => openEdit(model)}
                                icon={<Pencil size={12} aria-hidden="true" />}
                                aria-label={`Edit ${model.label}`}
                              >
                                Edit
                              </Button>
                            ) : (
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
        })}
      </div>
    </section>
  );
}
