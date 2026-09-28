/**
 * AI Stack → Templates, for any module. Ported from G2G's components/ai-stack/templates-screen.tsx.
 *
 * The module's own report layouts, and the place a report is actually built from one.
 * Decentralised in the sense that matters to the person using it — it lives in the module,
 * it only ever shows that module's templates, and creating one here cannot file it against
 * another module — while still being the same concept, the same store and the same API as
 * the central screen under AI & Intelligence. There is no second template system: a
 * template written here is an `ai_templates` row carrying this module's key, which is
 * exactly what the central screen would have written and exactly what the report generator
 * already resolves.
 *
 * A LAYOUT IS NOT A PROMPT, AND THAT IS THE POINT
 *
 * Every placeholder in a layout is filled by substitution from rows the bound read tool
 * returned. No model sees the figures. The data source list is filtered to this module's
 * tools and the backend only ever offers tools annotated `read_only`, so a layout cannot
 * be bound to something that changes a record.
 *
 * WHICH LAYOUT THE MODULE ACTUALLY RENDERS WITH
 *
 * The backend's report template resolver picks ONE layout per module — this
 * organisation's own row first, then the highest version — so with more than one published
 * layout, only one of them is what "Build report" produces. That is not obvious from a list
 * of equals, so the table below marks it.
 *
 * WHY PREVIEW, PRINT AND REFRESH ARE NOT ON THIS LIST
 *
 * They belong to a built report, not to a layout. Everything a person does with a built
 * report — previewing it, editing the text, refreshing the figures against the live
 * records, printing it — lives in the saved-report viewer (./report-viewer.tsx). G2G
 * links to that page at `/ai/reports/{id}`; HP Brain has no router and a module's AI Stack
 * never navigates away, so the viewer opens inside this tab instead and "Back to
 * templates" returns here.
 *
 * WHO A TEMPLATE SAVED HERE SERVES
 *
 * G2G saves every layout from this screen as a platform row, the baseline every
 * organisation resolves. HP Brain allows platform rows to be written only by the super
 * administrator (role `admin`) — a tenant administrator writing one would be changing
 * other organisations' reports. So a super administrator's save here is shared, as in
 * G2G, and a tenant administrator's is this organisation's own; the banner says which
 * applies rather than leaving it to be discovered.
 *
 * HP BRAIN PORT: ids are UUID strings; a platform row is recognised with
 * `isPlatformTemplate` (G2G tested `sub_institute_id === null`); the report is built by
 * naming the module key (`module`) where G2G named its route; retiring asks through
 * ConfirmationDialog instead of `window.confirm`; G2G's AiFieldAssistant is omitted.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Check, Eye, FileText, Loader2, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react';

import { Button, ConfirmationDialog, Field, IconButton, Select, TextInput } from '../../ui';
import { TemplateHtmlEditor } from './adapters/template-html-editor';
import {
  createTemplate,
  fetchTemplateOptions,
  fetchTemplates,
  isPlatformTemplate,
  retireTemplate,
  updateTemplate,
  type AiTemplateOptions,
  type AiTemplateRow,
} from '../../api/aiIntelligence/templates';
import { describeAiError } from '../../api/aiIntelligence/client';
import { generateReportForContext, type WorkspaceReport } from '../../api/aiStack/workspace';
import { logModuleOperation, readModuleWorkspaceSession, refreshModuleAiStack } from './module-ai-stack';
import { AiStackReportViewer } from './report-viewer';
import { useAiStackProfile } from './profile-context';
import type { ModuleProfile, ModuleProfileArgument } from '../../api/aiStack/profile';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackNotice,
  AiStackPill,
  AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';
import './aiStackScreens-a.css';
import { getAuthRole } from '../../utils/tenant';

interface FormState {
  id: string | null;
  name: string;
  description: string;
  data_source: string;
  html_layout: string;
  status: string;
  version: number;
  offer_in_module: boolean;
}

function blankForm(module: AiStackModule, defaultSource: string): FormState {
  return {
    id: null,
    name: `${module.label} report`,
    description: `The ${module.records} on file for this organisation.`,
    data_source: defaultSource,
    // Deliberately empty rather than a starter table of invented columns. The published
    // platform layout for this module is already a working example, and it is one row down
    // the table with an Edit button on it — offering a second, guessed-at one here is how a
    // layout ends up naming a field the tool does not return.
    html_layout: '',
    status: 'draft',
    version: 1,
    offer_in_module: true,
  };
}

function formFrom(row: AiTemplateRow): FormState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    data_source: row.data_source ?? '',
    html_layout: row.html_layout ?? '',
    status: row.status,
    version: row.version,
    offer_in_module: row.offered_in_module,
  };
}

/**
 * The layout a report is actually built with, by the backend's own rule.
 *
 * Mirrors the resolver: published, has a layout, this organisation's own row before the
 * platform baseline, then highest version. Computed rather than guessed so the badge
 * cannot say one thing while the generator does another.
 */
