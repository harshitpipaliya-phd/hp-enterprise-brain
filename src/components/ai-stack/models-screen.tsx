/**
 * AI Stack → Models, for any module. Ported from G2G's components/ai-stack/models-screen.tsx.
 *
 * THIS TAB CONFIGURES THIS MODULE, AND NOTHING LEAVES IT
 *
 * The AI Stack inside a module is decentralised. Choosing a model here applies to this
 * module and to no other, it is saved from this screen, and there is deliberately NO link
 * to AI & Intelligence anywhere on it. Opening a module's AI Stack → Models and picking a
 * model is something you finish in that module.
 *
 * A module choosing its own model is not a second way to edit the organisation's
 * configuration, it is a different setting with a different scope. The two live in
 * different tables and never touch the same row.
 *
 * WHERE EACH SETTING LIVES
 *
 *   this tab              `ai_module_model_bindings` — product module × capability.
 *                         "When this module makes a conversational call, use this model."
 *   AI & Intelligence     `ai_api_keys` and `ai_models` — capability, organisation-wide.
 *                         "Conversational AI runs on this provider by default."
 *
 * A module with no binding inherits the organisation's configuration; a module with one
 * overrides it for itself. Clearing a choice puts the module back on the default.
 *
 * TWO REGISTRIES ARE CALLED "MODULE" AND THEY ARE NOT THE SAME THING
 *
 *   `ai_modules`        PRODUCT modules — what a page is about.
 *   `AiModuleRegistry`  AI CAPABILITY modules — Conversational AI, Generative AI, Agent
 *                       Reasoning. What a request IS.
 *
 * A binding is the intersection of the two, which is why the rows below are capabilities
 * and the module is fixed. The backend only offers the capabilities this module's own
 * flags say it uses — a module with `generative` off is never asked to choose a generative
 * model, because that setting would do nothing.
 *
 * WHAT `effective` MEANS
 *
 * It is resolved through the backend's configuration resolver — the same code the
 * module's next call runs — rather than restated from the saved row. So a binding naming a
 * provider with no usable credential shows what the fallback actually gave it, instead of
 * what was typed.
 *
 * HP BRAIN PORT: credential ids are UUID strings, so the Number() casts G2G applied to
 * them are gone and the id is sent as the string the server issued.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Cpu, KeyRound, Plus, Power, RotateCcw, TriangleAlert, X } from 'lucide-react';

import { Button, Field, Select, TextInput } from '../../ui';
import {
  clearModuleModel,
  createModuleModelCredential,
  fetchModuleModels,
  isModuleOwnChoice,
  saveModuleModel,
  updateModuleModelCredential,
  type AiModuleCredentialOption,
  type AiModuleModelIndex,
  type AiModuleModelRow,
  type AiModuleProviderOption,
} from '../../api/aiStack/module';
import { describeAiError } from '../../api/aiIntelligence/client';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';
import './aiStackScreens-a.css';

/** What each capability does for this module, in the module's own terms. */
const WHAT_IT_DOES: Record<string, string> = {
  conversational_ai: 'Answers a question asked from one of this module’s pages.',
  generative_ai: 'Writes the prose behind this module’s prompts and fills its report layouts.',
  agent_reasoning: 'Reasons for this module’s agents — planning and tool selection.',
};

/** The form state for one capability row, before it is saved. */
interface Draft {
  provider: string;
  model: string;
  credentialId: string;
  maxOutputTokens: string;
}

/** The form state for adding a brand-new model + credential to one capability row. */
interface NewCredentialDraft {
  provider: string;
  model: string;
  modelLabel: string;
  apiKey: string;
  accountEmail: string;
  apiLimit: string;
}

function emptyNewCredentialDraft(provider: string): NewCredentialDraft {
  return { provider, model: '', modelLabel: '', apiKey: '', accountEmail: '', apiLimit: '' };
}

/** The form state for editing the credential currently selected on one capability row. */
interface EditCredentialDraft {
  model: string;
  accountEmail: string;
  apiLimit: string;
  apiKey: string;
}

