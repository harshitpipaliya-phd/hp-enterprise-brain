/**
 * AI Evaluation — test sets, runs and scores.
 *
 * Ported from G2G's app/ai/evaluation/page.tsx. Same sections, copy and flow, on
 * HP Brain's primitives and the console's aii- layout. Two HP Brain differences:
 * delete asks through ConfirmationDialog rather than `window.confirm`, and a
 * rejected save marks the offending inputs from the API's per-field errors.
 *
 * WHY THE PER-CASE VERDICT IS SHOWN AND NOT JUST THE SCORE
 *
 * A score of 0.67 tells an author that something regressed and nothing about what. The
 * verdict names the assertion that failed — "missing “199”", "contains “Priya”, which
 * it must not" — which is the difference between a number somebody argues with and a
 * number somebody acts on.
 *
 * WHY RUNNING WARNS ABOUT TIME
 *
 * Each case is one provider call, made in sequence with the request held open. There
 * is no queue behind this, so a twenty-case run genuinely takes a while, and a button
 * that looked instant would read as broken. The screen says so before the click.
 */

import React from 'react';
import { AlertTriangle, ChevronRight, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react';

import { AiApiError, describeAiError } from '../../../api/aiIntelligence/client';
import {
  createEvaluation,
  deleteEvaluation,
  fetchEvaluation,
  fetchEvaluationOptions,
  fetchEvaluations,
  runEvaluation,
  type EvaluationCase,
  type EvaluationCasePayload,
  type EvaluationSummary,
  type EvaluationTemplateOption,
} from '../../../api/aiIntelligence/evaluations';
import {
  Alert,
  Button,
  ConfirmationDialog,
  Field,
  IconButton,
  Select,
  StatusBadge,
  Textarea,
  TextInput,
  type BadgeTone,
} from '../../../ui';
import { CapabilityShell } from '../CapabilityShell';
import { LoadingLine, formatWhen } from '../console-ui';
import { useConsoleNav } from '../consoleNav';
import './aiScreens.css';

export default function EvaluationScreen() {
  return (
    <CapabilityShell slug="evaluation">
      <EvaluationConsole />
    </CapabilityShell>
  );
}

interface CaseDraft {
  label: string;
  /** Newline-separated `key=value`, which is how an author actually types a bag. */
  variables: string;
  /** One phrase per line. */
  expectContains: string;
  expectAbsent: string;
}

interface FormState {
  name: string;
  description: string;
  templateKey: string;
  cases: CaseDraft[];
}

type Detail = { evaluation: EvaluationSummary; cases: EvaluationCase[] };

const BLANK_CASE: CaseDraft = { label: '', variables: '', expectContains: '', expectAbsent: '' };

function EvaluationConsole() {
  const { go } = useConsoleNav();

  const [templates, setTemplates] = React.useState<EvaluationTemplateOption[]>([]);
  const [maxCases, setMaxCases] = React.useState(25);
  const [rows, setRows] = React.useState<EvaluationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [reloadToken, setReloadToken] = React.useState(0);

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [running, setRunning] = React.useState(false);

  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  /** Laravel's per-field messages from a rejected save, keyed as the API names them. */
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([fetchEvaluationOptions(), fetchEvaluations()])
      .then(([options, list]) => {
        if (cancelled) return;
        setTemplates(options.templates);
        setMaxCases(options.max_cases);
        setRows(list.evaluations);
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
  }, [reloadToken]);

  /*
   * Matched against the selection at render time rather than cleared in the effect.
   * Clearing is a synchronous setState inside an effect, and matching also stops a
   * slow response for one evaluation rendering under another's heading.
   */
  React.useEffect(() => {
    if (openId === null) return;

    let cancelled = false;

    fetchEvaluation(openId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [openId, reloadToken]);

  /** The detail only counts as loaded when it is the one that was asked for. */
  const shownDetail = detail?.evaluation?.id === openId ? detail : null;

  const reload = React.useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const run = async (id: string) => {
    setRunning(true);
    setError('');
    setNotice('');

    try {
      const result = await runEvaluation(id);
      setNotice(
        result.evaluation.status === 'completed'
          ? `Run complete — ${result.evaluation.passed_count} of ${result.evaluation.case_count} passed.`
          : 'Run finished with failures.',
      );
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setRunning(false);
    }
  };

  const remove = async () => {
    if (confirmDelete === null) return;

    setDeleting(true);

    try {
      await deleteEvaluation(confirmDelete);
      setOpenId(null);
      setNotice('Evaluation deleted.');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError('');
    setFieldErrors({});

    try {
      await createEvaluation({
        name: form.name.trim(),
        description: form.description.trim() || null,
        template_key: form.templateKey,
        cases: form.cases.map(toCasePayload),
      });

      setForm(null);
      setNotice('Evaluation saved. Run it to get a score.');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
      if (cause instanceof AiApiError) setFieldErrors(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  if (loading && rows.length === 0 && error === '') {
    return (
      <div className="aii-card">
        <LoadingLine>Loading evaluations…</LoadingLine>
      </div>
    );
  }

  return (
    <section className="aiw-section" aria-labelledby="aiw-evaluations-heading">
      <header className="aiw-section-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="aiw-h2" id="aiw-evaluations-heading">Evaluations</h2>
          <p className="aiw-desc">
            A set of cases against one published template. Each case says what a correct answer must
            contain and must not contain, so a score is reproducible and explainable.
          </p>
        </div>
        <div className="aiw-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={reload}
            icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={templates.length === 0}
            onClick={() => {
              setFieldErrors({});
              setForm({
                name: '',
                description: '',
                templateKey: templates[0]?.template_key ?? '',
                cases: [{ ...BLANK_CASE }],
              });
            }}
            icon={<Plus size={14} aria-hidden="true" />}
          >
            New evaluation
          </Button>
        </div>
      </header>

      {templates.length === 0 && (
        <p className="aiw-dashed">
          There are no published templates to evaluate.{' '}
          <button type="button" className="aii-link" onClick={() => go('prompts')}>
            Publish one in Template Management
          </button>{' '}
          first — evaluating a draft measures something nobody can run yet.
        </p>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {form && (
        <EvaluationForm
          form={form}
          setForm={setForm}
          templates={templates}
          maxCases={maxCases}
          saving={saving}
          fieldErrors={fieldErrors}
          onSubmit={submit}
          onCancel={() => {
            setForm(null);
            setFieldErrors({});
          }}
        />
      )}

      <div className="aii-split">
        <ul className="aiw-list" aria-label="Evaluations">
          {rows.length === 0 && <li className="aiw-list-empty">No evaluations yet.</li>}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="aiw-list-btn"
                aria-current={openId === row.id ? 'true' : undefined}
                onClick={() => setOpenId(row.id)}
              >
                <span className="aiw-list-body">
                  <span className="aiw-list-title" style={{ display: 'block' }}>{row.name}</span>
                  <span className="aiw-meta">
                    <RunStatus status={row.status} />
                    <ScoreChip score={row.score} passed={row.passed_count} total={row.case_count} />
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div style={{ minWidth: 0 }}>
          {openId === null ? (
            <p className="aiw-dashed aiw-dashed--tall">
              Select an evaluation to see its cases and results.
            </p>
          ) : shownDetail === null ? (
            <div className="aii-card">
              <LoadingLine>Loading the evaluation…</LoadingLine>
            </div>
          ) : (
            <EvaluationDetail
              detail={shownDetail}
              running={running}
              maxCases={maxCases}
              onRun={() => run(shownDetail.evaluation.id)}
              onDelete={() => setConfirmDelete(shownDetail.evaluation.id)}
            />
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={confirmDelete !== null}
        title="Delete evaluation"
        description="Delete this evaluation and its cases? This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </section>
  );
}

function EvaluationDetail({
  detail,
  running,
  maxCases,
  onRun,
  onDelete,
}: {
  detail: Detail;
  running: boolean;
  maxCases: number;
  onRun: () => void;
  onDelete: () => void;
}) {
  const { evaluation, cases } = detail;

  return (
    <div className="aiw-panel-stack">
      <section className="aiw-panel">
        <div className="aii-row aii-row--between" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <h3 className="aiw-h2">{evaluation.name}</h3>
            <p className="aiw-meta aii-mono">
              {evaluation.template_key}
              {evaluation.template_version !== null && ` v${evaluation.template_version}`}
            </p>
          </div>
          <div className="aii-row">
            <Button
              variant="primary"
              onClick={onRun}
              loading={running}
              icon={running ? undefined : <Play size={16} aria-hidden="true" />}
            >
              {running ? 'Running…' : 'Run'}
            </Button>
            <IconButton label="Delete evaluation" onClick={onDelete} disabled={running}>
              <Trash2 size={16} aria-hidden="true" />
            </IconButton>
          </div>
        </div>

        {evaluation.description && (
          <p className="aiw-body aiw-body--muted" style={{ marginTop: 'var(--space-3)' }}>
            {evaluation.description}
          </p>
        )}

        {/* Said before the click, not after. See the file note. */}
        <p className="aiw-caption" style={{ marginTop: 'var(--space-2)' }}>
          Running makes one model call per case, in sequence — {cases.length} call
          {cases.length === 1 ? '' : 's'}. Up to {maxCases} cases per evaluation.
        </p>

        {evaluation.status !== 'draft' && (
          <dl className="aiw-metrics">
            <Metric label="Score" value={evaluation.score === null ? '—' : evaluation.score.toFixed(2)} />
            <Metric label="Passed" value={`${evaluation.passed_count} / ${evaluation.case_count}`} />
            <Metric label="Model" value={evaluation.model ?? '—'} />
            <Metric
              label="Tokens"
              value={`${evaluation.total_input_tokens} in / ${evaluation.total_output_tokens} out`}
            />
            <Metric
              label="Duration"
              value={evaluation.duration_ms === null ? '—' : `${(evaluation.duration_ms / 1000).toFixed(1)}s`}
            />
            <Metric label="Finished" value={formatWhen(evaluation.finished_at)} />
          </dl>
        )}

        {evaluation.error && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Alert tone="danger">{evaluation.error}</Alert>
          </div>
        )}
      </section>

      <section className="aiw-panel-stack" aria-label="Cases">
        {cases.map((testCase) => (
          <article key={testCase.id} className="aiw-panel">
            <div className="aii-row aii-row--between" style={{ alignItems: 'flex-start' }}>
              <h4 className="aiw-h4">{testCase.label}</h4>
              {testCase.passed === null ? (
                <StatusBadge tone="neutral" icon={false}>Not run</StatusBadge>
              ) : (
                <StatusBadge tone={testCase.passed ? 'success' : 'danger'}>
                  {testCase.passed ? 'PASS' : 'FAIL'}
                  {testCase.score !== null && ` · ${testCase.score.toFixed(2)}`}
                </StatusBadge>
              )}
            </div>

            <div className="aiw-case-assert">
              {testCase.expect_contains.length > 0 && (
                <span>must contain: {testCase.expect_contains.map((s) => `"${s}"`).join(', ')}</span>
              )}
              {testCase.expect_absent.length > 0 && (
                <span>must not contain: {testCase.expect_absent.map((s) => `"${s}"`).join(', ')}</span>
              )}
            </div>

            {/* The reason, not just the number. */}
            {testCase.verdict && <p className="aiw-verdict">{testCase.verdict}</p>}

            {testCase.error && (
              <p className="aiw-case-error">
                <AlertTriangle size={12} aria-hidden="true" /> {testCase.error}
              </p>
            )}

            {testCase.output && (
              <details className="aiw-details">
                <summary>
                  What the model returned
                  {testCase.output_tokens !== null && ` (${testCase.output_tokens} tokens)`}
                </summary>
                <pre className="aii-pre">{testCase.output}</pre>
              </details>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function EvaluationForm({
  form,
  setForm,
  templates,
  maxCases,
  saving,
  fieldErrors,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  templates: EvaluationTemplateOption[];
  maxCases: number;
  saving: boolean;
  fieldErrors: Record<string, string[]>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const selected = templates.find((template) => template.template_key === form.templateKey);

  /**
   * The first message for a field, including its children — Laravel reports
   * `cases.0.expect_contains.2`, and the textarea that owns it is `cases.0.expect_contains`.
   */
  const errorFor = (key: string): string | undefined => {
    if (fieldErrors[key]?.[0]) return fieldErrors[key][0];
    const nested = Object.keys(fieldErrors).find((name) => name.startsWith(`${key}.`));
    return nested ? fieldErrors[nested][0] : undefined;
  };

  const patchCase = (index: number, changes: Partial<CaseDraft>) => {
    const cases = [...form.cases];
    cases[index] = { ...cases[index], ...changes };
    setForm({ ...form, cases });
  };

  // `cases` itself (too many, none at all) is not any one input's fault.
  const casesError = fieldErrors.cases?.[0];

  return (
    <form onSubmit={onSubmit} className="aii-card aii-form" aria-labelledby="aiw-new-evaluation">
      <div className="aii-row aii-row--between">
        <h3 className="aiw-h3" id="aiw-new-evaluation">New evaluation</h3>
        <IconButton label="Close" size="sm" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="aii-form-grid">
        <Field label="Name" required error={errorFor('name')}>
          <TextInput
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Signal summary grounding check"
          />
        </Field>

        <Field
          label="Template under test"
          error={errorFor('template_key') ?? errorFor('template_version')}
          help={
            selected && selected.grounding_variables.length > 0
              ? `Supply at least ${selected.grounding_variables.map((key) => `${key}=…`).join(' and ')} in each case, or the template has nothing to work from.`
              : undefined
          }
        >
          <Select
            value={form.templateKey}
            onChange={(event) => setForm({ ...form, templateKey: event.target.value })}
          >
            {templates.map((template) => (
              <option key={template.template_key} value={template.template_key}>
                {template.name} (v{template.version}) — {template.module_label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="What this measures (optional)" error={errorFor('description')}>
        <TextInput
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </Field>

      <div className="aii-stack" style={{ gap: 'var(--space-3)' }}>
        <div className="aii-row aii-row--between">
          <h4 className="aiw-h4">
            Cases ({form.cases.length} of {maxCases})
          </h4>
          <Button
            size="sm"
            variant="secondary"
            disabled={form.cases.length >= maxCases}
            onClick={() => setForm({ ...form, cases: [...form.cases, { ...BLANK_CASE }] })}
          >
            Add case
          </Button>
        </div>

        {casesError && <Alert tone="danger">{casesError}</Alert>}

        {form.cases.map((testCase, index) => (
          <fieldset key={index} className="aiw-case-draft" style={{ margin: 0 }}>
            <legend className="u-sr-only">Case {index + 1}</legend>
            <div className="aiw-case-draft-head">
              <div className="aiw-grow">
                <Field label={`Case ${index + 1}`} required error={errorFor(`cases.${index}.label`)}>
                  <TextInput
                    required
                    value={testCase.label}
                    onChange={(event) => patchCase(index, { label: event.target.value })}
                    placeholder="What this case checks"
                  />
                </Field>
              </div>
              {form.cases.length > 1 && (
                <IconButton
                  label={`Remove case ${index + 1}`}
                  onClick={() => setForm({ ...form, cases: form.cases.filter((_, i) => i !== index) })}
                >
                  <X size={14} aria-hidden="true" />
                </IconButton>
              )}
            </div>

            <div className="aiw-case-grid">
              <Field label="Variables (one key=value per line)" error={errorFor(`cases.${index}.variables`)}>
                <Textarea
                  rows={4}
                  className="aiw-mono-input"
                  value={testCase.variables}
                  onChange={(event) => patchCase(index, { variables: event.target.value })}
                  placeholder={'records=- Root Cause Analysis\nmetrics=Open signals: 42'}
                />
              </Field>
              <Field label="Must contain (one per line)" error={errorFor(`cases.${index}.expect_contains`)}>
                <Textarea
                  rows={4}
                  className="aiw-mono-input"
                  value={testCase.expectContains}
                  onChange={(event) => patchCase(index, { expectContains: event.target.value })}
                  placeholder="199"
                />
              </Field>
              <Field label="Must NOT contain (one per line)" error={errorFor(`cases.${index}.expect_absent`)}>
                <Textarea
                  rows={4}
                  className="aiw-mono-input"
                  value={testCase.expectAbsent}
                  onChange={(event) => patchCase(index, { expectAbsent: event.target.value })}
                  placeholder="500"
                />
              </Field>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="aii-row">
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * A draft case as the API wants it.
 *
 * Variables are typed as `key=value` lines because that is how somebody writes a bag
 * of them by hand; a JSON textarea would make a malformed brace the most common
 * failure on this screen.
 */
function toCasePayload(draft: CaseDraft): EvaluationCasePayload {
  const variables: Record<string, string> = {};

  for (const line of draft.variables.split('\n')) {
    const separator = line.indexOf('=');

    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);

    if (key !== '') variables[key] = value;
  }

  const lines = (value: string) =>
    value
      .split('\n')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '');

  return {
    label: draft.label.trim(),
    variables,
    expect_contains: lines(draft.expectContains),
    expect_absent: lines(draft.expectAbsent),
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="aii-metric">
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function RunStatus({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'completed' ? 'success' : status === 'failed' ? 'danger' : status === 'running' ? 'info' : 'neutral';

  return (
    <StatusBadge tone={tone}>
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </StatusBadge>
  );
}

function ScoreChip({ score, passed, total }: { score: number | null; passed: number; total: number }) {
  if (score === null) {
    return <span>not run</span>;
  }

  return (
    <span className="aiw-num">
      {score.toFixed(2)} · {passed}/{total} passed
    </span>
  );
}
