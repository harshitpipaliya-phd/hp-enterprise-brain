import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Building2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { EmptyState, ErrorState, LoadingState } from '../shared/States';
import { badgeTone, formatDateTime, formatDecimal, formatNumber, formatPercent } from './intelligenceShared';
import './IntelligenceSuite.css';

type EnterpriseOverview = any;

export default function IntelligenceWorkspace({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<EnterpriseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async ({ background = false } = {}) => {
    const useBackgroundRefresh = background || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const overview = await decisionIntelligenceApi.getEnterpriseOverview(tenantId);
      setData(overview);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load executive dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const priorityFeed = useMemo(
    () => [...(data?.managementAttention || []), ...(data?.predictedIssues || [])].slice(0, 6),
    [data],
  );

  if (loading && !data) return <LoadingState label="Loading executive dashboard..." />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const scoreBreakdown = [
    ['Decision acceptance', data.intelligenceScore?.breakdown?.decisionAcceptance],
    ['Recommendation accuracy', data.intelligenceScore?.breakdown?.recommendationAccuracy],
    ['Evidence quality', data.intelligenceScore?.breakdown?.evidenceQuality],
    ['Risk coverage', data.intelligenceScore?.breakdown?.riskCoverage],
  ];

  return (
    <div className="intel-page intel-enterprise">
      <header className="intel-enterprise-board-hero">
        <div className="intel-enterprise-board-copy">
          <span className="intel-eyebrow"><BrainCircuit size={14} /> Executive Dashboard</span>
          <h1>Enterprise Intelligence Workspace</h1>
          <p>
            Board-level visibility into company posture, value risk, measured recovery,
            operating gaps, and the next actions that current evidence can defend.
          </p>

          <div className="intel-enterprise-badges">
            <span className="intel-pill" data-tone="info">{data.organization?.name || 'Organization'}</span>
            <span className="intel-pill" data-tone="warn">{data.organization?.industry || 'Business type unavailable'}</span>
            <span className="intel-pill" data-tone={badgeTone(data.summary?.healthScore != null && data.summary.healthScore < 0.45 ? 'critical' : 'active')}>
              Health {data.summary?.healthScore != null ? formatPercent(data.summary.healthScore) : 'Insufficient data'}
            </span>
          </div>

          <div className="intel-board-brief">
            <article className="intel-board-brief-card">
              <span className="intel-kpi-label">Where We Are Now</span>
              <strong>{data.summary?.whereToday || 'Insufficient data'}</strong>
            </article>
            <article className="intel-board-brief-card">
              <span className="intel-kpi-label">If We Do Nothing</span>
              <strong>{data.summary?.whatCouldHappenNext || 'Not enough evidence'}</strong>
            </article>
          </div>
        </div>

        <aside className="intel-enterprise-board-side">
          <div className="intel-board-score">
            <span className="intel-subtle">Organizational Health</span>
            <strong>{data.intelligenceScore?.score != null ? `${Math.round(data.intelligenceScore.score * 100)}` : 'NA'}</strong>
            <p>{data.summary?.methodology}</p>
          </div>

          <div className="intel-meta intel-enterprise-board-meta">
            <div className="intel-meta-card">
              <span>Data Confidence</span>
              <strong>{data.summary?.dataConfidence != null ? formatPercent(data.summary.dataConfidence) : 'Insufficient data'}</strong>
              <small>Confidence published from measured evidence quality.</small>
            </div>
            <div className="intel-meta-card">
              <span>Board Ask</span>
              <strong>{data.boardAsk?.decisionQueue != null ? formatNumber(data.boardAsk.decisionQueue) : 'Insufficient data'}</strong>
              <small>{data.boardAsk?.headline || 'No current board ask is available.'}</small>
            </div>
            <div className="intel-meta-card">
              <span>Refresh</span>
              <strong>
                <button type="button" onClick={() => load({ background: true })}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </strong>
              <small>{refreshing ? 'Refreshing this executive view only...' : 'Reload the executive intelligence snapshot only.'}</small>
            </div>
          </div>
        </aside>
      </header>

      {refreshing && (
        <div className="intel-refresh-ribbon" data-variant="enterprise">
          <BrainCircuit size={14} /> Refreshing executive intelligence while the current dashboard remains visible
        </div>
      )}

      <section className="intel-section intel-enterprise-kpi-strip">
        {data.kpis?.map((item: any) => (
          <article
            key={item.label}
            className="intel-kpi"
            data-tone={badgeTone(item.label.includes('Risk') ? 'high' : item.label.includes('Coverage') ? 'active' : 'pending')}
          >
            <span className="intel-kpi-label">{item.label}</span>
            <div className="intel-kpi-value">
              {typeof item.value === 'number' && item.value <= 1 && item.label.includes('Coverage')
                ? formatPercent(item.value)
                : typeof item.value === 'number'
                  ? formatNumber(item.value)
                  : item.value ?? 'Insufficient data'}
            </div>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="intel-section intel-board-value-grid">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Value / Business Impact</span>
              <h2>Priced leakage, recovered value, and known unpriced issues</h2>
            </div>
          </div>

          <div className="intel-value-summary">
            <article className="intel-value-card" data-tone="crit">
              <span className="intel-kpi-label">Priced Leakage</span>
              <strong>{formatMetricValue(data.valueRealization?.pricedLeakage?.total)}</strong>
              <small>Summed only from recommendation records carrying explicit numeric value.</small>
            </article>
            <article className="intel-value-card" data-tone="good">
              <span className="intel-kpi-label">Recovered Value</span>
              <strong>{formatMetricValue(data.valueRealization?.recovered?.total)}</strong>
              <small>Counted only where an outcome row records measurable realized value.</small>
            </article>
            <article className="intel-value-card" data-tone="warn">
              <span className="intel-kpi-label">Real But Unpriced</span>
              <strong>{formatNumber(data.valueRealization?.unpriced?.length)}</strong>
              <small>Known issues that matter, but should not be priced without evidence.</small>
            </article>
          </div>

          <div className="intel-value-ledgers">
            <LedgerPanel
              title="Priced leakage"
              items={data.valueRealization?.pricedLeakage?.items}
              emptyMessage="No pending records with defensible priced leakage are available."
            />
            <LedgerPanel
              title="Recovered value"
              items={data.valueRealization?.recovered?.items}
              emptyMessage="No measured outcome rows with realized value are available yet."
            />
            <div className="intel-ledger-panel">
              <h3 className="intel-subsection-title">Real but unpriced</h3>
              <div className="intel-summary-list">
                {data.valueRealization?.unpriced?.length ? data.valueRealization.unpriced.map((item: any) => (
                  <article key={item.id} className="intel-summary-item">
                    <strong>{item.title}</strong>
                    <p>{item.why}</p>
                  </article>
                )) : <EmptyState icon="O" message="No unpriced issue has been identified from current records." />}
              </div>
            </div>
          </div>
        </div>

        <aside className="intel-panel intel-board-side-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><ArrowRight size={14} /> Forecast / What Happens Next</span>
              <h2>Act versus continue</h2>
            </div>
          </div>

          <div className="intel-forecast-stack">
            <article className="intel-forecast-card">
              <span className="intel-kpi-label">If Current Behavior Continues</span>
              <strong>{data.forecast?.status === 'ok' ? 'Direction inferred from history' : 'Insufficient historical data'}</strong>
              <p>{data.forecast?.continuation || 'Insufficient historical data'}</p>
            </article>
            <article className="intel-forecast-card">
              <span className="intel-kpi-label">If Recommended Actions Land</span>
              <strong>{data.forecast?.actionPath ? 'Action path identified' : 'Not enough evidence'}</strong>
              <p>{data.forecast?.actionPath || 'Not enough evidence'}</p>
            </article>
          </div>

          <div className="intel-trend-grid">
            {Object.entries(data.trends || {}).map(([key, trend]: [string, any]) => (
              <article key={key} className="intel-trend-card">
                <strong>{humanizeKey(key)}</strong>
                {trend?.status === 'ok' && trend.series?.length ? (
                  <>
                    <div className="intel-spark compact">
                      {trend.series.slice(-10).map((point: any) => (
                        <div key={point.date} className="intel-spark-col">
                          <div style={{ height: `${Math.max(10, Math.min(100, Number(point.value || 0) * 100))}%` }} />
                        </div>
                      ))}
                    </div>
                    <small>Latest {formatTrendLatest(trend.series)}</small>
                  </>
                ) : <small>{trend?.message || 'Insufficient historical data'}</small>}
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="intel-section intel-board-command-grid">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Executive Intelligence Summary</span>
              <h2>Company posture and score breakdown</h2>
            </div>
          </div>

          <div className="intel-board-posture-grid">
            <div className="intel-board-posture-copy">
              <div className="intel-summary-columns">
                <div>
                  <h3 className="intel-subsection-title">Strengths</h3>
                  <ul className="intel-list">
                    {(data.executiveSummary?.strengths || []).length ? data.executiveSummary.strengths.map((item: string) => (
                      <li key={item}>{item}</li>
                    )) : <li>Not enough evidence to confirm strong areas yet.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="intel-subsection-title">Weaknesses</h3>
                  <ul className="intel-list">
                    {(data.executiveSummary?.weaknesses || []).length ? data.executiveSummary.weaknesses.map((item: string) => (
                      <li key={item}>{item}</li>
                    )) : <li>No material weakness surfaced from current data.</li>}
                  </ul>
                </div>
              </div>

              <div className="intel-dimension-list">
                {(data.dimensions || []).map((item: any) => (
                  <article key={item.label} className="intel-dimension-row">
                    <div className="intel-inline-list">
                      <strong>{item.label}</strong>
                      <span className="intel-mini-badge" data-tone={badgeTone(item.score != null && item.score < 0.45 ? 'critical' : item.score != null && item.score < 0.7 ? 'pending' : 'active')}>
                        {item.score != null ? formatPercent(item.score) : 'Insufficient data'}
                      </span>
                    </div>
                    <div className="intel-progress-track">
                      <div style={{ width: `${Math.max(0, Math.min(100, Number(item.score || 0) * 100))}%` }} />
                    </div>
                    <small>{item.methodology}</small>
                  </article>
                ))}
              </div>
            </div>

            <div className="intel-board-score-breakdown">
              <h3 className="intel-subsection-title">Published intelligence score</h3>
              <div className="intel-score-breakdown">
                {scoreBreakdown.map(([label, value]) => (
                  <article key={String(label)} className="intel-score-line">
                    <div className="intel-inline-list">
                      <span>{label}</span>
                      <strong>{value != null ? formatPercent(Number(value)) : 'Insufficient data'}</strong>
                    </div>
                    <div className="intel-progress-track">
                      <div style={{ width: `${Math.max(0, Math.min(100, Number(value || 0) * 100))}%` }} />
                    </div>
                  </article>
                ))}
              </div>

              <div className="intel-board-callout">
                <strong>Why this matters</strong>
                <p>The composite is never shown without its parts. Management can see whether weakness is coming from evidence, risk closure, recommendation quality, or decision behavior.</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="intel-enterprise-right">
          <div className="intel-panel">
            <div className="intel-section-head">
              <div>
                <span className="intel-eyebrow"><AlertTriangle size={14} /> Company Risk & Attention</span>
                <h2>Priority feed</h2>
              </div>
            </div>
            <div className="intel-summary-list">
              {priorityFeed.length ? priorityFeed.map((item: any) => (
                <article key={item.id} className="intel-summary-item">
                  <div className="intel-inline-list">
                    <strong>{item.title}</strong>
                    <span className="intel-pill" data-tone={badgeTone(item.priority || item.tone || 'high')}>
                      {item.priority || item.impact || item.tone}
                    </span>
                  </div>
                  <p>{item.description || item.evidence || item.narrative}</p>
                  <small>{item.ifNoAction || item.why || 'No further consequence statement available.'}</small>
                </article>
              )) : <EmptyState icon="O" message="No critical attention item is available." />}
            </div>
          </div>

          <div className="intel-panel">
            <div className="intel-section-head">
              <div>
                <span className="intel-eyebrow"><Sparkles size={14} /> Recommended Actions</span>
                <h2>What management should do next</h2>
              </div>
            </div>
            <div className="intel-recommendation-stack">
              {data.aiRecommendations?.length ? data.aiRecommendations.slice(0, 4).map((item: any) => (
                <article key={item.id} className="intel-recommendation-card">
                  <div className="intel-inline-list">
                    <span className="intel-mini-badge" data-tone={badgeTone(item.priority)}>{item.priority}</span>
                    <span className="intel-mini-badge" data-tone={item.sourceType === 'record' ? 'info' : 'warn'}>
                      {item.sourceType === 'record' ? 'Recommendation record' : 'Derived action'}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.why}</p>
                  <div className="intel-callout">
                    <strong>Suggested action:</strong> {item.recommendedAction}
                  </div>
                  <small>
                    {item.confidence != null ? `Confidence ${formatPercent(item.confidence)}. ` : ''}
                    If ignored: {item.riskIfIgnored}
                  </small>
                </article>
              )) : <EmptyState icon="O" message="No defendable recommendation could be formed from the current records." />}
            </div>
          </div>
        </aside>
      </section>

      <section className="intel-section intel-enterprise-panels">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><Building2 size={14} /> Department / Organization Intelligence</span>
              <h2>Where structure is helping or hurting execution</h2>
            </div>
          </div>
          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>People</th>
                  <th>Leader</th>
                  <th>Capability assignments</th>
                  <th>Attention</th>
                </tr>
              </thead>
              <tbody>
                {data.workforceDepartment?.attention?.length ? data.workforceDepartment.attention.map((row: any) => (
                  <tr key={row.departmentId}>
                    <td>{row.departmentName}</td>
                    <td>{formatNumber(row.peopleCount)}</td>
                    <td>{row.hasLeader ? 'Mapped' : 'Missing'}</td>
                    <td>{formatNumber(row.capabilityAssignments)}</td>
                    <td>
                      <span className="intel-pill" data-tone={badgeTone(row.attentionLabel === 'Needs attention' ? 'high' : row.attentionLabel === 'Watch' ? 'pending' : 'active')}>
                        {row.attentionLabel}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>Insufficient data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><Users size={14} /> Workforce & Capability Intelligence</span>
              <h2>Coverage, gaps, and critical skill exposure</h2>
            </div>
          </div>
          <div className="intel-workforce-cards">
            <article className="intel-status-card" data-tone={badgeTone(data.workforceDepartment?.peopleWithoutDepartment > 0 ? 'high' : 'completed')}>
              <span className="intel-kpi-label">People Without Department</span>
              <strong>{formatNumber(data.workforceDepartment?.peopleWithoutDepartment)}</strong>
            </article>
            <article className="intel-status-card" data-tone={badgeTone(data.workforceDepartment?.departmentsWithoutLeaders > 0 ? 'high' : 'completed')}>
              <span className="intel-kpi-label">Departments Without Leaders</span>
              <strong>{formatNumber(data.workforceDepartment?.departmentsWithoutLeaders)}</strong>
            </article>
            <article className="intel-status-card" data-tone="good">
              <span className="intel-kpi-label">Capability Coverage</span>
              <strong>{data.capabilityWorkforce?.capabilityCoverage != null ? formatPercent(data.capabilityWorkforce.capabilityCoverage) : 'Insufficient data'}</strong>
            </article>
          </div>

          <div className="intel-summary-list" style={{ marginTop: 16 }}>
            {data.capabilityWorkforce?.attention?.length ? data.capabilityWorkforce.attention.map((row: any) => (
              <article key={row.capabilityId} className="intel-summary-item">
                <div className="intel-inline-list">
                  <strong>{row.capabilityName}</strong>
                  <span className="intel-pill" data-tone={badgeTone(row.attentionLabel === 'Critical gap' ? 'critical' : row.attentionLabel === 'Unassigned' ? 'high' : 'active')}>
                    {row.attentionLabel}
                  </span>
                </div>
                <p>Criticality {row.criticality}. {formatNumber(row.assignmentCount)} active assignment(s).</p>
              </article>
            )) : <EmptyState icon="O" message="Capability coverage details are not available." />}
          </div>
        </div>
      </section>

      <section className="intel-section intel-enterprise-panels">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><ShieldAlert size={14} /> Signals, Decisions, and Loop Continuity</span>
              <h2>Where the intelligence loop is breaking</h2>
            </div>
          </div>

          <div className="intel-loop-grid">
            {data.loopContinuity?.stages?.map((stage: any) => (
              <article key={stage.key} className="intel-loop-stage">
                <span className="intel-kpi-label">{stage.label}</span>
                <strong>{formatNumber(stage.count)}</strong>
                <small>{stage.conversionRate != null ? `${formatPercent(stage.conversionRate)} from previous stage` : 'Start of loop'}</small>
              </article>
            ))}
          </div>

          <div className="intel-board-callout" style={{ marginTop: 16 }}>
            <strong>Weakest continuity point</strong>
            <p>
              {data.loopContinuity?.weakestStage
                ? `${data.loopContinuity.weakestStage.label} is the weakest visible conversion point at ${formatPercent(data.loopContinuity.weakestStage.conversionRate)}.`
                : 'Not enough loop data is available yet.'}
            </p>
          </div>

          <div className="intel-summary-columns" style={{ marginTop: 16 }}>
            <div>
              <h3 className="intel-subsection-title">Signals & evidence</h3>
              <ul className="intel-list">
                <li>{formatNumber(data.signalsEvidence?.signalsTotal)} total signals</li>
                <li>{formatNumber(data.signalsEvidence?.evidenceTotal)} evidence records</li>
                <li>{data.signalsEvidence?.averageEvidenceConfidence != null ? `${formatPercent(data.signalsEvidence.averageEvidenceConfidence)} average evidence confidence` : 'Average evidence confidence unavailable'}</li>
                <li>{formatNumber(data.signalsEvidence?.staleEvidence)} stale evidence records</li>
              </ul>
            </div>
            <div>
              <h3 className="intel-subsection-title">Decision intelligence</h3>
              <ul className="intel-list">
                <li>{formatNumber(data.decisionIntelligence?.pendingDecisions)} pending decisions</li>
                <li>{formatNumber(data.decisionIntelligence?.approvedDecisions)} approved decisions</li>
                <li>{formatNumber(data.decisionIntelligence?.pendingRecommendations)} pending recommendations</li>
                <li>{data.decisionIntelligence?.averageDecisionAgeDays != null ? `${data.decisionIntelligence.averageDecisionAgeDays} day average decision age` : 'Average decision age unavailable'}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><TrendingUp size={14} /> Risks, Outcomes, and Learnings</span>
              <h2>What is being proved in operations</h2>
            </div>
          </div>

          <div className="intel-summary-list">
            {data.recentOutcomes?.length ? data.recentOutcomes.map((item: any) => (
              <article key={item.id} className="intel-summary-item">
                <div className="intel-inline-list">
                  <strong>{item.title}</strong>
                  <span className="intel-pill" data-tone={badgeTone(item.result)}>{item.result}</span>
                </div>
                <p>{item.confidence != null ? `Confidence ${formatPercent(item.confidence)}` : 'Confidence unavailable'}</p>
                <small>{formatDateTime(item.createdDate)}</small>
              </article>
            )) : <EmptyState icon="O" message="No recent outcome intelligence is available." />}
          </div>

          <div className="intel-summary-list" style={{ marginTop: 16 }}>
            {data.reusableLearnings?.length ? data.reusableLearnings.slice(0, 4).map((item: any) => (
              <article key={item.id} className="intel-summary-item">
                <div className="intel-inline-list">
                  <strong>{item.pattern}</strong>
                  <span className="intel-mini-badge" data-tone="good">
                    {item.confidence != null ? formatPercent(item.confidence) : 'Insufficient data'}
                  </span>
                </div>
                <p>{item.description || 'No learning description recorded.'}</p>
              </article>
            )) : <EmptyState icon="O" message="No reusable learnings have been recorded yet." />}
          </div>
        </div>
      </section>

      <section className="intel-section intel-enterprise-panels">
        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Board Ask</span>
              <h2>What leadership should decide next</h2>
            </div>
          </div>
          <div className="intel-board-callout">
            <strong>{data.boardAsk?.headline || 'No current board ask is available.'}</strong>
            <p>
              {data.boardAsk?.continuityRisk
                ? `${data.boardAsk.continuityRisk.label} is currently the weakest point in the intelligence loop at ${formatPercent(data.boardAsk.continuityRisk.conversionRate)} conversion.`
                : 'Not enough continuity data is available yet.'}
            </p>
          </div>
          <div className="intel-recommendation-stack" style={{ marginTop: 16 }}>
            {data.boardAsk?.topActions?.length ? data.boardAsk.topActions.map((item: any) => (
              <article key={item.id} className="intel-recommendation-card">
                <div className="intel-inline-list">
                  <span className="intel-mini-badge" data-tone={badgeTone(item.priority)}>{item.priority}</span>
                  {item.confidence != null && (
                    <span className="intel-mini-badge" data-tone="info">{formatPercent(item.confidence)}</span>
                  )}
                </div>
                <h3>{item.title}</h3>
                <p>{item.why}</p>
              </article>
            )) : <EmptyState icon="O" message="No board-ready action request is available from the current records." />}
          </div>
        </div>

        <div className="intel-panel">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow"><Sparkles size={14} /> Data Trust</span>
              <h2>Reliability of current intelligence</h2>
            </div>
          </div>
          <div className="intel-summary-list">
            {[
              ['Completeness', data.dataTrust?.completeness != null ? formatPercent(data.dataTrust.completeness) : 'Insufficient data'],
              ['Missing employee department', formatNumber(data.dataTrust?.missingEmployeeDepartment)],
              ['Missing department leadership', formatNumber(data.dataTrust?.missingDepartmentLeadership)],
              ['Missing capability mapping', formatNumber(data.dataTrust?.missingCapabilityMapping)],
              ['Stale evidence', formatNumber(data.dataTrust?.staleEvidence)],
              ['Failed imports', formatNumber(data.dataTrust?.failedImports)],
              ['Rejected rows', formatNumber(data.dataTrust?.rejectedRows)],
              ['Last refresh', formatDateTime(data.dataTrust?.lastRefresh)],
            ].map(([label, value]) => (
              <article key={String(label)} className="intel-summary-item">
                <strong>{label}</strong>
                <p>{value}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LedgerPanel({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: any[] | undefined;
  emptyMessage: string;
}) {
  return (
    <div className="intel-ledger-panel">
      <h3 className="intel-subsection-title">{title}</h3>
      <div className="intel-summary-list">
        {items?.length ? items.map((item: any) => (
          <article key={item.id} className="intel-summary-item">
            <div className="intel-inline-list">
              <strong>{item.title}</strong>
              <span className="intel-pill" data-tone={badgeTone(item.source === 'outcome' ? 'completed' : 'high')}>
                {formatMetricValue(item.value)}
              </span>
            </div>
            <p>{item.why}</p>
            <small>{item.confidence != null ? `Confidence ${formatPercent(item.confidence)}.` : 'Confidence unavailable.'}</small>
          </article>
        )) : <EmptyState icon="O" message={emptyMessage} />}
      </div>
    </div>
  );
}

function humanizeKey(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function formatTrendLatest(series: Array<{ value: number | null }>) {
  const latest = [...series].reverse().find((item) => item.value != null);
  return latest?.value != null ? formatNumber(latest.value) : 'Insufficient data';
}

function formatMetricValue(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? formatDecimal(numeric, Math.abs(numeric) >= 100 ? 0 : 1) : 'Insufficient data';
}
