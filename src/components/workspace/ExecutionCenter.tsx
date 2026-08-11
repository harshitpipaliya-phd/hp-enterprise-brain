import { useEffect, useState } from 'react';
import { CheckCircle2, PlayCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { esoApi } from '../../api/eso';
import { LoadingState, ErrorState, EmptyState } from '../shared/States';
import { badgeTone, formatDateTime, formatNumber, formatPercent } from './intelligenceShared';
import './IntelligenceSuite.css';

type ExecutionOverview = any;

export default function ExecutionCenter({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<ExecutionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const load = async (filter = statusFilter, options?: { background?: boolean }) => {
    const useBackgroundRefresh = Boolean(options?.background) || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const overview = await decisionIntelligenceApi.getExecutionOverview(tenantId, 1, 12, filter);
      setData(overview);
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
    await esoApi.transition(tenantId, id, 'completed');
    await load(statusFilter);
  };

  const rollbackExecution = async (id: string) => {
    await esoApi.rollback(tenantId, id);
    await load(statusFilter);
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
