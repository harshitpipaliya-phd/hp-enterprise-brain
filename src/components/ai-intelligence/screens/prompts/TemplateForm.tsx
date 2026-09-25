import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Loader2, Lock, Sparkles, X } from 'lucide-react';

import { Alert, Button, Checkbox, Field, IconButton, Modal, Select, StatusBadge, TextInput } from '../../../../ui';
import { AiApiError, describeAiError } from '../../../../api/aiIntelligence/client';
import {
  createTemplate,
  fetchTemplateOptions,
  previewTemplate,
  updateTemplate,
  SHARED_MODULE_KEY,
  type AiTemplateOptions,
  type AiTemplatePayload,
  type AiTemplateRow,
  type TemplateKind,
  type TemplatePreview,
} from '../../../../api/aiIntelligence/templates';
import { useConsoleNav } from '../../consoleNav';
import './prompts.css';

/**
 * The template editor — one form, used by both the Add and the Edit page.
 * Ported from G2G's app/ai/_components/TemplateForm.tsx.
 *
 * WHY THE TOOLBAR HAS NO BOLD, FONT OR COLOUR BUTTONS
 *
 * This produces the text of a prompt that gets sent to a model, not a document that
 * gets printed. Bold in a document is `<b>`; `<b>` here is two tokens of markup the
 * model reads as content — formatting controls would not make the prompt prettier,
 * they would make the answers worse. So the strip keeps only the controls that do
 * apply: the category, status and format selectors, the variable picker, and Preview.
 *
 * WHY THE PROMPT IS TWO FIELDS
 *
 * A prompt has a standing instruction (who the model is, what it must never do) and a
 * per-request ask. They are stored separately and sent to the model in different
 * roles, so a single box would have to be split again on save by guessing where one
 * ends. Both live inside the one content block, under the one toolbar, so the screen
 * still reads as a single "content" section.
 *
 * PROMPTS ONLY
 *
 * LMS K-12's version of this editor also authors report layouts, with an HTML editor
 * and a data-source picker bound to its read-only MCP tools. HP Brain has no such tool
 * registry, so that half is deliberately absent rather than present-and-broken — a
 * data-source dropdown with nothing in it cannot produce a working report. The kind
 * selector is gone with it: a form that offers one choice is not a choice.
 *
 * NO FIELD ASSISTANT
 *
 * G2G offers a sparkle "improve this field" helper that calls one of its own Next
 * API routes. HP Brain has no such endpoint, so it is left out rather than shown
 * as a button that can only fail.
 */

export interface TemplateFormState {
  name: string;
  description: string;
  template_key: string;
  module_key: string;
  kind: TemplateKind;
  category: string;
  status: string;
  system_prompt: string;
  user_prompt: string;
  output_format: string;
  safety_rules: string[];
  allow_as_evidence: boolean;
  requires_review: boolean;
  offer_in_module: boolean;
  suggestion_label: string;
  requires_entity: boolean;
  new_version: boolean;
  /**
   * Stored columns this form does not show, sent back unchanged on save. The API
   * writes every column on update, so leaving them out of the payload would null
   * the variables, model settings and report layout of any template edited here —
   * and turn a report row into a prompt row. (G2G's form has the same gap.)
   */
  preserved: Partial<AiTemplatePayload>;
}

export function blankForm(moduleKey: string): TemplateFormState {
  return {
    name: '',
    description: '',
    template_key: '',
    // A new template lands in the module the administrator was looking at. Defaulting
    // to shared instead would file most templates where they are hardest to find.
    module_key: moduleKey || SHARED_MODULE_KEY,
    kind: 'prompt',
    category: '',
    status: 'draft',
    system_prompt: '',
    user_prompt: '',
    output_format: 'text',
    safety_rules: [],
    allow_as_evidence: false,
    requires_review: false,
    offer_in_module: true,
    suggestion_label: '',
    requires_entity: false,
    new_version: false,
    preserved: {},
  };
}

