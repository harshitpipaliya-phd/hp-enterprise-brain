/**
 * AI Stack → Prompts, for any module. Ported from G2G's components/ai-stack/prompts-screen.tsx.
 *
 * The prompts behind each of the module's AI features, kept out of the code.
 *
 * WHY THIS SITS BESIDE TEMPLATES RATHER THAN INSIDE IT
 *
 * A prompt and a report template are both `ai_templates` rows for this module's
 * `module_key`, separated by `kind`. They are not the same thing and must not share a
 * list: a prompt is text sent to a model, which writes prose; a report is an HTML layout
 * whose placeholders are filled by substitution from rows a tool fetched, with no model
 * near the figures. The Templates screen filters to `kind === 'report'` and this one to
 * `kind === 'prompt'`, so an author editing "the summary prompt" cannot land in the report
 * layout by accident.
 *
 * DECENTRALISED, SAME STORE
 *
 * This calls the same `api/aiIntelligence/templates` client the central AI & Intelligence
 * console calls, so the contract is shared and a change to it breaks both at compile time.
 * What makes a prompt this module's is the scope: the list is fetched with this module's
 * key and every save sets it, so a prompt written here cannot come out filed against
 * another module.
 *
 * PLATFORM PROMPTS ARE NOT EDITED IN PLACE
 *
 * The prompts that ship with the product are platform rows — shared by every
 * organisation, owned by none. The API reports that as `editable_in_place: false`, and
 * saving one writes this organisation its own copy rather than changing everybody's. The
 * screen says so before the save rather than after, because "I edited the shared prompt"
 * and "I forked it" are different things to be told afterwards.
 *
 * HP BRAIN PORT: ids are UUID strings; retiring asks through ConfirmationDialog instead of
 * `window.confirm`; G2G's AiFieldAssistant (the sparkle helper beside "What it is for" and
 * "System prompt") has no HP Brain counterpart and is omitted. HP Brain's update reports a
 * fork as `overridden` (G2G: `forked`); both are read as a fork.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Copy, Eye, Pencil, Plus, Save, Terminal, Trash2, X } from 'lucide-react';

import { Button, ConfirmationDialog, Field, IconButton, Select, TextInput, Textarea } from '../../ui';
import {
  createTemplate,
  fetchTemplateOptions,
  fetchTemplates,
  previewTemplate,
  retireTemplate,
  updateTemplate,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplatePreview,
} from '../../api/aiIntelligence/templates';
import { describeAiError } from '../../api/aiIntelligence/client';
import { refreshModuleAiStack } from './module-ai-stack';

import {
  AiStackCard,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';
import './aiStackScreens-a.css';

/** Placeholder syntax a prompt uses. Shown, not guessed at from documentation. */
const PLACEHOLDER_HINT = 'Wrap a variable in double braces, for example {{records}}.';

interface FormState {
  id: string | null;
  /** True when saving will fork a platform row into this organisation's own copy. */
  forks: boolean;
  name: string;
  description: string;
  system_prompt: string;
  user_prompt: string;
  status: string;
  category: string;
  output_format: string;
  requires_review: boolean;
  offer_in_module: boolean;
}

function blankForm(module: AiStackModule, options: AiTemplateOptions | null): FormState {
  return {
    id: null,
    forks: false,
    name: '',
    description: '',
    // The standing instruction this module needs and which is easiest to forget.
    system_prompt: module.copy.promptSystemDefault,
    user_prompt: '',
    status: 'draft',
    category: '',
    output_format: options?.output_formats[0] ?? 'text',
    requires_review: true,
    offer_in_module: false,
  };
}

function formFrom(row: AiTemplateRow): FormState {
  return {
    id: row.id,
    forks: !row.editable_in_place,
    name: row.name,
    description: row.description ?? '',
    system_prompt: row.system_prompt ?? '',
    user_prompt: row.user_prompt,
    status: row.status,
    category: row.category ?? '',
    output_format: row.output_format,
    requires_review: row.requires_review,
    offer_in_module: row.offered_in_module,
  };
}

