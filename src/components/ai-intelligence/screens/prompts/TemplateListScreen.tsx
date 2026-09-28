import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { Alert, Button, ConfirmationDialog, Field, Select } from '../../../../ui';
import { describeAiError } from '../../../../api/aiIntelligence/client';
import {
  fetchTemplateOptions,
  fetchTemplates,
  isPlatformTemplate,
  retireTemplate,
  type AiTemplateIndex,
  type AiTemplateOptions,
  type AiTemplateRow,
} from '../../../../api/aiIntelligence/templates';
import { CapabilityShell } from '../../CapabilityShell';
import { LoadingLine } from '../../console-ui';
import { useConsoleNav } from '../../consoleNav';
import { clearTemplateNotice, peekTemplateNotice, PlatformBadge, TemplateStatus } from './TemplateForm';
import './prompts.css';

/**
 * Template Management — the listing. Ported from G2G's app/ai/prompts/page.tsx and
 * app/ai/_components/TemplateList.tsx.
 *
 * View and Edit are their own console routes — 'prompts/<id>' and
 * 'prompts/<id>/edit' — rather than panels rendered under the table, so a
 * half-finished edit is not lost the moment the module selector changes.
 *
 * WHY THE ROUTE IS `prompts` AND THE LABEL IS "Template Management"
 *
 * The capability's slug is its identifier, not its label. Renaming the capability is
 * a label change in the registry; renaming the slug would be a route change.
 */
export default function TemplateListScreen({ initialModule }: { initialModule?: string }) {
  return (
    <CapabilityShell slug="prompts">
      <TemplateList initialModule={initialModule ?? ''} />
    </CapabilityShell>
  );
}

/**
 * The Template Management listing — module selector, table, and links out.
 *
 * THE MODULE IS A VALUE, NOT A BRANCH
 *
 * Selecting one module and selecting another run the same fetch with a different
 * `module_key` and render the same table. The module list comes from the server via
 * `/templates/options`, so a module added there appears here with no change to this
 * file.
 *
 * The selected module is kept in state rather than in the route. It is a view
 * preference, not an address — the route only seeds it (from '?module=').
 */