function resolveActiveLayout(rows: AiTemplateRow[]): AiTemplateRow | null {
  const candidates = rows.filter((row) => row.status === 'published' && (row.html_layout ?? '').trim() !== '');

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const ownership = Number(isPlatformTemplate(a)) - Number(isPlatformTemplate(b));
    if (ownership !== 0) return ownership;
    return b.version - a.version;
  })[0];
}

/**
 * The saved report a build produced.
 *
 * `template_id` is the `ai_generated_reports` row id. `template_link` (`/ai/reports/<id>`)
 * is read as a fallback only, for a backend that returns the link without the id — HP Brain
 * never navigates to it.
 */
function builtReportId(report: WorkspaceReport): string | null {
  if (report.template_id) return String(report.template_id);

  const tail = report.template_link?.split('?')[0].split('/').filter(Boolean).pop();

  return tail ? decodeURIComponent(tail) : null;
}

export function AiStackTemplatesScreen({ module }: { module: AiStackModule }) {
  /** Only the super administrator writes platform rows; see the note at the top. */
  const savesShared = getAuthRole() === 'admin';
  const profile = useAiStackProfile();
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [rows, setRows] = useState<AiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState<AiTemplateRow | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);
  const [token, setToken] = useState(0);
  /** The saved report open in the viewer, when one is. */
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

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

    // `latestOnly`: this tab's own view of the list — one row per template key, this
    // organisation's own row shadowing the platform's, highest version only.
    fetchTemplates(module.key, true)
      .then((next) => {
        if (cancelled) return;
        // Report layouts only. A prompt is a different thing managed on the Prompts tab,
        // and mixing the two in one list is how an author edits the wrong one.
        setRows(next.templates.filter((row) => row.kind === 'report'));
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

  /** This module's data sources only — this screen never offers another module's tools. */
  const sources = useMemo(
    () => (options?.data_sources ?? []).filter((source) => source.module === module.key),
    [options, module.key],
  );

  const activeLayout = useMemo(() => resolveActiveLayout(rows), [rows]);

  const branding = options?.branding;
  const heading = branding?.institute_name ?? module.label;

  const patch = (changes: Partial<FormState>) =>
    setForm((current) => (current ? { ...current, ...changes } : current));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      module_key: module.key,
      kind: 'report' as const,
      html_layout: form.html_layout,
      data_source: form.data_source,
      status: form.status,
      user_prompt: '',
      offer_in_module: form.offer_in_module,
      // Platform-wide only for the super administrator — see the note at the top.
      shared: savesShared,
    };

    try {
      if (form.id === null) {
        await createTemplate(payload);
        setNotice(`${module.label} template saved.`);
      } else {
        await updateTemplate(form.id, payload);
        setNotice(`${module.label} template updated.`);
      }

      setForm(null);
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
      setNotice('Template retired.');
      refreshModuleAiStack(module.key);
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetireBusy(false);
      setRetiring(null);
    }
  };

  const openReport = (reportId: string) => {
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    setOpenReportId(reportId);
  };

  const closeReport = () => {
    setOpenReportId(null);
    // Back where the person was — the button that opened the report.
    window.requestAnimationFrame(() => returnFocusTo.current?.focus?.());
  };

  const layoutLabelId = `${module.key}-template-layout-label`;

  return (
    <>
      {openReportId !== null && <AiStackReportViewer key={openReportId} id={openReportId} onClose={closeReport} />}

      {/* Kept mounted while a report is open, so the build filters, the report just built
          and any half-written template are all still there on the way back. */}
      <section className="ais-a-section" hidden={openReportId !== null}>
        {/* Letterhead. Name and logo are the organisation's own, read from its own
            records — this component contains neither. */}
        <AiStackHeader
          icon={FileText}
          title={heading}
          summary={`${module.label} template management — the report designs this module fills from the ${module.records}.`}
          loading={loading}
          onRefresh={reload}
          actions={
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => {
                setForm(blankForm(module, sources[0]?.name ?? profile.data_sources[0]?.name ?? ''));
                setNotice('');
              }}
            >
              New template
            </Button>
          }
        />

        <AiStackHint>
          {savesShared ? (
            <>Templates saved here are available to <strong>every organisation</strong> that opens the {module.label} module, not just this one.</>
          ) : (
            <>Templates saved here belong to <strong>this organisation</strong> and are used for its {module.label} reports.</>
          )}{' '}
          Only one published layout is the one a report is built with — the table marks it.
        </AiStackHint>

        <div aria-live="polite" className="ais-a-live">
          {notice && <AiStackNotice>{notice}</AiStackNotice>}
        </div>
        {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

        <BuildReportPanel module={module} activeLayout={activeLayout} profile={profile} onError={setError} onOpen={openReport} />

        <AiStackCard className="ais-a-card-clip">
          <div className="ais-table-wrap">
            <table className="ais-table ais-a-table--56">
              <AiStackTableHead
                columns={['Template', 'Data source', 'Version', 'Status', `In ${module.label}`, 'Updated', 'Actions']}
              />
              <tbody>
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="ais-a-cell-empty">
                      <Loader2 size={16} className="ais-spin" aria-hidden="true" />
                      Loading {module.label} templates…
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="ais-a-cell-empty">
                      No {module.label} templates yet. Until one is published, a report is built as a plain table of
                      whatever <span className="ais-a-mono">{profile.data_sources[0]?.name ?? 'the module’s data source'}</span> returns.
                    </td>
                  </tr>
                )}

                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="ais-a-cell-title">
                        <FileText size={16} className="ais-a-icon-muted" aria-hidden="true" />
                        {row.name}
                        {activeLayout?.id === row.id && <AiStackPill tone="green">builds reports</AiStackPill>}
                        {row.is_platform && <AiStackPill tone="blue">platform</AiStackPill>}
                      </div>
                      <div className="ais-a-cell-key">{row.template_key}</div>
                      {row.description && <div className="ais-a-cell-desc">{row.description}</div>}
                    </td>
                    <td className="ais-a-nowrap ais-a-cell-xs ais-a-mono">{row.data_source ?? '—'}</td>
                    <td className="ais-a-cell-num">v{row.version}</td>
                    <td>
                      <AiStackPill
                        tone={row.status === 'published' ? 'green' : row.status === 'draft' ? 'amber' : 'gray'}
                      >
                        {row.status}
                      </AiStackPill>
                    </td>
                    <td className="ais-a-cell-xs">
                      {row.offered_in_module ? (
                        <span className="ais-a-offered">
                          <Check size={14} aria-hidden="true" />
                          Offered
                        </span>
                      ) : (
                        <span>Not offered</span>
                      )}
                    </td>
                    <td className="ais-a-nowrap ais-a-cell-xs">{formatWhen(row.updated_at)}</td>
                    <td>
                      <div className="ais-a-actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Pencil size={14} aria-hidden="true" />}
                          onClick={() => {
                            setForm(formFrom(row));
                            setNotice('');
                          }}
                          aria-label={`Edit ${row.name}`}
                        >
                          Edit
                        </Button>
                        {row.status !== 'archived' && (
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

        {form && (
          <form onSubmit={submit} className="ais-a-panel" aria-labelledby={`${module.key}-template-form-title`}>
            <div className="ais-a-panel-head">
              <h3 id={`${module.key}-template-form-title`} className="ais-a-panel-title">
                {form.id === null ? `New ${module.label} template` : `Edit ${module.label} template`}
              </h3>
              <IconButton label="Close" size="sm" onClick={() => setForm(null)}>
                <X size={16} aria-hidden="true" />
              </IconButton>
            </div>

            <div className="ais-a-grid-2">
              {/* Fixed, and shown rather than hidden: this screen exists to manage this
                  module's templates, and a module selector would offer one option. */}
              <Field label="Module Name" required>
                <TextInput value={module.label} readOnly className="ais-a-readonly" />
              </Field>

              <Field label="Template Title" required>
                <TextInput value={form.name} onChange={(event) => patch({ name: event.target.value })} required />
              </Field>
            </div>

            <Field label="What it is for">
              <TextInput
                id={`${module.key}-template-description`}
                value={form.description}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>

            <div className="ais-a-grid-2">
              <Field
                label={`${module.label} data source`}
                required
                help={
                  sources.find((source) => source.name === form.data_source)?.description ??
                  `Where the live ${module.records} come from. Read-only tools only.`
                }
              >
                <Select
                  value={form.data_source}
                  onChange={(event) => patch({ data_source: event.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {sources.map((source) => (
                    <option key={source.name} value={source.name}>
                      {source.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Status"
                help="Only a published template is used. With more than one published, the highest version builds reports."
              >
                <Select value={form.status} onChange={(event) => patch({ status: event.target.value })}>
                  {(options?.statuses ?? ['draft', 'published', 'archived']).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div role="group" aria-labelledby={layoutLabelId}>
              <span id={layoutLabelId} className="u-label u-label-required">
                Report layout
              </span>
              <TemplateHtmlEditor
                value={form.html_layout}
                onChange={(html) => patch({ html_layout: html })}
                tags={(options?.report_placeholders ?? []).map((placeholder) => ({
                  key: placeholder.key,
                  label: placeholder.label,
                }))}
              />
            </div>

            <label className="ais-a-toggle ais-a-toggle--plain">
              <input
                type="checkbox"
                checked={form.offer_in_module}
                onChange={(event) => patch({ offer_in_module: event.target.checked })}
              />
              Offer this template in the {module.label} AI panel
            </label>

            <div className="ais-a-actions ais-a-actions--top">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                icon={saving ? undefined : <Save size={16} aria-hidden="true" />}
              >
                Save
              </Button>
              <Button variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        <ConfirmationDialog
          open={retiring !== null}
          onCancel={() => setRetiring(null)}
          onConfirm={() => void retire()}
          title={retiring ? `Retire "${retiring.name}"?` : 'Retire template?'}
          description={`The ${module.label} module will stop offering it.`}
          confirmLabel="Retire"
          destructive
          loading={retireBusy}
        />
      </section>
    </>
  );
}

/**
 * Build a report from the live records, and hand over the saved report that previews,
 * edits, refreshes and prints it.
 *
 * THE FILTERS ARE READ FROM THE LOADED PROFILE, NOT FROM A DESCRIPTOR
 *
 * `profile.data_sources[].arguments` is the bound read tool's own schema, as the
 * backend's `ModuleDataSourceCatalog` declares it right now — never a shape typed into
 * this file, which could silently drift from what the tool actually accepts. They
 * narrow what the organisation itself can already see: the organisation comes from the
 * bearer token on the backend and is not a parameter this form could widen even if it
 * tried.
 */
function BuildReportPanel({
  module,
  activeLayout,
  profile,
  onError,
  onOpen,
}: {
  module: AiStackModule;
  activeLayout: AiTemplateRow | null;
  profile: ModuleProfile;
  onError: (message: string) => void;
  onOpen: (reportId: string) => void;
}) {
  // The data source a build actually runs, mirroring the backend's own choice: the
  // active layout's source when one is published, else the module's first registered
  // source — never a name typed into a descriptor.
  const sourceName = (activeLayout?.data_source || '').trim() || profile.data_sources[0]?.name || null;
  const source = useMemo(
    () => profile.data_sources.find((candidate) => candidate.name === sourceName) ?? null,
    [profile.data_sources, sourceName],
  );
  const filters = source?.arguments ?? [];

  const [values, setValues] = useState<Record<string, string | boolean>>(() => initialValues(filters));
  const [keepEmpty, setKeepEmpty] = useState(false);
  const [building, setBuilding] = useState(false);
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [emptyNote, setEmptyNote] = useState('');

  // A different published layout can point at a different source key by key — reset the
  // form to that source's own arguments rather than carrying over another source's values.
  useEffect(() => {
    setValues(initialValues(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceName]);

  const build = async () => {
    setBuilding(true);
    setReport(null);
    setReportId(null);
    setEmptyNote('');
    onError('');

    const argumentsGiven: Record<string, unknown> = {};

    for (const argument of filters) {
      const value = values[argument.key];

      if (argument.type === 'boolean') {
        // Always sent, because the published layout's own default is a value and leaving
        // it out would silently mean that default when the operator had changed the box.
        argumentsGiven[argument.key] = value === true;
        continue;
      }

      const text = String(value ?? '').trim();
      if (text === '') continue;

      if (argument.type === 'integer') {
        const parsed = Number(text);
        if (Number.isInteger(parsed)) argumentsGiven[argument.key] = parsed;
        continue;
      }

      argumentsGiven[argument.key] = text;
    }

    try {
      const result = await generateReportForContext(readModuleWorkspaceSession(), {
        module: module.key,
        arguments: argumentsGiven,
        keep_empty: keepEmpty,
      });

      const savedId = builtReportId(result);

      // No saved id means the backend chose not to save one — exactly the case where the
      // source returned no rows and "keep empty result" was not asked for. An empty
      // result is an answer, not a document, said plainly rather than opened as a blank
      // report.
      if (!savedId) {
        setEmptyNote(module.report.emptyNote);
        return;
      }

      setReport(result);
      setReportId(savedId);
      logModuleOperation(module, module.report.operation, {
        message: `Built "${result.title}" from ${result.row_count} ${module.record} record(s).`,
        reference: result.title,
        tool: result.source_tool,
        // The layout the server actually rendered, rather than a guess from names.
        templateId: result.layout_template_id,
        result: {
          row_count: result.row_count,
          layout: result.layout_name,
          filters: argumentsGiven,
          keep_empty: keepEmpty,
        },
      });
    } catch (cause) {
      const message = describeAiError(cause, 'The report could not be built.');
      onError(message);
      // Recorded as a failure rather than swallowed: a build that was refused is a thing
      // the Activity tab should show, and it is the only place the reason survives.
      logModuleOperation(module, module.report.operation, { status: 'failed', message });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <AiStackCard>
      <AiStackCardHeading
        title="Build a report"
        hint={
          activeLayout
            ? `Filled from the live ${module.records} using the "${activeLayout.name}" layout.`
            : 'No published layout yet — publish one above and this builds the plain table instead.'
        }
      />

      {filters.length > 0 && (
        <div className="ais-a-build-filters">
          {filters.map((argument) => (
            <ArgumentField
              key={argument.key}
              argument={argument}
              value={values[argument.key]}
              onChange={(next) => setValues((current) => ({ ...current, [argument.key]: next }))}
            />
          ))}
        </div>
      )}

      <label className="ais-a-toggle ais-a-toggle--plain ais-a-build-check">
        <input type="checkbox" checked={keepEmpty} onChange={(event) => setKeepEmpty(event.target.checked)} />
        <span>
          Keep the report even if nothing matches
          <span className="ais-a-toggle-hint">
            Normally a result with no rows is not saved — it is an answer, not a document. Check this to save it
            anyway, reading &quot;No records matched.&quot;
          </span>
        </span>
      </label>

      <div className="ais-a-build-bar">
        <Button
          variant="primary"
          onClick={() => void build()}
          loading={building}
          icon={building ? undefined : <Play size={16} aria-hidden="true" />}
        >
          Build report
        </Button>

        <p className="ais-a-small">The organisation comes from your session, not from this form.</p>
      </div>

      <div aria-live="polite" className="ais-a-live">
        {emptyNote && <p className="ais-a-callout ais-a-callout--warn ais-a-callout-inset">{emptyNote}</p>}

        {report && reportId && (
          <div className="ais-a-callout ais-a-callout--success ais-a-callout-inset">
            <div>
              <p className="ais-a-built-title">{report.title}</p>
              <p className="ais-a-built-meta">
                {report.row_count} row(s) read through <span className="ais-a-mono">{report.source_tool ?? 'the module'}</span>
                {report.layout_name ? ` into the "${report.layout_name}" layout` : ''}.
              </p>
              <div className="ais-a-built-action">
                <Button
                  variant="primary"
                  icon={<Eye size={16} aria-hidden="true" />}
                  onClick={() => onOpen(reportId)}
                >
                  Open to preview, edit or print
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AiStackCard>
  );
}

/** One data-source argument, rendered as the input its declared `type` (and `values`) call for. */
function ArgumentField({
  argument,
  value,
  onChange,
}: {
  argument: ModuleProfileArgument;
  value: string | boolean | undefined;
  onChange: (next: string | boolean) => void;
}) {
  if (argument.type === 'boolean') {
    return (
      <label className="ais-a-toggle ais-a-toggle--plain ais-a-build-check">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        <span>
          {argument.description || argument.key}
        </span>
      </label>
    );
  }

  if (argument.type === 'string' && argument.values && argument.values.length > 0) {
    return (
      <Field key={argument.key} label={argument.description || argument.key}>
        <Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
          <option value="">Any</option>
          {argument.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (argument.type === 'integer') {
    return (
      <Field
        key={argument.key}
        label={argument.description || argument.key}
        help={
          argument.min !== undefined || argument.max !== undefined
            ? `${argument.min ?? 'no minimum'} – ${argument.max ?? 'no maximum'}`
            : undefined
        }
      >
        <TextInput
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          placeholder={argument.default === undefined ? undefined : String(argument.default)}
        />
      </Field>
    );
  }

  return (
    <Field key={argument.key} label={argument.description || argument.key}>
      <TextInput
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        placeholder={argument.default === undefined ? undefined : String(argument.default)}
      />
    </Field>
  );
}

function initialValues(args: ModuleProfileArgument[]): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};

  for (const argument of args) {
    if (argument.type === 'boolean') {
      values[argument.key] = argument.default === true;
    } else {
      values[argument.key] = argument.default === undefined ? '' : String(argument.default);
    }
  }

  return values;
}
