/**
 * AI Stack → Knowledge Base, for any module.
 *
 * The material the AI is allowed to draw on when it answers a question about this module,
 * and proof that each source actually answers.
 *
 * WHAT A "KNOWLEDGE SOURCE" IS HERE
 *
 * Not a folder of uploaded files. For a module it is a read-only data source, because that
 * is what the assistant really reads when somebody asks a question on one of its pages.
 * Those sources already carry the tenant scoping, the joins and the rule that a filter
 * naming something the organisation does not have returns nothing rather than everything —
 * all of which the rest of the platform was built on. `ReportDataSourceCatalog` in Laravel
 * lists them from the registry itself, so the catalogue on this screen is derived, not
 * maintained: register a source in the backend and it appears here with no edit to this
 * file.
 *
 * READ-ONLY BY CONSTRUCTION
 *
 * The backend filters the catalogue on each source's own `read_only` annotation. A
 * knowledge source that changed records when it was read would mean opening a report
 * altered the thing it was reporting on.
 *
 * WHY THERE IS A CHECK BUTTON
 *
 * A source can be registered, bound to a template, and still return nothing for this
 * organisation — nothing recorded yet, a permission the signed-in user lacks. That is
 * invisible on an inventory and obvious the moment you call it. Check runs the real source
 * as the signed-in user and reports what came back. It reads; it writes nothing.
 *
 * HP BRAIN PORT: G2G posts to its Next.js proxy `/api/mcp/tools/call`, which forwards to
 * `POST /api/ai/data-sources/{name}/run`. HP Brain is a Vite SPA with no server routes of
 * its own, so Check calls that backend route directly through the shared AI client
 * (`/ai-intelligence/data-sources/{name}/run`), which attaches the JWT. The body is the
 * proxy's `{ arguments: {} }` — the organisation comes from the token, never the body.
 *
 * NOTHING IS SEEDED INTO THIS TAB. There is no sample document and no fabricated policy.
 * An organisation that has indexed nothing is told exactly that, because a knowledge base
 * padded with invented material is worse than an empty one — it looks authoritative and it
 * is not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, CheckCircle2, Database, FileText, Loader2, PlayCircle, XCircle } from 'lucide-react';

import { fetchCapability, type CapabilityDetail } from '../../api/aiIntelligence/capabilities';
import { aiRequest, describeAiError } from '../../api/aiIntelligence/client';
import {
  fetchTemplateOptions,
  fetchTemplates,
  type AiTemplateOptions,
  type AiTemplateRow,
  type TemplateDataSource,
} from '../../api/aiIntelligence/templates';

import {
  AiStackCard,
  AiStackCardHeading,
  AiStackEmpty,
  AiStackError,
  AiStackHeader,
  AiStackHint,
  AiStackLoading,
  AiStackMetrics,
  AiStackPill,
  AiStackTableHead,
} from './ai-stack-chrome';
import type { AiStackModule } from './ai-stack-module';
import './aiStackScreens-b.css';

/** What one Check produced. Held per source so several can be run independently. */
type CheckResult =
  | { state: 'running' }
  | { state: 'ok'; rows: number | null; detail: string }
  | { state: 'failed'; detail: string };

/**
 * Run one read-only data source as the signed-in user, with no arguments.
 *
 * `module` is posted alongside it so the backend can refuse a source that is not this
 * module's own — `AiStackReportController::runSource` validates it when given, and a
 * module's Knowledge Base must not be able to check another module's source even by
 * naming it directly in this call.
 */
function runDataSource(name: string, moduleKey: string): Promise<Record<string, unknown> | null> {
  return aiRequest<Record<string, unknown> | null>(`/data-sources/${encodeURIComponent(name)}/run`, 'POST', {
    // No arguments, so a source with a required argument reports itself as such rather
    // than being called wrongly. A detail source needs an id and will say so — which is
    // a true and useful thing for this tab to show.
    arguments: {},
    module: moduleKey,
  });
}

