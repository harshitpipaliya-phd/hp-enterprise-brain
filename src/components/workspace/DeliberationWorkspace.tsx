import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Scale } from 'lucide-react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { EmptyState, ErrorState, LoadingState } from '../shared/States';
import { badgeTone, formatDateTime, formatNumber, formatPercent } from './intelligenceShared';
import './IntelligenceSuite.css';

type DeliberationOverview = any;

export default function DeliberationWorkspace({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<DeliberationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const load = async ({ background = false } = {}) => {
    const useBackgroundRefresh = background || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const overview = await decisionIntelligenceApi.getDeliberationOverview(tenantId, 1, 8);
      setData(overview);
      setSelectedCaseId((current) => current ?? overview?.focus?.selectedCaseId ?? overview?.cases?.items?.[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load deliberation workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const selectedCase = useMemo(() => {
    if (!data) return null;
    const fallbackId = selectedCaseId ?? data.focus?.selectedCaseId ?? data.cases?.items?.[0]?.id ?? null;
    if (!fallbackId) return null;
    return data.cases?.detailsById?.[fallbackId] ?? null;
  }, [data, selectedCaseId]);

  if (loading && !data) return <LoadingState label="Loading deliberation workspace..." />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="intel-page intel-deliberation">
      <header className="intel-header intel-deliberation-header">
        <div>
          <span className="intel-eyebrow"><Scale size={14} /> Investigation Workbench</span>
          <h1>Deliberation Workspace</h1>
          <p>Investigate signals, test hypotheses, and make evidence-backed decisions from one tenant-scoped intelligence stream.</p>
          <div className="intel-meta">
            <div className="intel-meta-card">
              <span>Organization</span>
              <strong>{data.organization?.name || 'Organization'}</strong>
              <small>Current tenant scope</small>
            </div>
            <div className="intel-meta-card">
              <span>Pending Decisions</span>
              <strong>{formatNumber(data.summary?.pendingDecisions)}</strong>
              <small>Waiting for governance attention</small>
            </div>
            <div className="intel-meta-card">
              <span>Refresh</span>
              <strong><button type="button" onClick={() => load({ background: true })}><RefreshCw size={15} /> Refresh</button></strong>
              <small>{refreshing ? 'Updating investigations...' : 'Reload only this workspace'}</small>
            </div>
          </div>
        </div>

        <div className="intel-score-card">
          <span className="intel-subtle">Current Bottleneck</span>
          <strong>{data.focus?.biggestBottleneck?.label || 'Insufficient data'}</strong>
          <p>
            {data.focus?.biggestBottleneck?.conversionRate != null
              ? `${formatPercent(data.focus.biggestBottleneck.conversionRate)} conversion from the previous stage`
              : 'No complete stage conversion metric is available yet.'}
          </p>
          {refreshing && <div className="intel-refresh-chip" data-variant="deliberation">Refreshing case intelligence...</div>}
        </div>
      </header>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">Deliberation Health</span>
            <h2>Active investigation posture</h2>
          </div>
        </div>
        <div className="intel-stat-grid">
          {[
            ['Open Cases', data.summary?.openCases, 'Cases not yet resolved'],
            ['Active Investigations', data.summary?.activeInvestigations, 'Still being worked'],
            ['Pending Recommendations', data.summary?.pendingRecommendations, 'Waiting for decision'],
            ['Pending Decisions', data.summary?.pendingDecisions, 'Governance queue'],
            ['Average Decision Age', data.summary?.averageDecisionAgeDays != null ? `${data.summary.averageDecisionAgeDays} days` : 'Insufficient data', 'Open decisions only'],
            ['Evidence Coverage', data.summary?.evidenceCoverage != null ? formatPercent(data.summary.evidenceCoverage) : 'Insufficient data', 'Open cases with linked evidence'],
            ['High/Critical Risks', data.summary?.highCriticalRisks, 'Transparent threshold: score >= 0.50'],
            ['Overdue Decisions', data.summary?.overdueDecisions ?? 'Insufficient data', data.summary?.overdueDecisionNote || 'No due-date model exposed'],
          ].map(([label, value, note]) => (
            <article key={String(label)} className="intel-kpi" data-tone={badgeTone(String(label).includes('Risk') ? 'high' : label === 'Evidence Coverage' ? 'active' : 'pending')}>
              <span className="intel-kpi-label">{label}</span>
              <div className="intel-kpi-value">{typeof value === 'number' ? formatNumber(value) : value}</div>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="intel-section intel-deliberation-shell">
        <div className="intel-case-list">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Case Explorer</span>
              <h2>Investigations</h2>
            </div>
          </div>
          {data.cases?.items?.length ? data.cases.items.map((item: any) => (
            <button
              type="button"
              key={item.id}
              className={`intel-case-row ${selectedCaseId === item.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedCaseId(item.id)}
            >
              <div className="intel-inline-list">
                <strong>{item.title}</strong>
                <span className="intel-pill" data-tone={badgeTone(item.severity || item.status)}>{item.severity || item.status}</span>
              </div>
              <div className="intel-case-grid">
                <span>Status: {item.status || 'Insufficient data'}</span>
                <span>Evidence: {formatNumber(item.evidenceCount)}</span>
                <span>Age: {item.ageDays != null ? `${item.ageDays} days` : 'Insufficient data'}</span>
                <span>Confidence: {item.confidence != null ? formatPercent(item.confidence) : 'Insufficient data'}</span>
              </div>
              <small>{item.currentHypothesis?.statement || item.nextAction}</small>
            </button>
          )) : <EmptyState icon="○" message="No cases are available for this organization yet." />}
        </div>

        <div className="intel-case-detail">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Case Intelligence</span>
              <h2>{selectedCase?.summary?.title || 'Select a case'}</h2>
              <p>{selectedCase?.summary?.status ? `Status: ${selectedCase.summary.status}` : 'Choose a case to inspect its evidence, hypotheses, reasoning, and decision trail.'}</p>
            </div>
          </div>

          {selectedCase ? (
            <>
              <div className="intel-inline-list">
                <span className="intel-pill" data-tone={badgeTone(selectedCase.summary?.severity || selectedCase.summary?.status)}>{selectedCase.summary?.severity || selectedCase.summary?.status}</span>
                <span className="intel-pill" data-tone="info">{selectedCase.summary?.classification || 'Unclassified'}</span>
                <span className="intel-pill" data-tone="warn">{selectedCase.summary?.confidence != null ? formatPercent(selectedCase.summary.confidence) : 'Insufficient data'}</span>
              </div>

              <div className="intel-timeline">
                {selectedCase.timeline?.map((stage: any) => (
                  <div key={stage.stage} className="intel-timeline-stage">
                    <div className="intel-timeline-label">{stage.stage}</div>
                    <div className="intel-timeline-card">
                      {stage.items?.length ? stage.items.map((entry: any) => (
                        <div key={entry.id} className="intel-timeline-item">
                          <strong>{entry.title}</strong>
                          <div className="intel-inline-list">
                            <span className="intel-mini-badge" data-tone={badgeTone(entry.status)}>{entry.status}</span>
                            <small>{entry.confidence != null ? formatPercent(entry.confidence) : 'Insufficient data'}</small>
                            <small>{formatDateTime(entry.timestamp)}</small>
                          </div>
                        </div>
                      )) : <div className="intel-note">Insufficient data</div>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="○" message="No case detail is available yet." />
          )}
        </div>
      </section>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">Decision Queue</span>
            <h2>Requires attention</h2>
          </div>
        </div>
        <div className="intel-panel">
          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Related Case</th>
                  <th>Recommendation</th>
                  <th>Confidence</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Age</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.decisionQueue?.items?.length ? data.decisionQueue.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.decision || 'Decision'}</td>
                    <td>{item.caseId || 'Insufficient data'}</td>
                    <td>{item.recommendation || 'Insufficient data'}</td>
                    <td>{item.confidence != null ? formatPercent(item.confidence) : 'Insufficient data'}</td>
                    <td>{item.priority || 'Insufficient data'}</td>
                    <td>{item.owner || 'Insufficient data'}</td>
                    <td>{item.ageDays != null ? `${item.ageDays} days` : 'Insufficient data'}</td>
                    <td><span className="intel-pill" data-tone={badgeTone(item.status)}>{item.status}</span></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>No pending decisions require attention.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