const EMPTY_EDIT_DRAFT: EditCredentialDraft = { model: '', accountEmail: '', apiLimit: '', apiKey: '' };

function draftFrom(row: AiModuleModelRow): Draft {
  return {
    // Pre-filled from the saved binding where there is one, and otherwise from what the
    // module currently resolves to — so "save" without touching anything pins the module
    // to what it is already using rather than to an empty provider.
    provider: row.binding?.provider ?? row.effective.provider ?? '',
    model: row.binding?.model ?? row.effective.model ?? '',
    credentialId: row.binding?.api_key_id ?? '',
    maxOutputTokens: row.binding?.max_output_tokens == null ? '' : String(row.binding.max_output_tokens),
  };
}


/**
 * Everything this screen needs to know about the module it is configuring.
 *
 * Narrower than `AiStackModule` on purpose. A binding is keyed by the product module and
 * the capability, and the only other thing on the screen is the module's name — nothing
 * else in a descriptor bears on which model a module runs on. Any full `AiStackModule`
 * still satisfies it.
 */
export type AiStackModelsModule = Pick<AiStackModule, 'key' | 'label'>;

export function AiStackModelsScreen({ module }: { module: AiStackModelsModule }) {
  const [index, setIndex] = useState<AiModuleModelIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "Add new model" — which capability's panel is open, and its own draft, separate from
  // `drafts` above so opening it never disturbs the picker's current selection.
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newCredentialDrafts, setNewCredentialDrafts] = useState<Record<string, NewCredentialDraft>>({});

  // Editing the credential currently selected on one capability row.
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [editCredentialDrafts, setEditCredentialDrafts] = useState<Record<string, EditCredentialDraft>>({});

  // `load` is the manual reload path — retry, refresh, and after a save or reset — all
  // triggered from event handlers, never from an effect body, so it may reset
  // `loading`/`error` synchronously before its `await`.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await fetchModuleModels(module.key);
      setIndex(next);
      setDrafts(Object.fromEntries(next.rows.map((row) => [row.capability, draftFrom(row)])));
    } catch (cause) {
      // The real error, never a placeholder configuration. A screen that invented a
      // provider here would be the one thing this whole tab exists not to do.
      setError(describeAiError(cause, 'Could not read this module’s model configuration.'));
      setIndex(null);
    } finally {
      setLoading(false);
    }
  }, [module.key]);

  // The mount fetch is written inline rather than as a call to `load`, so no setState
  // runs synchronously within the effect body — `loading` and `error` already start at
  // the right values (`true` and `null`), and every state update below happens inside a
  // promise callback, after the effect has committed.
  useEffect(() => {
    let cancelled = false;

    fetchModuleModels(module.key)
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
        setDrafts(Object.fromEntries(next.rows.map((row) => [row.capability, draftFrom(row)])));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause, 'Could not read this module’s model configuration.'));
        setIndex(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [module.key]);

  const providers = index?.providers ?? [];
  const credentials = useMemo(() => index?.credentials ?? [], [index]);

  const own = useMemo(
    () => (index?.rows ?? []).filter((row) => isModuleOwnChoice(row.effective)).length,
    [index],
  );

  const save = useCallback(
    async (row: AiModuleModelRow) => {
      const draft = drafts[row.capability];

      if (!draft || !draft.provider) {
        setNotice('Choose a provider before saving.');
        return;
      }

      // A disabled credential cannot be bound — the backend refuses this with a 422
      // (C11), and catching it here means the operator finds out before the request
      // rather than from a generic save error.
      if (draft.credentialId !== '') {
        const chosen = credentials.find((option) => option.id === draft.credentialId);
        if (chosen && chosen.status === 0) {
          setNotice(`${chosen.label} is disabled and cannot be used until it is re-enabled.`);
          return;
        }
      }

      setBusy(row.capability);
      setNotice(null);

      try {
        await saveModuleModel(module.key, {
          capability: row.capability,
          provider: draft.provider,
          model: draft.model.trim() === '' ? null : draft.model.trim(),
          api_key_id: draft.credentialId === '' ? null : draft.credentialId,
          max_output_tokens: draft.maxOutputTokens.trim() === '' ? null : Number(draft.maxOutputTokens),
        });

        // Reloaded rather than patched in place: `effective` is resolved server-side and
        // a local guess at it could disagree with what the module will actually use.
        await load();
        setNotice(`${module.label} will use that model for ${row.label.toLowerCase()}.`);
      } catch (cause) {
        setNotice(describeAiError(cause, 'That could not be saved.'));
      } finally {
        setBusy(null);
      }
    },
    [credentials, drafts, load, module.key, module.label],
  );

  const reset = useCallback(
    async (row: AiModuleModelRow) => {
      setBusy(row.capability);
      setNotice(null);

      try {
        const result = await clearModuleModel(module.key, row.capability);
        await load();
        setNotice(
          result.cleared
            ? `${module.label} is back on the configuration the rest of the organisation uses.`
            : `${module.label} had no choice of its own to clear.`,
        );
      } catch (cause) {
        setNotice(describeAiError(cause, 'That could not be cleared.'));
      } finally {
        setBusy(null);
      }
    },
    [load, module.key, module.label],
  );

  /** Add a brand-new model + credential for one capability, and use it here immediately. */
  const addCredential = useCallback(
    async (row: AiModuleModelRow) => {
      const draft = newCredentialDrafts[row.capability];

      if (!draft || !draft.provider || !draft.model.trim() || !draft.apiKey.trim()) {
        setNotice('Choose a provider, name a model and paste an API key before adding it.');
        return;
      }

      setBusy(row.capability);
      setNotice(null);

      try {
        await createModuleModelCredential(module.key, {
          capability: row.capability,
          provider: draft.provider,
          model: draft.model.trim(),
          model_label: draft.modelLabel.trim() === '' ? null : draft.modelLabel.trim(),
          api_key: draft.apiKey.trim(),
          account_email: draft.accountEmail.trim() === '' ? null : draft.accountEmail.trim(),
          api_limit: draft.apiLimit.trim() === '' ? null : Number(draft.apiLimit.trim()),
        });

        await load();
        setAddingFor(null);
        setNewCredentialDrafts((current) => {
          const next = { ...current };
          delete next[row.capability];
          return next;
        });
        setNotice(`Added ${draft.model.trim()} and ${module.label} will use it for ${row.label.toLowerCase()}.`);
      } catch (cause) {
        setNotice(describeAiError(cause, 'That model could not be added.'));
      } finally {
        setBusy(null);
      }
    },
    [load, module.key, module.label, newCredentialDrafts],
  );

  /** Save edits to the credential currently selected on one capability row. */
  const saveEditedCredential = useCallback(
    async (row: AiModuleModelRow, credentialId: string) => {
      const draft = editCredentialDrafts[row.capability];
      if (!draft) return;

      setBusy(row.capability);
      setNotice(null);

      try {
        await updateModuleModelCredential(module.key, credentialId, {
          model: draft.model.trim() === '' ? undefined : draft.model.trim(),
          api_key: draft.apiKey.trim() === '' ? undefined : draft.apiKey.trim(),
          account_email: draft.accountEmail.trim() === '' ? null : draft.accountEmail.trim(),
          api_limit: draft.apiLimit.trim() === '' ? null : Number(draft.apiLimit.trim()),
        });

        await load();
        setEditingFor(null);
        setNotice('Credential updated.');
      } catch (cause) {
        setNotice(describeAiError(cause, 'That could not be saved.'));
      } finally {
        setBusy(null);
      }
    },
    [editCredentialDrafts, load, module.key],
  );

  /** Enable or disable the credential currently selected on one capability row. */
  const toggleCredentialStatus = useCallback(
    async (row: AiModuleModelRow, credentialId: string, enable: boolean) => {
      setBusy(row.capability);
      setNotice(null);

      try {
        await updateModuleModelCredential(module.key, credentialId, { status: enable });
        await load();
        setNotice(enable ? 'Credential enabled.' : 'Credential disabled — this module will fall back to its next choice.');
      } catch (cause) {
        setNotice(describeAiError(cause, 'That could not be changed.'));
      } finally {
        setBusy(null);
      }
    },
    [load, module.key],
  );

  if (loading) {
    return <AiStackLoading label={`Reading ${module.label}’s model configuration…`} />;
  }

  if (error) {
    return <AiStackError onRetry={() => void load()}>{error}</AiStackError>;
  }

  const rows = index?.rows ?? [];

  const patchNew = (capability: string, fallbackProvider: string, changes: Partial<NewCredentialDraft>) =>
    setNewCredentialDrafts((current) => ({
      ...current,
      [capability]: { ...(current[capability] ?? emptyNewCredentialDraft(fallbackProvider)), ...changes },
    }));

  const patchEdit = (capability: string, changes: Partial<EditCredentialDraft>) =>
    setEditCredentialDrafts((current) => ({
      ...current,
      [capability]: { ...(current[capability] ?? EMPTY_EDIT_DRAFT), ...changes },
    }));

  return (
    <div className="ais-a-section">
      <AiStackHeader
        icon={Cpu}
        title={`${module.label} — models`}
        summary={`What ${module.label}’s AI runs on. Everything here applies to ${module.label} and to no other module.`}
        loading={busy !== null}
        onRefresh={() => void load()}
      />

      <AiStackMetrics
        metrics={[
          { key: 'capabilities', label: 'Capabilities this module uses', value: rows.length },
          {
            key: 'own',
            label: 'On this module’s own choice',
            value: own,
            hint: 'Chosen here, and applying to this module only.',
          },
          {
            key: 'inherited',
            label: 'Inheriting the organisation default',
            value: rows.length - own,
            hint: 'Following whatever the rest of the system uses.',
          },
        ]}
      />

      <div aria-live="polite" className="ais-a-live">
        {notice ? <AiStackHint>{notice}</AiStackHint> : null}
      </div>

      {rows.length === 0 ? (
        <AiStackCard className="ais-a-card-clip">
          <AiStackCardHeading
            title="This module calls no model"
            hint={`${module.label} has no conversational, generative or agent capability switched on, so there is nothing here to configure.`}
          />
          <p className="ais-card-body ais-a-body">
            Switching a capability on is done where the module’s capabilities are set, not on this tab — and this tab
            would have nothing to say about a capability the module never invokes.
          </p>
        </AiStackCard>
      ) : null}

      {rows.map((row) => {
        const stored = drafts[row.capability] ?? draftFrom(row);
        // A binding can still name a credential that has since been disabled; the server
        // lists only usable credentials and would refuse it on save. Showing it as chosen
        // would point the select at an option that is not there, so it reads as unset.
        const draft =
          stored.credentialId !== '' && !credentials.some((option) => option.id === stored.credentialId)
            ? { ...stored, credentialId: '' }
            : stored;
        const provider = providers.find((candidate) => candidate.key === draft.provider);
        const ownChoice = isModuleOwnChoice(row.effective);
        const working = busy === row.capability;
        const idBase = `${module.key}-${row.capability}`;

        const setDraft = (changes: Partial<Draft>) =>
          setDrafts((current) => ({ ...current, [row.capability]: { ...draft, ...changes } }));

        const selectedCredential = credentials.find((option) => option.id === draft.credentialId);
        const canEditSelected = selectedCredential?.scope === 'institute';
        const addOpen = addingFor === row.capability;
        const editOpen = editingFor === row.capability;
        const newDraft = newCredentialDrafts[row.capability];
        const editDraft = editCredentialDrafts[row.capability];

        return (
          <AiStackCard key={row.capability} className="ais-a-card-clip">
            <AiStackCardHeading
              title={row.label}
              hint={WHAT_IT_DOES[row.capability] ?? row.description}
              actions={
                <div className="ais-a-actions">
                  <AiStackPill tone={ownChoice ? 'green' : 'gray'}>
                    {ownChoice ? `${module.label}’s own choice` : 'Organisation default'}
                  </AiStackPill>
                  {row.wired ? null : <AiStackPill tone="amber">Stored, not yet read</AiStackPill>}
                </div>
              }
            />

            <div className="ais-card-body">
              {/*
                What the module will actually use, resolved by the same code the call runs.
                Shown above the form because it is the answer to the question somebody opened
                this tab with.
              */}
              <dl className="ais-a-effective">
                <div>
                  <dt>In force now</dt>
                  <dd>{row.effective.provider_label}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd className="ais-a-mono">{row.effective.model ?? 'the provider’s own default'}</dd>
                </div>
                <div>
                  <dt>Credential</dt>
                  <dd className="ais-a-plain">
                    {row.effective.has_credential ? 'resolved' : 'none — calls will fail'}
                  </dd>
                </div>
              </dl>

              {row.wired ? null : (
                <p className="ais-a-warn-line">
                  <TriangleAlert size={16} aria-hidden="true" />
                  <span>
                    This capability still reaches its provider its own way, so a choice saved here is stored and shown
                    but not yet read. It is recorded rather than refused, so the setting is ready when the capability
                    is wired.
                  </span>
                </p>
              )}

              {row.binding && !row.binding.editable ? (
                <p className="ais-a-body ais-a-mt3">
                  A default for {module.label} is set for the whole platform
                  {row.binding.updated_at ? ` (${formatWhen(row.binding.updated_at)})` : ''}. Saving below gives this
                  organisation its own choice and leaves the platform default alone.
                </p>
              ) : null}

              <div className="ais-a-grid-2 ais-a-mt4">
                <Field label="Provider">
                  <Select
                    id={`${idBase}-provider`}
                    value={draft.provider}
                    disabled={working}
                    onChange={(event) => {
                      const nextProvider = event.target.value;
                      const known = providers.find((candidate) => candidate.key === nextProvider);

                      setDraft({
                        provider: nextProvider,
                        // The model belongs to the provider, so changing one clears the
                        // other rather than leaving a model this provider cannot serve.
                        model: known?.default_model ?? '',
                        credentialId: '',
                      });
                    }}
                  >
                    <option value="">Choose a provider…</option>
                    {providers.map((option: AiModuleProviderOption) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Model">
                  {provider && provider.models.length > 0 ? (
                    <Select
                      id={`${idBase}-model`}
                      value={draft.model}
                      disabled={working}
                      onChange={(event) => setDraft({ model: event.target.value })}
                    >
                      <option value="">The provider’s own default</option>
                      {provider.models.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                          {option.scope === 'institute' ? ' (this organisation)' : ''}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      id={`${idBase}-model`}
                      className="ais-a-code-input"
                      value={draft.model}
                      disabled={working}
                      placeholder="The provider’s own default"
                      onChange={(event) => setDraft({ model: event.target.value })}
                    />
                  )}
                </Field>

                <Field label="Credential">
                  <Select
                    id={`${idBase}-credential`}
                    value={draft.credentialId}
                    disabled={working}
                    onChange={(event) => setDraft({ credentialId: event.target.value })}
                  >
                    {/*
                      The usual answer. Choosing a model should not require handing out a
                      second key, so a blank credential means "whatever this provider would
                      have used anyway".
                    */}
                    <option value="">Use the credential this provider already uses</option>
                    {credentials
                      .filter((option: AiModuleCredentialOption) =>
                        // A credential is only this row's to pick when it is FOR this
                        // capability — the same provider used by a different capability
                        // is not interchangeable with it.
                        option.capability === row.capability &&
                        (draft.provider === '' ? true : option.provider === draft.provider),
                      )
                      .map((option) => (
                        <option key={option.id} value={option.id} disabled={option.status === 0}>
                          {option.label} ({option.capability})
                          {option.daily_limit == null ? '' : ` — ${option.daily_limit}/day`}
                          {option.status === 0 ? ' — disabled' : ''}
                        </option>
                      ))}
                  </Select>
                </Field>

                <Field label="Maximum output tokens">
                  <TextInput
                    id={`${idBase}-max-tokens`}
                    value={draft.maxOutputTokens}
                    disabled={working}
                    inputMode="numeric"
                    placeholder="Leave blank for the provider’s ceiling"
                    onChange={(event) => setDraft({ maxOutputTokens: event.target.value })}
                  />
                </Field>
              </div>

              <div className="ais-a-actions ais-a-actions--gap3 ais-a-mt3">
                <button
                  type="button"
                  className="ais-a-link"
                  disabled={working}
                  aria-expanded={addOpen}
                  onClick={() => {
                    setEditingFor(null);
                    setAddingFor(addOpen ? null : row.capability);
                    setNewCredentialDrafts((current) => ({
                      ...current,
                      [row.capability]: current[row.capability] ?? emptyNewCredentialDraft(draft.provider),
                    }));
                  }}
                >
                  {addOpen ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                  {addOpen ? 'Cancel' : 'Add new model'}
                </button>

                {canEditSelected && selectedCredential ? (
                  <>
                    <button
                      type="button"
                      className="ais-a-link ais-a-link--muted"
                      disabled={working}
                      aria-expanded={editOpen}
                      onClick={() => {
                        setAddingFor(null);
                        setEditingFor(editOpen ? null : row.capability);
                        setEditCredentialDrafts((current) => ({
                          ...current,
                          [row.capability]: current[row.capability] ?? {
                            model: draft.model,
                            accountEmail: selectedCredential.label.startsWith('Credential #')
                              ? ''
                              : selectedCredential.label,
                            apiLimit:
                              selectedCredential.daily_limit == null ? '' : String(selectedCredential.daily_limit),
                            apiKey: '',
                          },
                        }));
                      }}
                    >
                      {editOpen ? <X size={14} aria-hidden="true" /> : null}
                      {editOpen ? 'Cancel' : 'Edit this credential'}
                    </button>

                    <button
                      type="button"
                      className="ais-a-link ais-a-link--warn"
                      disabled={working}
                      onClick={() => void toggleCredentialStatus(row, selectedCredential.id, false)}
                    >
                      <Power size={14} aria-hidden="true" />
                      Disable
                    </button>
                  </>
                ) : null}
              </div>

              {addOpen ? (
                <div className="ais-a-subpanel ais-a-subpanel--accent" role="group" aria-labelledby={`${idBase}-add-title`}>
                  <p id={`${idBase}-add-title`} className="ais-a-subpanel-title">
                    Add a new model for {module.label}
                  </p>
                  <p className="ais-a-small">
                    Creates this organisation’s own credential — not the platform default — and uses it for{' '}
                    {row.label.toLowerCase()} immediately after it is added.
                  </p>

                  <div className="ais-a-grid-2">
                    <Field label="Provider">
                      <Select
                        value={newDraft?.provider ?? draft.provider}
                        disabled={working}
                        onChange={(event) => patchNew(row.capability, '', { provider: event.target.value })}
                      >
                        <option value="">Choose a provider…</option>
                        {providers.map((option: AiModuleProviderOption) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Model id">
                      <TextInput
                        className="ais-a-code-input"
                        placeholder="e.g. gpt-4o-mini"
                        value={newDraft?.model ?? ''}
                        disabled={working}
                        onChange={(event) => patchNew(row.capability, draft.provider, { model: event.target.value })}
                      />
                    </Field>

                    <Field label="Display label (optional)">
                      <TextInput
                        placeholder="How this model is shown in the picker"
                        value={newDraft?.modelLabel ?? ''}
                        disabled={working}
                        onChange={(event) =>
                          patchNew(row.capability, draft.provider, { modelLabel: event.target.value })
                        }
                      />
                    </Field>

                    <Field label="API key">
                      <TextInput
                        type="password"
                        autoComplete="off"
                        className="ais-a-code-input"
                        placeholder="Pasted once; never shown again"
                        value={newDraft?.apiKey ?? ''}
                        disabled={working}
                        onChange={(event) => patchNew(row.capability, draft.provider, { apiKey: event.target.value })}
                      />
                    </Field>

                    <Field label="Account email (optional)">
                      <TextInput
                        type="email"
                        placeholder="So this credential is easy to tell apart later"
                        value={newDraft?.accountEmail ?? ''}
                        disabled={working}
                        onChange={(event) =>
                          patchNew(row.capability, draft.provider, { accountEmail: event.target.value })
                        }
                      />
                    </Field>

                    <Field label="Daily limit (optional)">
                      <TextInput
                        inputMode="numeric"
                        placeholder="Requests per day"
                        value={newDraft?.apiLimit ?? ''}
                        disabled={working}
                        onChange={(event) => patchNew(row.capability, draft.provider, { apiLimit: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="ais-a-actions ais-a-mt3">
                    <Button
                      variant="primary"
                      disabled={working}
                      icon={<Plus size={16} aria-hidden="true" />}
                      onClick={() => void addCredential(row)}
                    >
                      {working ? 'Adding…' : 'Save and use this model'}
                    </Button>
                  </div>
                </div>
              ) : null}

              {editOpen && drafts[row.capability] ? (
                <div className="ais-a-subpanel" role="group" aria-labelledby={`${idBase}-edit-title`}>
                  <p id={`${idBase}-edit-title`} className="ais-a-subpanel-title">
                    Edit this credential
                  </p>
                  <p className="ais-a-small">Leave the API key blank to keep the one already stored.</p>

                  <div className="ais-a-grid-2">
                    <Field label="Model id">
                      <TextInput
                        className="ais-a-code-input"
                        value={editDraft?.model ?? ''}
                        disabled={working}
                        onChange={(event) => patchEdit(row.capability, { model: event.target.value })}
                      />
                    </Field>

                    <Field label="New API key (optional)">
                      <TextInput
                        type="password"
                        autoComplete="off"
                        className="ais-a-code-input"
                        placeholder="Leave blank to keep the current key"
                        value={editDraft?.apiKey ?? ''}
                        disabled={working}
                        onChange={(event) => patchEdit(row.capability, { apiKey: event.target.value })}
                      />
                    </Field>

                    <Field label="Account email">
                      <TextInput
                        type="email"
                        value={editDraft?.accountEmail ?? ''}
                        disabled={working}
                        onChange={(event) => patchEdit(row.capability, { accountEmail: event.target.value })}
                      />
                    </Field>

                    <Field label="Daily limit">
                      <TextInput
                        inputMode="numeric"
                        value={editDraft?.apiLimit ?? ''}
                        disabled={working}
                        onChange={(event) => patchEdit(row.capability, { apiLimit: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="ais-a-actions ais-a-mt3">
                    <Button
                      variant="navy"
                      disabled={working || draft.credentialId === ''}
                      icon={<Check size={16} aria-hidden="true" />}
                      onClick={() => {
                        if (draft.credentialId !== '') void saveEditedCredential(row, draft.credentialId);
                      }}
                    >
                      {working ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="ais-a-actions ais-a-actions--gap3 ais-a-mt4">
                <Button
                  variant="primary"
                  disabled={working || draft.provider === ''}
                  icon={<Check size={16} aria-hidden="true" />}
                  onClick={() => void save(row)}
                >
                  {working ? 'Saving…' : `Use this for ${module.label}`}
                </Button>

                {ownChoice && row.binding?.editable ? (
                  <Button
                    variant="secondary"
                    disabled={working}
                    icon={<RotateCcw size={16} aria-hidden="true" />}
                    onClick={() => void reset(row)}
                  >
                    Use the organisation default instead
                  </Button>
                ) : null}

                {draft.credentialId === '' ? null : (
                  <span className="ais-a-inline-note">
                    <KeyRound size={14} aria-hidden="true" />
                    This module will use its own credential and quota.
                  </span>
                )}
              </div>
            </div>
          </AiStackCard>
        );
      })}

      {/*
        No link to AI & Intelligence, deliberately. What is configured here is this
        module's; what is configured there is the organisation's; and a module's AI Stack
        that sent somebody to the central console would be neither decentralised nor honest
        about which setting they were about to change.
      */}
      <AiStackHint>
        Everything on this tab applies to {module.label} only. A capability left on the organisation default follows whatever the
        rest of the system uses, and clearing a choice puts it back there.
      </AiStackHint>
    </div>
  );
}