export function AiStackPromptsScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [rows, setRows] = useState<AiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [retiring, setRetiring] = useState<AiTemplateRow | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTemplateOptions()
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    // `latestOnly`: this tab's own view — one row per template key, this organisation's
    // own row shadowing the platform's, highest version only.
    fetchTemplates(module.key, true)
      .then((next) => {
        if (cancelled) return;
        setRows(next.templates.filter((row) => row.kind === 'prompt'));
        setError('');
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
  }, [token, module.key]);

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  /** The variables the backend says a prompt may use, and which ground an answer. */
  const variables = useMemo(() => options?.variables ?? [], [options]);
  const grounding = useMemo(() => new Set(options?.grounding_variables ?? []), [options]);

  const runPreview = async () => {
    if (!form) return;

    setPreviewing(true);
    setError('');

    try {
      setPreview(
        await previewTemplate({
          system_prompt: form.system_prompt.trim() === '' ? null : form.system_prompt,
          user_prompt: form.user_prompt,
          // Sample rows shaped like this module's, rather than the endpoint's default set.
          // A prompt previewed against another module's rows tells the author nothing.
          module_key: module.key,
        }),
      );
    } catch (cause) {
      setError(describeAiError(cause, 'The preview failed.'));
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      module_key: module.key,
      kind: 'prompt' as const,
      status: form.status,
      system_prompt: form.system_prompt.trim() === '' ? null : form.system_prompt,
      user_prompt: form.user_prompt,
      category: form.category.trim() === '' ? null : form.category.trim(),
      output_format: form.output_format,
      requires_review: form.requires_review,
      offer_in_module: form.offer_in_module,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice(`${module.label} prompt saved.`);
      } else {
        const result = await updateTemplate(form.id, payload);
        setNotice(
          result.action === 'forked' || result.action === 'overridden' || form.forks
            ? 'Saved as this organisation’s own copy. The shared platform prompt is unchanged.'
            : `${module.label} prompt updated.`,
        );
      }

      setForm(null);
      setPreview(null);
      // The screens that resolve a prompt for an operation cache the published set for the
      // lifetime of the page. Dropping it here means the prompt just published is the one
      // the next draft uses, rather than the one that was published when the tab opened.
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setSaving(false);
    }
  };

  const retire = async () => {
    if (!retiring) return;

    setRetireBusy(true);

    try {
      await retireTemplate(retiring.id);
      setNotice('Prompt retired.');
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetireBusy(false);
      setRetiring(null);
    }
  };

  if (loading && rows.length === 0 && !error) {
    return <AiStackLoading label={`Loading ${module.label} prompts…`} />;
  }

  const openNew = () => {
    setForm(blankForm(module, options));
    setPreview(null);
    setNotice('');
  };

  const closeForm = () => {
    setForm(null);
    setPreview(null);
  };

  return (
    <section className="ais-a-section">
      <AiStackHeader
        icon={Terminal}
        title={`${module.label} prompts`}
        summary={`The text sent to a model behind each ${module.label} AI feature. Versioned, editable, and never compiled into the app.`}
        loading={loading}
        onRefresh={reload}
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>
            New prompt
          </Button>
        }
      />

      <AiStackHint>
        A prompt is text a model reads; it cannot state a figure on its own authority. Anything that has to print
        real records belongs on the <strong>Templates</strong> tab, where {module.copy.reportCanPrint}
      </AiStackHint>

      <div aria-live="polite" className="ais-a-live">
        {notice && <AiStackNotice>{notice}</AiStackNotice>}
      </div>
      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      {rows.length === 0 && !loading ? (
        <AiStackEmpty
          icon={Terminal}
          title={`No ${module.label} prompts yet`}
          action={
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={openNew}>
              New prompt
            </Button>
          }
        >
          {module.label} AI features fall back to their built-in wording until a prompt exists here.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="ais-a-card-clip">
          <div className="ais-table-wrap">
            <table className="ais-table ais-a-table--60">
              <AiStackTableHead
                columns={[
                  'Prompt',
                  'Grounding',
                  'Version',
                  'Review',
                  `In ${module.label}`,
                  'Status',
                  'Updated',
                  'Actions',
                ]}
              />
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="ais-a-cell-title">
                        {row.name}
                        {row.is_platform && <AiStackPill tone="blue">platform</AiStackPill>}
                      </div>
                      <div className="ais-a-cell-key">{row.template_key}</div>
                      {row.description && <div className="ais-a-cell-desc">{row.description}</div>}
                    </td>
                    <td>
                      {row.grounding_variables.length ? (
                        <div className="ais-a-chips ais-a-chips--narrow">
                          {row.grounding_variables.map((variable) => (
                            <span key={variable} className="ais-a-chip ais-a-chip--ground">
                              {variable}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="ais-a-cell-xs ais-a-warn-text">none — answers rest on nothing</span>
                      )}
                      {row.unresolvable_variables.length > 0 && (
                        <div className="ais-a-unresolved">
                          <AlertTriangle size={12} aria-hidden="true" />
                          <span>
                            unresolved: <span className="ais-a-mono">{row.unresolvable_variables.join(', ')}</span>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="ais-a-cell-num">v{row.version}</td>
                    <td className="ais-a-cell-xs">
                      {row.requires_review ? 'A person reviews' : <span className="ais-a-faint">Not required</span>}
                    </td>
                    <td className="ais-a-cell-xs">
                      {row.offered_in_module ? (
                        <span className="ais-a-ok">Offered</span>
                      ) : (
                        <span>Not offered</span>
                      )}
                    </td>
                    <td>
                      <AiStackPill
                        tone={row.status === 'published' ? 'green' : row.status === 'draft' ? 'amber' : 'gray'}
                      >
                        {row.status}
                      </AiStackPill>
                    </td>
                    <td className="ais-a-nowrap ais-a-cell-xs">{formatWhen(row.updated_at)}</td>
                    <td>
                      <div className="ais-a-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={
                            row.editable_in_place ? (
                              <Pencil size={14} aria-hidden="true" />
                            ) : (
                              <Copy size={14} aria-hidden="true" />
                            )
                          }
                          onClick={() => {
                            setForm(formFrom(row));
                            setPreview(null);
                            setNotice('');
                          }}
                          aria-label={`${row.editable_in_place ? 'Edit' : 'Customise'} ${row.name}`}
                        >
                          {row.editable_in_place ? 'Edit' : 'Customise'}
                        </Button>
                        {row.status !== 'archived' && row.editable_in_place && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={<Trash2 size={14} aria-hidden="true" />}
                            onClick={() => setRetiring(row)}
                            aria-label={`Retire ${row.name}`}
                          >
                            Retire
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      {form && (
        <form onSubmit={submit} className="ais-a-panel" aria-labelledby={`${module.key}-prompt-form-title`}>
          <div className="ais-a-panel-head">
            <h3 id={`${module.key}-prompt-form-title`} className="ais-a-panel-title">
              {form.id === null
                ? `New ${module.label} prompt`
                : form.forks
                  ? 'Customise for this organisation'
                  : `Edit ${module.label} prompt`}
            </h3>
            <IconButton label="Close" size="sm" onClick={closeForm}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </div>

          {form.forks && (
            <p className="ais-a-callout ais-a-callout--info">
              <span>
                This is a shared platform prompt. Saving writes <strong>this organisation its own copy</strong> — every
                other organisation keeps the original.
              </span>
            </p>
          )}

          <div className="ais-a-grid-2">
            {/* Fixed, and shown rather than hidden: this screen exists to manage this
                module's prompts, and a module selector here would offer one option. */}
            <Field label="Module Name" required>
              <TextInput value={module.label} readOnly className="ais-a-readonly" />
            </Field>

            <Field label="Prompt title" required>
              <TextInput value={form.name} onChange={(event) => patch({ name: event.target.value })} required />
            </Field>
          </div>

          <Field label="What it is for">
            <TextInput
              id={`${module.key}-prompt-description`}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>

          <Field label="System prompt" help="The standing instruction — how to behave, and what not to invent.">
            <Textarea
              id={`${module.key}-prompt-system`}
              className="ais-a-code-input"
              value={form.system_prompt}
              onChange={(event) => patch({ system_prompt: event.target.value })}
              rows={4}
            />
          </Field>

          <Field label="User prompt" required help={PLACEHOLDER_HINT}>
            <Textarea
              id={`${module.key}-prompt-user`}
              className="ais-a-code-input"
              value={form.user_prompt}
              onChange={(event) => patch({ user_prompt: event.target.value })}
              rows={7}
              required
            />
          </Field>

          {variables.length > 0 && (
            <div className="ais-a-vars" role="group" aria-labelledby={`${module.key}-prompt-vars`}>
              <p id={`${module.key}-prompt-vars`} className="ais-a-overline">
                Variables available
              </p>
              <p className="ais-a-small">
                Click one to insert it. Green variables carry the {module.label} data a grounded answer has to rest on
                — a prompt with none of them is refused before a model is called.
              </p>
              <div className="ais-a-vars-list">
                {variables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    title={variable.description}
                    aria-label={`Insert ${variable.key} into the user prompt`}
                    onClick={() => patch({ user_prompt: `${form.user_prompt}{{${variable.key}}}` })}
                    className={`ais-a-var${
                      grounding.has(variable.key) || variable.grounding ? ' ais-a-var--ground' : ''
                    }`}
                  >
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ais-a-grid-3">
            <Field label="Status" help="Only a published prompt is used.">
              <Select value={form.status} onChange={(event) => patch({ status: event.target.value })}>
                {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Output format">
              <Select value={form.output_format} onChange={(event) => patch({ output_format: event.target.value })}>
                {(options?.output_formats ?? ['text']).map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Category">
              <TextInput
                value={form.category}
                onChange={(event) => patch({ category: event.target.value })}
                list={`${module.key}-prompt-categories`}
              />
            </Field>
            <datalist id={`${module.key}-prompt-categories`}>
              {(options?.categories ?? []).map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          <div className="ais-a-grid-toggles">
            <label className="ais-a-toggle">
              <input
                type="checkbox"
                checked={form.requires_review}
                onChange={(event) => patch({ requires_review: event.target.checked })}
              />
              <span>
                A person reviews the output
                <span className="ais-a-toggle-hint">
                  Nothing generated by this prompt is used until somebody reads it. Leave this on for anything a
                  customer will receive.
                </span>
              </span>
            </label>

            <label className="ais-a-toggle">
              <input
                type="checkbox"
                checked={form.offer_in_module}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
              />
              <span>
                Offer this prompt in the {module.label} AI panel
                <span className="ais-a-toggle-hint">
                  It appears as a suggestion when somebody opens the assistant from a {module.label} page.
                </span>
              </span>
            </label>
          </div>

          <div className="ais-a-actions ais-a-actions--top">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              icon={saving ? undefined : <Save size={16} aria-hidden="true" />}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => void runPreview()}
              loading={previewing}
              disabled={form.user_prompt.trim() === ''}
              icon={previewing ? undefined : <Eye size={16} aria-hidden="true" />}
            >
              Preview
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
          </div>

          <div aria-live="polite" className="ais-a-live">
            {preview && <PreviewPanel preview={preview} />}
          </div>
        </form>
      )}

      <ConfirmationDialog
        open={retiring !== null}
        onCancel={() => setRetiring(null)}
        onConfirm={() => void retire()}
        title={retiring ? `Retire "${retiring.name}"?` : 'Retire prompt?'}
        description={`${module.label} AI will stop using it.`}
        confirmLabel="Retire"
        destructive
        loading={retireBusy}
      />
    </section>
  );
}

/**
 * The prompts as a model would receive them, with sample values substituted.
 *
 * No model is called and nothing is stored — this answers "did my placeholder land where I
 * meant it to", which is a question about the text.
 */
function PreviewPanel({ preview }: { preview: TemplatePreview }) {
  return (
    <div className="ais-a-preview">
      <p className="ais-a-overline">Preview — rendered with sample values. No model was called.</p>

      {preview.unresolved.length > 0 && (
        <p className="ais-a-callout ais-a-callout--warn">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            Nothing fills <span className="ais-a-mono">{preview.unresolved.join(', ')}</span>, so each reaches the
            model as literal text.
          </span>
        </p>
      )}

      {preview.system && (
        <div>
          <p className="ais-a-overline">System</p>
          <pre className="ais-a-preview-pre">{preview.system}</pre>
        </div>
      )}

      <div>
        <p className="ais-a-overline">User</p>
        <pre className="ais-a-preview-pre ais-a-preview-pre--tall">{preview.user}</pre>
      </div>
    </div>
  );
}