export function formFromRow(row: AiTemplateRow): TemplateFormState {
  return {
    name: row.name,
    description: row.description ?? '',
    template_key: row.template_key,
    module_key: row.module_key,
    kind: row.kind ?? 'prompt',
    category: row.category ?? '',
    status: row.status,
    system_prompt: row.system_prompt ?? '',
    user_prompt: row.user_prompt,
    output_format: row.output_format,
    safety_rules: Array.isArray(row.safety_rules) ? row.safety_rules : [],
    allow_as_evidence: row.allow_as_evidence,
    requires_review: row.requires_review,
    offer_in_module: row.offered_in_module,
    suggestion_label: row.offer_label ?? '',
    // Read from the binding, not assumed. Hardcoding false here meant every edit
    // wrote it back as false, so correcting a typo in a label silently turned a
    // record-scoped suggestion into one that shows on every screen.
    requires_entity: row.offer_requires_entity ?? false,
    new_version: false,
    preserved: {
      variables: row.variables,
      output_schema: row.output_schema,
      provider: row.provider,
      model: row.model,
      temperature: row.temperature,
      max_tokens: row.max_tokens,
      html_layout: row.html_layout,
      data_source: row.data_source,
      data_arguments: row.data_arguments,
    },
  };
}

/* ---- Save result carried back to the listing ----------------------------------- */

/**
 * The sentence a save leaves for the listing.
 *
 * G2G's form navigates straight back to the listing after a save, which loses what
 * the save actually did — and for a platform row or a new version that is not the
 * same as "saved". HP Brain has no router state to carry it, so it is held here until
 * the listing reads it on mount, announces it, and clears it.
 */
let pendingNotice: string | null = null;

/**
 * Peek and clear are separate so a StrictMode double-run of a state initialiser
 * cannot read the notice once and then find it gone the second time.
 */
export function peekTemplateNotice(): string | null {
  return pendingNotice;
}

export function clearTemplateNotice(): void {
  pendingNotice = null;
}

function describeSaveAction(action: string | null): string {
  switch (action) {
    case 'overridden':
      return 'Saved as this organisation’s own copy. It takes precedence here and leaves the platform template untouched.';
    case 'versioned':
      return 'Published as a new version. The previous text is kept as an archived version.';
    case 'updated':
      return 'Template updated.';
    default:
      return 'Template saved.';
  }
}

/** The first message for each field the server rejected. */
function firstFieldErrors(cause: unknown): Record<string, string> {
  if (!(cause instanceof AiApiError)) return {};
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(cause.fieldErrors ?? {})) {
    if (Array.isArray(messages) && messages[0]) out[key] = messages[0];
  }
  return out;
}