export function AiStackKnowledgeBaseScreen({ module }: { module: AiStackModule }) {
  const [options, setOptions] = useState<AiTemplateOptions | null>(null);
  const [templates, setTemplates] = useState<AiTemplateRow[]>([]);
  const [documents, setDocuments] = useState<CapabilityDetail | null>(null);
  /** Non-fatal: the document inventory is admin-only, and the rest of the screen stands without it. */
  const [documentsError, setDocumentsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [token, setToken] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setChecks({});
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchTemplateOptions(), fetchTemplates(module.key, true)])
      .then(([nextOptions, index]) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setTemplates(index.templates);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    // Separate, and allowed to fail on its own: `knowledge-rag` is an administrator read.
    // A non-admin still gets the source catalogue rather than an error page.
    fetchCapability('knowledge-rag')
      .then((detail) => {
        if (!cancelled) setDocuments(detail);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setDocumentsError(describeAiError(cause, 'Document inventory unavailable.'));
      });

    return () => {
      cancelled = true;
    };
  }, [token, module.key]);

  /** This module's sources only. This screen never lists another module's sources. */
  const sources = useMemo<TemplateDataSource[]>(
    () => (options?.data_sources ?? []).filter((source) => source.module === module.key),
    [options, module.key],
  );

  /** Which of this module's templates read each source — the binding, from the rows. */
  const consumers = useMemo(() => {
    const map = new Map<string, AiTemplateRow[]>();

    for (const template of templates) {
      if (!template.data_source) continue;
      const list = map.get(template.data_source) ?? [];
      list.push(template);
      map.set(template.data_source, list);
    }

    return map;
  }, [templates]);

  const boundCount = useMemo(
    () => sources.filter((source) => (consumers.get(source.name) ?? []).length > 0).length,
    [sources, consumers],
  );

  const check = useCallback(async (source: TemplateDataSource) => {
    setChecks((current) => ({ ...current, [source.name]: { state: 'running' } }));

    try {
      const payload = await runDataSource(source.name, module.key);
      const { rows, detail } = summariseMcpPayload(payload);
      setChecks((current) => ({ ...current, [source.name]: { state: 'ok', rows, detail } }));
    } catch (cause) {
      setChecks((current) => ({
        ...current,
        [source.name]: { state: 'failed', detail: describeAiError(cause, 'The call failed.') },
      }));
    }
  }, [module.key]);

  if (loading && !options) {
    return <AiStackLoading label={`Loading ${module.label} knowledge sources…`} />;
  }

  const documentCount = documents?.metrics.find((metric) => metric.key === 'assets')?.value ?? null;
  const evidenceCount = documents?.metrics.find((metric) => metric.key === 'evidence')?.value ?? null;

  return (
    <section className="ais-stack" aria-label={`${module.label} knowledge base`}>
      <AiStackHeader
        icon={BookMarked}
        title={`${module.label} knowledge base`}
        summary={`The ${module.records} and documents the AI may draw on when it answers, and whether each one is actually returning data.`}
        loading={loading}
        onRefresh={reload}
      />

      {error && <AiStackError onRetry={reload}>{error}</AiStackError>}

      <AiStackMetrics
        metrics={[
          { key: 'sources', label: `${module.label} sources`, value: sources.length, hint: 'read-only tools' },
          { key: 'bound', label: 'In use', value: boundCount, hint: `read by a ${module.label} template` },
          {
            key: 'templates',
            label: `${module.label} templates`,
            value: templates.length,
            hint: 'prompts and reports',
          },
          {
            key: 'documents',
            label: 'SOP documents',
            value: documentCount ?? '—',
            hint: documentCount === null ? 'not readable by your role' : 'organisation-wide',
          },
          {
            key: 'evidence',
            label: 'Evidence records',
            value: evidenceCount ?? '—',
            hint: evidenceCount === null ? 'not readable by your role' : 'what claims rested on',
          },
        ]}
      />

      <AiStackHint>
        Every source below is read-only by construction — the backend filters the catalogue on each tool&apos;s own
        annotation, so a tool that changes a {module.record} record cannot appear here or be bound to a template.
      </AiStackHint>

      {sources.length === 0 ? (
        <AiStackEmpty icon={Database} title={`No ${module.label} knowledge sources registered`}>
          The backend reported no read-only {module.label} tools. Until one is registered, {module.label} AI has no{' '}
          {module.records} to ground an answer in.
        </AiStackEmpty>
      ) : (
        <AiStackCard className="ais-b-overflow">
          <AiStackCardHeading
            title={`${module.label} data sources`}
            hint="Each is a governed, read-only tool. Check calls it as you, and writes nothing."
          />
          <div className="ais-table-wrap">
            <table className="ais-table ais-b-minw-60">
              <AiStackTableHead columns={['Source', 'What it returns', 'Arguments', 'Read by', 'Check']} />
              <tbody>
                {sources.map((source) => {
                  const readers = consumers.get(source.name) ?? [];
                  const result = checks[source.name];

                  return (
                    <tr key={source.name}>
                      <td>
                        <div className="ais-mono ais-b-strong">{source.name}</div>
                        <div className="ais-b-xs ais-b-faint">{source.label}</div>
                      </td>
                      <td className="ais-b-cell-max ais-b-xs">{source.description}</td>
                      <td>
                        {source.arguments.length ? (
                          <ul className="ais-b-list-reset ais-b-stack-xs" style={{ gap: 'var(--space-1)' }}>
                            {source.arguments.map((argument) => (
                              <li key={argument.key} className="ais-b-2xs">
                                <span className="ais-mono" style={{ color: 'var(--content-primary)' }}>
                                  {argument.key}
                                </span>{' '}
                                {argument.type}
                                {argument.required ? ' · required' : ''}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ais-b-xs ais-b-faint">none</span>
                        )}
                      </td>
                      <td>
                        {readers.length ? (
                          <ul className="ais-b-list-reset ais-b-stack-xs" style={{ gap: 'var(--space-1)' }}>
                            {readers.map((reader) => (
                              <li key={reader.id} className="ais-row ais-b-xs" style={{ flexWrap: 'nowrap', gap: 'var(--space-1-5)' }}>
                                <FileText size={12} className="ais-b-faint ais-b-shrink0" aria-hidden="true" />
                                <span className="ais-b-truncate">{reader.name}</span>
                                <AiStackPill tone={reader.kind === 'report' ? 'blue' : 'gray'}>{reader.kind}</AiStackPill>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ais-b-xs ais-b-faint">nothing yet</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => void check(source)}
                          disabled={result?.state === 'running'}
                          className="ais-btn ais-btn--sm"
                          aria-label={`Check ${source.name}`}
                        >
                          {result?.state === 'running' ? (
                            <Loader2 size={14} className="ais-spin" aria-hidden="true" />
                          ) : (
                            <PlayCircle size={14} aria-hidden="true" />
                          )}
                          Check
                        </button>

                        <div aria-live="polite">
                          {result?.state === 'ok' && (
                            <p className="ais-b-check ais-b-ok">
                              <CheckCircle2 size={12} aria-hidden="true" />
                              <span>
                                {result.rows === null ? 'Answered' : `${result.rows.toLocaleString('en-IN')} row(s)`}
                                {result.detail ? ` · ${result.detail}` : ''}
                              </span>
                            </p>
                          )}

                          {result?.state === 'failed' && (
                            <p className="ais-b-check ais-b-warn">
                              <XCircle size={12} aria-hidden="true" />
                              <span>{result.detail}</span>
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AiStackCard>
      )}

      <AiStackCard className="ais-b-overflow">
        <AiStackCardHeading
          title="Indexed documents"
          hint="Knowledge assets from hpbrain_knowledge_assets. Held per organisation, not per module — a document indexed here is visible to the whole organisation's AI."
        />

        {documentsError ? (
          <p className="ais-b-card-note">{documentsError}</p>
        ) : !documents ? (
          <p className="ais-b-card-note ais-b-card-note--icon" role="status">
            <Loader2 size={16} className="ais-spin" aria-hidden="true" />
            Loading the document inventory…
          </p>
        ) : documents.table && documents.table.rows.length > 0 ? (
          <div className="ais-table-wrap">
            <table className="ais-table ais-b-minw-40 ais-b-td-tight">
              <AiStackTableHead columns={documents.table.columns.map((column) => column.label)} />
              <tbody>
                {documents.table.rows.map((row, index) => (
                  <tr key={index}>
                    {documents.table!.columns.map((column) => (
                      <td key={column.key} className="ais-b-xs">
                        {row[column.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ais-b-card-note">
            No documents are indexed for this organisation yet. {module.label} answers therefore rest entirely on{' '}
            {module.copy.groundedOn}
          </p>
        )}
      </AiStackCard>
    </section>
  );
}

/**
 * Turn a data-source reply into a row count and a short sentence.
 *
 * `AiStackReportController::runSource` answers with a known shape —
 * `data: { rows, total, returned, truncated, available, reason }` — and this prefers
 * exactly those fields: `total` is the source's real size, `returned` is how many rows
 * this call actually got back (bounded by `limit`), and `truncated` says whether
 * `returned` is less than `total`. Reporting `returned` as though it were the whole
 * count is the fifty-row-page-of-eight-hundred mistake this tab exists to stop.
 *
 * The generic fallback below (guessing from whatever array is longest) only runs for a
 * payload that does not carry that shape — defensive rather than typed, so a reply this
 * function does not recognise reports as answered with no count, never a zero count
 * invented from the wrong key.
 */
function summariseMcpPayload(payload: Record<string, unknown> | null): { rows: number | null; detail: string } {
  if (!payload) return { rows: null, detail: '' };

  const result = payload.result as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;

  const error = payload.error ?? result?.error;
  if (typeof error === 'string' && error.trim()) return { rows: null, detail: error };

  // HP Brain answers a source it cannot read (an unmapped ERP entity, a missing table)
  // with success, `available: false` and a reason. Reporting that as "0 rows" would say
  // the source is healthy and empty, which is the opposite of the truth.
  for (const source of [payload, data, result]) {
    if (source && source.available === false) {
      const reason = typeof source.reason === 'string' && source.reason.trim() ? source.reason : 'This source cannot be read here.';
      return { rows: null, detail: reason };
    }
  }

  // The canonical shape: `total` is the real size, `returned` is what came back, and
  // `truncated` says whether the two differ.
  for (const source of [data, payload, result]) {
    if (source && typeof source.total === 'number') {
      const returned = typeof source.returned === 'number' ? source.returned : null;
      const truncated = source.truncated === true || (returned !== null && returned < source.total);

      return {
        rows: source.total,
        detail: truncated && returned !== null ? `${returned.toLocaleString('en-IN')} shown` : '',
      };
    }
  }

  for (const source of [payload, data, result]) {
    const count = source?.count;
    if (typeof count === 'number') {
      const list = firstList(source);
      return {
        rows: count,
        detail: list && list.length !== count ? `${list.length} shown` : '',
      };
    }
  }

  for (const source of [payload, data, result]) {
    const list = firstList(source);
    if (list) {
      const first = list[0];
      const keys = first && typeof first === 'object' ? Object.keys(first as object).slice(0, 4) : [];
      return { rows: list.length, detail: keys.length ? keys.join(', ') : '' };
    }
  }

  return { rows: null, detail: '' };
}

/**
 * The longest array of objects in a payload.
 *
 * A payload often carries several arrays — a list of rows beside a list of unresolved
 * filters. The longest is the answer; the others describe the query, and picking one of
 * those is how a check reports the number of search terms it used.
 */
function firstList(source: Record<string, unknown> | undefined): unknown[] | null {
  if (!source) return null;

  let best: unknown[] | null = null;

  for (const value of Object.values(source)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    if (typeof value[0] !== 'object' || value[0] === null) continue;
    if (!best || value.length > best.length) best = value;
  }

  return best;
}
