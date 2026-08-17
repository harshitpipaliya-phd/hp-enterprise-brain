
import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileCheck2, PlayCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { api, decisionIntelligenceApi } from '../../api/intelligence';
import { esoApi } from '../../api/eso';
import { LoadingState, ErrorState, EmptyState } from '../shared/States';
import { badgeTone, formatDateTime, formatNumber, formatPercent } from './intelligenceShared';
import './IntelligenceSuite.css';

type ExecutionOverview = any;
type EsoDefinition = { id: string; name: string; esoCode?: string; status?: string };

export default function ExecutionCenter({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<ExecutionOverview | null>(null);
  const [definitions, setDefinitions] = useState<EsoDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planForms, setPlanForms] = useState<Record<string, Record<string, string>>>({});
  const [outcomeForms, setOutcomeForms] = useState<Record<string, Record<string, string>>>({});

  const load = async (filter = statusFilter, options?: { background?: boolean }) => {
    const useBackgroundRefresh = Boolean(options?.background) || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [overview, definitionPayload] = await Promise.all([
        decisionIntelligenceApi.getExecutionOverview(tenantId, 1, 12, filter),
        esoApi.definitions(tenantId),
      ]);
      setData(overview);
      setDefinitions(definitionPayload?.definitions ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load execution center.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
  }, [tenantId, statusFilter]);

  const completeExecution = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    setActionMessage(null);
    try {
      await esoApi.transition(tenantId, id, 'completed');
      setActionMessage(`Execution ${id} is marked completed. Record its measured outcome next.`);
      await load(statusFilter);
    } catch (e: any) {
      setActionError(e?.message ?? 'Unable to complete execution.');
    } finally {
      setBusyId(null);
    }
  };

  const rollbackExecution = async (id: string) => {
    const reason = window.prompt('Rollback reason');
    if (!reason || reason.trim().length === 0) {
      setActionError('A rollback reason is required.');
      return;
    }
    setBusyId(id);
    setActionError(null);
    setActionMessage(null);
    try {
      await esoApi.rollback(tenantId, id, reason.trim());
      setActionMessage(`Execution ${id} was rolled back.`);
      await load(statusFilter);
    } catch (e: any) {
      setActionError(e?.message ?? 'Unable to roll back execution.');
    } finally {
      setBusyId(null);
    }
  };

  const updatePlanForm = (decisionId: string, patch: Record<string, string>) => {
    setPlanForms((forms) => ({ ...forms, [decisionId]: { ...(forms[decisionId] ?? {}), ...patch } }));
  };

  const updateOutcomeForm = (executionId: string, patch: Record<string, string>) => {
    setOutcomeForms((forms) => ({ ...forms, [executionId]: { ...(forms[executionId] ?? {}), ...patch } }));
  };

  const startExecution = async (item: any) => {
    const form = planForms[item.id] ?? {};
    const defaultEso = item.recommendation?.esoId || definitions[0]?.id || '';
    const esoDefinitionId = form.esoDefinitionId || defaultEso;
    const baselineMetric = (form.baselineMetric || '').trim();

    if (!esoDefinitionId) {
      setActionError('No ESO definition is available for this tenant.');
      return;
    }
    if (!baselineMetric) {
      setActionError('A baseline metric is required before execution can start.');
      return;
    }

    setBusyId(item.id);
    setActionError(null);
    setActionMessage(null);
    try {
      await esoApi.createMeasurementPlan({
        decisionId: item.id,
        baselineMetric,
        baselineValue: form.baselineValue ? Number(form.baselineValue) : undefined,
        targetValue: form.targetValue ? Number(form.targetValue) : undefined,
        metricUnit: form.metricUnit || undefined,
        measurementWindowDays: form.measurementWindowDays ? Number(form.measurementWindowDays) : 14,
      });
      const execution = await esoApi.create({
        decisionId: item.id,
        esoDefinitionId,
        executorType: 'human',
      });
      setActionMessage(`Execution ${execution.id} started for decision ${item.id}.`);
      await load(statusFilter);
    } catch (e: any) {
      setActionError(e?.message ?? 'Unable to start execution.');
    } finally {
      setBusyId(null);
    }
  };

  const recordOutcome = async (row: any) => {
    const form = outcomeForms[row.id] ?? {};
    const metricName = (form.metricName || '').trim();
    const metricValue = form.metricValue === '' || form.metricValue == null ? null : Number(form.metricValue);
    const evidenceIds = (form.evidenceIds ?? (row.citationEvidenceIds || []).join('\n'))
      .split(/[\n,]+/)
      .map((id: string) => id.trim())
      .filter(Boolean);

    if (!row.decisionId) {
      setActionError('This execution is not linked to a decision.');
      return;
    }
    if (!metricName || metricValue === null || Number.isNaN(metricValue)) {
      setActionError('A numeric outcome metric is required.');
      return;
    }
    if (evidenceIds.length === 0) {
      setActionError('An outcome must cite at least one real evidence row.');
      return;
    }

    setBusyId(row.id);
    setActionError(null);
    setActionMessage(null);
    try {
      const outcome = await api.captureOutcome({
        tenantId,
        decisionId: row.decisionId,
        result: form.result || 'partial',
        metrics: { [metricName]: metricValue },
        evidenceIds,
        feedback: form.feedback || undefined,
        confidence: form.confidence ? Number(form.confidence) : 0.7,
      });
      setActionMessage(`Outcome ${outcome.id} recorded. Learning will appear after the loop consumer processes OutcomeRecorded.`);
      await load(statusFilter);
    } catch (e: any) {
      setActionError(e?.message ?? 'Unable to record outcome.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <LoadingState label="Loading execution center..." />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="intel-page intel-execution">
      <header className="intel-header">
        <div>
          <span className="intel-eyebrow"><PlayCircle size={14} /> Operations Control Room</span>
          <h1>Execution Center</h1>
          <p>Monitor whether approved decisions become real execution, whether execution stays healthy, and whether outcomes are measured before success is claimed.</p>
          <div className="intel-meta">
            <div className="intel-meta-card">
              <span>Organization</span>
              <strong>{data.organization?.name || 'Organization'}</strong>
              <small>Current tenant scope</small>
            </div>
            <div className="intel-meta-card">
              <span>Primary Bottleneck</span>
              <strong>{data.bottlenecks?.primary?.label || 'Insufficient data'}</strong>
              <small>{formatNumber(data.bottlenecks?.primary?.count)} affected</small>
            </div>
            <div className="intel-meta-card">
              <span>Refresh</span>
              <strong><button type="button" onClick={() => load(statusFilter, { background: true })}><RefreshCw size={15} /> Refresh</button></strong>
              <small>{refreshing ? 'Resyncing live execution state…' : 'Refresh only execution intelligence'}</small>
            </div>
          </div>
        </div>

        <div className="intel-score-card">
          <span className="intel-subtle">Execution Success Rate</span>
          <strong>{data.summary?.successRate != null ? `${Math.round(data.summary.successRate * 100)}` : 'NA'}</strong>
          <p>{data.summary?.outcomeMeasurementRate != null ? `${formatPercent(data.summary.outcomeMeasurementRate)} of completed runs have measured outcomes` : 'Outcome measurement rate is not available yet.'}</p>
          {refreshing && <div className="intel-refresh-chip" data-variant="execution">Refreshing execution pipeline…</div>}
        </div>
      </header>

      <section className="intel-section">
        <div className="intel-execution-pipeline">
          {data.pipeline?.map((stage: any) => (
            <div key={stage.label} className="intel-status-card" data-tone={badgeTone(stage.label === 'Completed' ? 'completed' : stage.label === 'Running' ? 'running' : 'pending')}>
              <span className="intel-kpi-label">{stage.label}</span>
              <strong className="intel-number">{formatNumber(stage.count)}</strong>
            </div>
          ))}
        </div>
      </section>

      {(actionError || actionMessage) && (
        <section className="intel-section">
          <div className="intel-panel" data-tone={actionError ? 'critical' : 'completed'}>
            <p>{actionError || actionMessage}</p>
          </div>
        </section>
      )}

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow"><ClipboardCheck size={14} /> Execution Intake</span>
            <h2>Approved decisions waiting for action</h2>
          </div>
        </div>
        {data.executionQueue?.items?.length ? (
          <div className="intel-summary-list">
            {data.executionQueue.items.map((item: any) => {
              const form = planForms[item.id] ?? {};
              const defaultEso = item.recommendation?.esoId || definitions[0]?.id || '';
              return (
                <article key={item.id} className="intel-summary-item">
                  <div className="intel-inline-list">
                    <strong>{item.decision}</strong>
                    <span className="intel-pill" data-tone={badgeTone(item.recommendation?.priority || 'pending')}>{item.recommendation?.priority || 'approved'}</span>
                    {item.caseId && <span className="intel-mini-badge">Case {item.caseId.slice(0, 8)}</span>}
                  </div>
                  <p>{item.recommendation?.impact || 'Approved decision is ready for a governed human execution.'}</p>
                  <div className="intel-form-grid">
                    <label>
                      <span>Executable object</span>
                      <select
                        value={form.esoDefinitionId ?? defaultEso}
                        onChange={(e) => updatePlanForm(item.id, { esoDefinitionId: e.target.value })}
                        disabled={!definitions.length || busyId === item.id}
                      >
                        {definitions.length ? definitions.map((definition) => (
                          <option key={definition.id} value={definition.id}>
                            {definition.esoCode ? `${definition.esoCode} - ${definition.name}` : definition.name}
                          </option>
                        )) : <option value="">No ESO definitions</option>}
                      </select>
                    </label>
                    <label>
                      <span>Baseline metric</span>
                      <input
                        value={form.baselineMetric ?? ''}
                        onChange={(e) => updatePlanForm(item.id, { baselineMetric: e.target.value })}
                        placeholder="collection rate"
                        disabled={busyId === item.id}
                      />
                    </label>
                    <label>
                      <span>Baseline value</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={form.baselineValue ?? ''}
                        onChange={(e) => updatePlanForm(item.id, { baselineValue: e.target.value })}
                        disabled={busyId === item.id}
                      />
                    </label>
                    <label>
                      <span>Target value</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={form.targetValue ?? ''}
                        onChange={(e) => updatePlanForm(item.id, { targetValue: e.target.value })}
                        disabled={busyId === item.id}
                      />
                    </label>
                    <label>
                      <span>Unit</span>
                      <input
                        value={form.metricUnit ?? ''}
                        onChange={(e) => updatePlanForm(item.id, { metricUnit: e.target.value })}
                        placeholder="ratio, INR, count"
                        disabled={busyId === item.id}
                      />
                    </label>
                    <label>
                      <span>Window days</span>
                      <input
                        type="number"
                        min="1"
                        value={form.measurementWindowDays ?? '14'}
                        onChange={(e) => updatePlanForm(item.id, { measurementWindowDays: e.target.value })}
                        disabled={busyId === item.id}
                      />
                    </label>
                  </div>
                  <div className="intel-inline-actions">
                    <button type="button" onClick={() => startExecution(item)} disabled={!definitions.length || busyId === item.id}>
                      <PlayCircle size={14} /> Plan and start
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="O" message="No approved decisions are waiting for execution." />
        )}
      </section>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">Execution Health</span>
            <h2>Operational indicators</h2>
          </div>
        </div>
        <div className="intel-stat-grid">
          {[
            ['Approved Decisions', data.summary?.approvedDecisions],
            ['Queued', data.summary?.queuedExecutions],
            ['Running', data.summary?.runningExecutions],
            ['Completed', data.summary?.completedExecutions],
            ['Failed', data.summary?.failedExecutions],
            ['Rolled Back', data.summary?.rolledBackExecutions],
            ['Average Execution Time', data.summary?.averageExecutionHours != null ? `${data.summary.averageExecutionHours}h` : 'Insufficient data'],
            ['Outcome Measurement', data.summary?.outcomeMeasurementRate != null ? formatPercent(data.summary.outcomeMeasurementRate) : 'Insufficient data'],
          ].map(([label, value]) => (
            <article key={String(label)} className="intel-kpi" data-tone={badgeTone(String(label).includes('Failed') ? 'failed' : String(label).includes('Completed') ? 'completed' : 'running')}>
              <span className="intel-kpi-label">{label}</span>
              <div className="intel-kpi-value">{typeof value === 'number' ? formatNumber(value) : value}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="intel-section intel-execution-layout">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Active Executions</span>
              <h2>Monitoring table</h2>
            </div>
            <div className="intel-inline-list">
              {['active', 'all', 'running', 'blocked', 'completed'].map((filter) => (
                <button key={filter} type="button" className={statusFilter === filter ? 'is-active-filter' : ''} onClick={() => setStatusFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Execution</th>
                  <th>Decision</th>
                  <th>Owner</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Risk</th>
                  <th>Outcome</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.activeExecutions?.items?.length ? data.activeExecutions.items.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.execution}</td>
                    <td>{row.decision}</td>
                    <td>{row.owner || 'Insufficient data'}</td>
                    <td>{row.department || 'Insufficient data'}</td>
                    <td><span className="intel-pill" data-tone={badgeTone(row.status)}>{row.status}</span></td>
                    <td>{row.progress != null ? formatPercent(row.progress) : 'Insufficient data'}</td>
                    <td>{formatDateTime(row.started)}</td>
                    <td>{row.durationDays != null ? `${row.durationDays} days` : 'Insufficient data'}</td>
                    <td><span className="intel-mini-badge" data-tone={badgeTone(row.risk)}>{row.risk}</span></td>
                    <td>{row.outcomeStatus || 'Outcome not measured'}</td>
                    <td>
                      <div className="intel-inline-actions">
                        {row.status === 'running' && <button type="button" onClick={() => completeExecution(row.id)}><CheckCircle2 size={14} /> Complete</button>}
                        {['running', 'failed', 'blocked'].includes(String(row.status)) && <button type="button" onClick={() => rollbackExecution(row.id)}><RotateCcw size={14} /> Rollback</button>}
                      </div>
                      {row.status === 'completed' && !row.outcome && (
                        <div className="intel-outcome-form">
                          <label>
                            <span>Result</span>
                            <select
                              value={outcomeForms[row.id]?.result ?? 'partial'}
                              onChange={(e) => updateOutcomeForm(row.id, { result: e.target.value })}
                              disabled={busyId === row.id}
                            >
                              <option value="success">success</option>
                              <option value="partial">partial</option>
                              <option value="failure">failure</option>
                              <option value="inconclusive">inconclusive</option>
                            </select>
                          </label>
                          <label>
                            <span>Metric</span>
                            <input
                              value={outcomeForms[row.id]?.metricName ?? ''}
                              onChange={(e) => updateOutcomeForm(row.id, { metricName: e.target.value })}
                              placeholder="collection rate"
                              disabled={busyId === row.id}
                            />
                          </label>
                          <label>
                            <span>Value</span>
                            <input
                              type="number"
                              step="0.0001"
                              value={outcomeForms[row.id]?.metricValue ?? ''}
                              onChange={(e) => updateOutcomeForm(row.id, { metricValue: e.target.value })}
                              disabled={busyId === row.id}
                            />
                          </label>
                          <label>
                            <span>Confidence</span>
                            <input
                              type="number"
                              min="0"
                              max="1"
                              step="0.01"
                              value={outcomeForms[row.id]?.confidence ?? '0.7'}
                              onChange={(e) => updateOutcomeForm(row.id, { confidence: e.target.value })}
                              disabled={busyId === row.id}
                            />
                          </label>
                          <label>
                            <span>Evidence IDs</span>
                            <textarea
                              rows={2}
                              value={outcomeForms[row.id]?.evidenceIds ?? (row.citationEvidenceIds || []).join('\n')}
                              onChange={(e) => updateOutcomeForm(row.id, { evidenceIds: e.target.value })}
                              disabled={busyId === row.id}
                            />
                          </label>
                          <label>
                            <span>Feedback</span>
                            <textarea
                              rows={2}
                              value={outcomeForms[row.id]?.feedback ?? ''}
                              onChange={(e) => updateOutcomeForm(row.id, { feedback: e.target.value })}
                              disabled={busyId === row.id}
                            />
                          </label>
                          <button type="button" onClick={() => recordOutcome(row)} disabled={busyId === row.id}>
                            <FileCheck2 size={14} /> Record outcome
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={11}>No executions match the current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="intel-execution-sidebar">
          <div className="intel-panel">
            <div className="intel-section-head">
              <div>
                <span className="intel-eyebrow">Bottlenecks</span>
                <h2>Where execution is breaking</h2>
              </div>
            </div>
            <div className="intel-summary-list">
              {data.bottlenecks?.items?.map((item: any) => (
                <article key={item.key} className="intel-summary-item">
                  <div className="intel-inline-list">
                    <strong>{item.label}</strong>
                    <span className="intel-pill" data-tone={badgeTone(item.count > 0 ? 'high' : 'completed')}>{formatNumber(item.count)}</span>
                  </div>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="intel-panel">
            <div className="intel-section-head">
              <div>
                <span className="intel-eyebrow">Predicted vs Realized</span>
                <h2>Outcome comparison</h2>
              </div>
            </div>
            {data.predictedVsRealized?.items?.length ? (
              <div className="intel-summary-list">
                {data.predictedVsRealized.items.map((item: any) => (
                  <article key={item.executionId} className="intel-summary-item">
                    <strong>{item.label}</strong>
                    <p>Predicted {formatNumber(item.predicted)} vs realized {formatNumber(item.realized)}</p>
                    <small>{item.variance >= 0 ? 'Over-performance' : 'Under-performance'} {formatNumber(Math.abs(item.variance))}</small>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon="○" message="No comparable predicted and realized outcome metrics are available." />
            )}
          </div>
        </div>
      </section>

      <section className="intel-section intel-execution-layout">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Decision to Outcome Funnel</span>
              <h2>Conversion chain</h2>
            </div>
          </div>
          <div className="intel-funnel">
            {data.funnel?.map((step: any) => (
              <div key={step.label} className="intel-funnel-step">
                <strong>{formatNumber(step.count)}</strong>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Outcome & Learning Loop</span>
              <h2>Measured results</h2>
            </div>
          </div>
          <div className="intel-summary-list">
            {data.outcomeLoop?.length ? data.outcomeLoop.map((item: any) => (
              <article key={item.executionId} className="intel-summary-item">
                <div className="intel-inline-list">
                  <strong>{item.executionId}</strong>
                  <span className="intel-pill" data-tone={badgeTone(item.outcome)}>{item.outcome}</span>
                </div>
                <p>{item.targetVsActual ? JSON.stringify(item.targetVsActual) : 'Outcome not measured'}</p>
                <small>{formatNumber(item.learningCount)} learning record(s), {formatNumber(item.reusableLearningCount)} reusable</small>
              </article>
            )) : <EmptyState icon="○" message="No completed execution outcomes are available yet." />}
          </div>
        </div>
      </section>
    </div>
  );
}