function TemplateList({ initialModule }: { initialModule: string }) {
  const { go } = useConsoleNav();

  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [index, setIndex] = useState<AiTemplateIndex | null>(null);
  const [moduleKey, setModuleKey] = useState(initialModule);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // What the last save did, left by the editor on its way back here.
  const [notice, setNotice] = useState(() => peekTemplateNotice() ?? '');
  const [reloadToken, setReloadToken] = useState(0);
  const [retiring, setRetiring] = useState<AiTemplateRow | null>(null);
  const [retireBusy, setRetireBusy] = useState(false);

  useEffect(() => {
    clearTemplateNotice();
  }, []);

  /**
   * The spinner is raised by whatever asked for the data, not by the effect that
   * fetches it — `react-hooks/set-state-in-effect` objects to the latter, and the
   * initial load needs no raise because `loading` starts true.
   */
  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
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

    fetchTemplates(moduleKey || null)
      .then((next) => {
        if (cancelled) return;
        setIndex(next);
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
  }, [moduleKey, reloadToken]);

  const selectedModule = useMemo(
    () => options?.modules.find((module) => module.key === moduleKey) ?? null,
    [moduleKey, options],
  );
  const selectedLabel = moduleKey ? selectedModule?.label ?? moduleKey : 'All modules';

  const confirmRetire = async () => {
    if (!retiring) return;
    setRetireBusy(true);

    try {
      await retireTemplate(retiring.id);
      setNotice('Template retired.');
      setError('');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRetireBusy(false);
      setRetiring(null);
    }
  };

  const addRoute = moduleKey ? `prompts/new?module=${encodeURIComponent(moduleKey)}` : 'prompts/new';
  const templates = index?.templates ?? [];

  return (
    <section className="aii-stack">
      <header className="aii-row aii-row--between tpl-list-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="aii-card-title tpl-section-title">Template management</h2>
          <p className="aii-card-desc">
            AI templates for every module, written and stored in one place. A published template
            bound to a module is offered by that module&rsquo;s AI panel automatically.
          </p>
        </div>
        <div className="aii-row">
          <Button
            size="sm"
            onClick={reload}
            icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
          >
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => go(addRoute)} icon={<Plus size={14} aria-hidden="true" />}>
            Add template
          </Button>
        </div>
      </header>

      <div className="aii-card">
        <div className="tpl-filter-row">
          <div className="tpl-module-field">
            <Field label="Module">
              <Select
                value={moduleKey}
                onChange={(event) => {
                  setLoading(true);
                  setModuleKey(event.target.value);
                }}
              >
                <option value="">All modules</option>
                {(options?.modules ?? []).map((module) => (
                  <option key={module.key} value={module.key}>
                    {module.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="aii-row">
            <Stat label="Templates" value={index?.counts.total ?? 0} />
            <Stat label="Published" value={index?.counts.published ?? 0} />
            <Stat label="Live in module" value={index?.counts.offered ?? 0} />
          </div>
        </div>

        <p className="aii-card-sub tpl-gap-top">
          {moduleKey
            ? selectedModule?.description ?? `Templates filed under ${selectedLabel}.`
            : 'Every template this organisation can see. Pick a module to narrow the list and to file new templates there.'}
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="aii-table-wrap">
        <table className="aii-table aii-table--wide">
          <caption className="u-sr-only">Templates for {selectedLabel}</caption>
          <thead>
            <tr>
              {['Template', 'Module', 'Status', 'In module', 'Version', 'Actions'].map((heading) => (
                <th key={heading} scope="col">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && templates.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <LoadingLine>Loading templates…</LoadingLine>
                </td>
              </tr>
            )}

            {!loading && templates.length === 0 && (
              <tr>
                <td colSpan={6} className="tpl-empty-cell">
                  No templates for {selectedLabel} yet.{' '}
                  <button type="button" className="aii-link tpl-inline-link" onClick={() => go(addRoute)}>
                    Create the first one.
                  </button>
                </td>
              </tr>
            )}

            {templates.map((row) => {
              const platform = isPlatformTemplate(row);
              return (
                <tr key={row.id}>
                  <td>
                    <div className="aii-row">
                      <button type="button" className="aii-link" onClick={() => go(`prompts/${row.id}`)}>
                        {row.name}
                      </button>
                      {platform && <PlatformBadge />}
                    </div>
                    <div className="aii-row tpl-key-row">
                      <span className="aii-mono aii-muted">{row.template_key}</span>
                      {/* The category the author filed it under, where they set one. It
                          is the only thing on this row that says what the template is
                          FOR rather than where it lives. */}
                      {row.category && (
                        <span className="tpl-category">{row.category.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                  </td>
                  <td className="aii-muted tpl-nowrap">{row.module_label}</td>
                  <td>
                    <TemplateStatus status={row.status} />
                  </td>
                  <td>
                    {row.offered_in_module ? (
                      <span className="tpl-offered">
                        <Check size={14} aria-hidden="true" />
                        Offered
                      </span>
                    ) : (
                      <span className="aii-small aii-muted">Not offered</span>
                    )}
                  </td>
                  <td className="aii-num aii-muted">v{row.version}</td>
                  <td>
                    <div className="aii-row">
                      <Button
                        size="sm"
                        onClick={() => go(`prompts/${row.id}`)}
                        icon={<Eye size={14} aria-hidden="true" />}
                        aria-label={`View ${row.name}`}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => go(`prompts/${row.id}/edit`)}
                        icon={<Pencil size={14} aria-hidden="true" />}
                        aria-label={`${row.editable_in_place ? 'Edit' : 'Customise'} ${row.name}`}
                      >
                        {row.editable_in_place ? 'Edit' : 'Customise'}
                      </Button>
                      {row.editable_in_place && row.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRetiring(row)}
                          icon={<Trash2 size={14} aria-hidden="true" />}
                          aria-label={`Retire ${row.name}`}
                        >
                          Retire
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmationDialog
        open={retiring !== null}
        onCancel={() => setRetiring(null)}
        onConfirm={() => void confirmRetire()}
        title={retiring ? `Retire "${retiring.name}"?` : 'Retire template?'}
        description={retiring ? `It will stop being offered in ${retiring.module_label}.` : undefined}
        confirmLabel="Retire"
        destructive
        loading={retireBusy}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="tpl-stat">
      <strong>{value}</strong> {label}
    </span>
  );
}