export function TemplateForm({
  options,
  initial,
  templateId,
  editableInPlace = true,
  isPlatform = false,
  returnTo,
}: {
  options: AiTemplateOptions | null;
  initial: TemplateFormState;
  /** Null on the Add page; the row's id on the Edit page. */
  templateId: string | null;
  editableInPlace?: boolean;
  isPlatform?: boolean;
  /** Where Cancel and a successful Save go back to (a console route). */
  returnTo: string;
}) {
  const { go } = useConsoleNav();

  const [form, setForm] = useState<TemplateFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const systemRef = useRef<HTMLTextAreaElement>(null);
  const userRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Which box the variable picker inserts into.
   *
   * Tracked on focus rather than read from `document.activeElement`, because opening
   * the picker moves focus to the picker — by the time the change event fires, the
   * textarea the administrator was typing in is no longer the active element.
   */
  const lastFocused = useRef<'system' | 'user'>('user');

  const patch = (changes: Partial<TemplateFormState>) =>
    setForm((current) => ({ ...current, ...changes }));

  const insertVariable = (key: string) => {
    if (!key) return;

    const target = lastFocused.current === 'system' ? systemRef.current : userRef.current;
    const token = `{{${key}}}`;
    const field = lastFocused.current === 'system' ? 'system_prompt' : 'user_prompt';

    if (!target) {
      patch({ [field]: `${form[field]}${token}` } as Partial<TemplateFormState>);
      return;
    }

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);

    patch({ [field]: next } as Partial<TemplateFormState>);

    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError('');

    try {
      setPreview(
        await previewTemplate({
          system_prompt: form.system_prompt || null,
          user_prompt: form.user_prompt,
          module_key: form.module_key,
        }),
      );
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});

    const payload = {
      ...form.preserved,
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_key: form.template_key.trim() || null,
      module_key: form.module_key,
      kind: form.kind,
      category: form.category.trim() || null,
      status: form.status,
      system_prompt: form.system_prompt.trim() || null,
      user_prompt: form.user_prompt,
      output_format: form.output_format,
      safety_rules: form.safety_rules.filter((rule) => rule.trim() !== ''),
      allow_as_evidence: form.allow_as_evidence,
      requires_review: form.requires_review,
      offer_in_module: form.offer_in_module,
      suggestion_label: form.suggestion_label.trim() || null,
      requires_entity: form.requires_entity,
    };

    try {
      if (templateId === null) {
        await createTemplate(payload);
        pendingNotice = describeSaveAction(null);
      } else {
        const result = await updateTemplate(templateId, { ...payload, new_version: form.new_version });
        pendingNotice = describeSaveAction(result?.action ?? 'updated');
      }

      go(returnTo);
    } catch (cause) {
      // The reason a save was refused is usually in a field error — "a published
      // template must include at least one data variable…" — so it is shown both
      // at the top and against the field it belongs to.
      setError(describeAiError(cause));
      setFieldErrors(firstFieldErrors(cause));
      setSaving(false);
    }
  };

  const groundingUsed = useMemo(() => {
    const both = `${form.system_prompt} ${form.user_prompt}`;

    return (options?.grounding_variables ?? []).filter((key) => both.includes(`{{${key}}}`));
  }, [form.system_prompt, form.user_prompt, options]);

  const sharedModule = form.module_key === SHARED_MODULE_KEY;
  const promptError = fieldErrors.user_prompt || fieldErrors.system_prompt;

  return (
    <form onSubmit={submit} className="aii-form">
      <div aria-live="polite" aria-atomic="true">
        {error && <Alert tone="danger" title="The template was not saved">{error}</Alert>}
      </div>

      {isPlatform && (
        <Alert tone="info">
          This is a platform template every organisation on this platform uses. Saving writes a copy owned by
          this organisation, which takes precedence here and leaves the shared one untouched.
        </Alert>
      )}

      {/* The two identifying fields, side by side, exactly as the ERP template editor
          places Module Name and Template Title. */}
      <div className="aii-form-grid">
        <Field label="Module Name" required error={fieldErrors.module_key}>
          <Select value={form.module_key} onChange={(event) => patch({ module_key: event.target.value })}>
            {(options?.modules ?? []).map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Template Title" required error={fieldErrors.name}>
          <TextInput
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
            placeholder="Open signal summary"
          />
        </Field>
      </div>

      <Field label="What it is for" error={fieldErrors.description}>
        <TextInput
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="A short summary of the open signals for a department or the whole organisation."
        />
      </Field>

      {/* The content block: label, then a bordered box whose first row is the
          toolbar. Same anatomy as the HTML editor on the ERP template screen, so an
          administrator who already maintains those does not learn a second layout. */}
      <div role="group" aria-labelledby="tpl-content-label">
        <div className="aii-row aii-row--between">
          <span id="tpl-content-label" className="u-label u-label-required">Prompt Content</span>
          <Sparkles size={16} className="tpl-sparkle" aria-hidden="true" />
        </div>

        <div className={`tpl-editor${promptError ? ' tpl-editor--invalid' : ''}`}>
          <div className="tpl-toolbar">
            <Select
              aria-label="Category"
              value={form.category}
              onChange={(event) => patch({ category: event.target.value })}
            >
              <option value="">Category</option>
              {(options?.categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Status"
              value={form.status}
              onChange={(event) => patch({ status: event.target.value })}
            >
              {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Output format"
              value={form.output_format}
              onChange={(event) => patch({ output_format: event.target.value })}
            >
              {(options?.output_formats ?? ['text', 'markdown', 'json']).map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </Select>

            <span className="tpl-toolbar-divider" aria-hidden="true" />

            <Select
              aria-label="Insert template variable"
              className="tpl-variable-picker"
              defaultValue=""
              onChange={(event) => {
                insertVariable(event.target.value);
                event.target.value = '';
              }}
            >
              <option value="">Insert template variable...</option>
              {(options?.variables ?? []).map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.key} - {variable.label}
                </option>
              ))}
            </Select>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => void runPreview()}
              disabled={previewing || form.user_prompt.trim() === ''}
              icon={previewing
                ? <Loader2 size={14} className="aii-spin" aria-hidden="true" />
                : <Eye size={14} aria-hidden="true" />}
            >
              Preview
            </Button>
          </div>

          <div className="tpl-editor-body">
            <div className="tpl-editor-pane">
              <label htmlFor="tpl-system-prompt" className="tpl-eyebrow">System instruction</label>
              <textarea
                id="tpl-system-prompt"
                ref={systemRef}
                className="tpl-prompt-input"
                value={form.system_prompt}
                onFocus={() => {
                  lastFocused.current = 'system';
                }}
                onChange={(event) => patch({ system_prompt: event.target.value })}
                rows={5}
                aria-invalid={fieldErrors.system_prompt ? true : undefined}
                placeholder="You summarise signal and evidence data for organisation leaders. Work only from the data given below…"
              />
            </div>

            <div className="tpl-editor-pane">
              <label htmlFor="tpl-user-prompt" className="tpl-eyebrow">User prompt</label>
              <textarea
                id="tpl-user-prompt"
                ref={userRef}
                className="tpl-prompt-input"
                value={form.user_prompt}
                onFocus={() => {
                  lastFocused.current = 'user';
                }}
                onChange={(event) => patch({ user_prompt: event.target.value })}
                rows={12}
                required
                aria-required="true"
                aria-invalid={fieldErrors.user_prompt ? true : undefined}
                aria-describedby="tpl-grounding-help"
                placeholder={'Summarise the open signals on this page.\n\nPage: {{page_title}}\nRows:\n{{records}}'}
              />
            </div>
          </div>
        </div>

        {promptError && (
          <p className="u-error tpl-field-error" role="alert">{promptError}</p>
        )}

        <p id="tpl-grounding-help" className="tpl-help">
          Placeholders such as <code className="aii-mono">{'{{records}}'}</code> are filled in by the
          system when the template runs. A published template must use at least one of the data
          variables — {(options?.grounding_variables ?? []).map((key) => `{{${key}}}`).join(' or ')} —
          or the model has nothing to work from and answers from general knowledge.{' '}
          {groundingUsed.length > 0 ? (
            <span className="tpl-ok">Using {groundingUsed.map((key) => `{{${key}}}`).join(', ')}.</span>
          ) : (
            <span className="tpl-warn">None used yet.</span>
          )}
        </p>
      </div>

      <details className="tpl-details">
        <summary>Publishing, safety and where it appears</summary>

        <div className="tpl-details-body">
          <Field
            label="Template key"
            error={fieldErrors.template_key}
            help="The stable identifier the runtime and the audit trail use. Changing it on an existing template moves what the module offers."
          >
            <TextInput
              className="aii-mono"
              value={form.template_key}
              onChange={(event) => patch({ template_key: event.target.value })}
              placeholder="Left blank, one is generated from the module and title"
            />
          </Field>

          <div>
            <div className="aii-row aii-row--between">
              <div>
                <h3 className="tpl-subhead">Safety rules</h3>
                <p className="aii-card-sub">
                  Things the model must never do — checked against the output, not only asked for.
                </p>
              </div>
              <Button size="sm" onClick={() => patch({ safety_rules: [...form.safety_rules, ''] })}>
                Add rule
              </Button>
            </div>

            <div className="tpl-rules">
              {form.safety_rules.length === 0 && (
                <p className="tpl-dashed">
                  No rules yet. &ldquo;Do not invent a name, amount or date&rdquo; is the one almost
                  every template wants.
                </p>
              )}

              {form.safety_rules.map((rule, position) => (
                <div key={position} className="tpl-rule-row">
                  <TextInput
                    aria-label={`Safety rule ${position + 1}`}
                    value={rule}
                    onChange={(event) => {
                      const next = [...form.safety_rules];
                      next[position] = event.target.value;
                      patch({ safety_rules: next });
                    }}
                    placeholder="Do not invent a rating, an employee name or a date."
                  />
                  <IconButton
                    label={`Remove safety rule ${position + 1}`}
                    onClick={() =>
                      patch({ safety_rules: form.safety_rules.filter((_, index) => index !== position) })
                    }
                  >
                    <X size={14} aria-hidden="true" />
                  </IconButton>
                </div>
              ))}
              {fieldErrors.safety_rules && <p className="u-error" role="alert">{fieldErrors.safety_rules}</p>}
            </div>
          </div>

          <div>
            <h3 className="tpl-subhead">Where it appears</h3>
            <p className="aii-card-sub">
              A published template bound to a module is offered by that module&rsquo;s AI panel. Turn
              this off to keep it stored centrally without putting it in front of users.
            </p>

            <div className="tpl-gap-top">
              <Checkbox
                checked={form.offer_in_module}
                disabled={sharedModule}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
                label="Offer this in the module’s AI panel"
              />
            </div>

            {sharedModule && (
              <p className="aii-card-sub">
                Shared templates are resolved from the page type rather than offered as a button, so
                there is no single module to offer them in.
              </p>
            )}

            {form.offer_in_module && !sharedModule && (
              <div className="aii-form-grid tpl-gap-top">
                <Field
                  label="Button label"
                  help="Defaults to the template title."
                  error={fieldErrors.suggestion_label}
                >
                  <TextInput
                    value={form.suggestion_label}
                    onChange={(event) => patch({ suggestion_label: event.target.value })}
                    placeholder={form.name || 'Summarise open signals'}
                  />
                </Field>

                <div className="tpl-check-card">
                  <Checkbox
                    checked={form.requires_entity}
                    onChange={(event) => patch({ requires_entity: event.target.checked })}
                    label={
                      <>
                        Only when a record is selected
                        <span className="tpl-check-hint">
                          For templates about one person, department or signal rather than the list.
                        </span>
                      </>
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="aii-form-grid">
            <div className="tpl-check-card">
              <Checkbox
                checked={form.requires_review}
                onChange={(event) => patch({ requires_review: event.target.checked })}
                label={
                  <>
                    Requires human review
                    <span className="tpl-check-hint">Output is held for a person to approve before it is used.</span>
                  </>
                }
              />
            </div>

            <div className="tpl-check-card">
              <Checkbox
                checked={form.allow_as_evidence}
                onChange={(event) => patch({ allow_as_evidence: event.target.checked })}
                label={
                  <>
                    May be used as evidence
                    <span className="tpl-check-hint">
                      Output can be cited in a case. Leave off unless the template is verifiable.
                    </span>
                  </>
                }
              />
            </div>
          </div>

          {templateId !== null && editableInPlace && form.status === 'published' && (
            <div className="tpl-check-card">
              <Checkbox
                checked={form.new_version}
                onChange={(event) => patch({ new_version: event.target.checked })}
                label={
                  <>
                    Publish as a new version
                    <span className="tpl-check-hint">
                      Keeps the current text as an archived version, so a change that reads worse can be
                      rolled back by republishing it.
                    </span>
                  </>
                }
              />
            </div>
          )}
        </div>
      </details>

      <div className="aii-row">
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
        <Button onClick={() => go(returnTo)} disabled={saving}>
          Cancel
        </Button>
      </div>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="What the model receives, with sample data"
        size="lg"
        footer={<Button onClick={() => setPreview(null)}>Close</Button>}
      >
        {preview && (
          <div className="aii-stack">
            {preview.unresolved.length > 0 && (
              <Alert tone="warning">
                Nothing fills {preview.unresolved.map((key) => `{{${key}}}`).join(', ')} — the model
                receives that text literally.
              </Alert>
            )}

            {preview.system && (
              <div>
                <h3 className="tpl-eyebrow">System instruction</h3>
                <pre className="aii-pre aii-muted">{preview.system}</pre>
              </div>
            )}

            <div>
              <h3 className="tpl-eyebrow">User prompt</h3>
              <pre className="aii-pre">{preview.user}</pre>
            </div>
          </div>
        )}
      </Modal>
    </form>
  );
}

/**
 * Shared page frame for the Add, View and Edit screens.
 *
 * Kept here rather than repeated three times for the same reason `CapabilityShell`
 * exists: three copies of a header is three chances for one to drift, and the first
 * one that does is the one nobody notices.
 */
export function TemplatePageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="aii-page">
      <header className="aii-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="aii-title">{title}</h1>
          <p className="aii-lead">{subtitle}</p>
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

/** The load/error states every one of the three pages needs. */
export function TemplatePageState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="aii-card tpl-loading-card">
        <Loader2 size={24} className="aii-spin" aria-hidden="true" />
        <span className="u-sr-only" role="status">Loading template</span>
      </div>
    );
  }

  return <Alert tone="danger">{error}</Alert>;
}

/** Loads the option lists every page needs, with its own loading and error state. */
export function useTemplateOptions() {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [error, setError] = useState('');

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

  return { options, optionsError: error };
}

/** A template's status, named in words as well as tone. */
export function TemplateStatus({ status }: { status: string }) {
  const tone = status === 'published' ? 'success' : status === 'draft' ? 'warning' : 'neutral';
  return (
    <StatusBadge tone={tone}>
      <span className="tpl-capitalize">{status}</span>
    </StatusBadge>
  );
}

/** Marks a shared platform row. Editing it saves this organisation its own copy. */
export function PlatformBadge() {
  const title = 'A platform template shared by every organisation. Editing it saves this organisation its own copy.';
  return (
    <span className="tpl-platform" title={title}>
      <Lock size={10} aria-hidden="true" />
      Platform
    </span>
  );
}
