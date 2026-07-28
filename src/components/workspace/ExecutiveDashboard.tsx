import { useState, useEffect } from 'react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { reasoningEngineApi } from '../../api/reasoning-engine';
import { useTheme } from '../../hooks/useTheme';

interface ExecutiveSummary {
  statistics: {
    decisions: { total: number; approved: number; rejected: number; acceptanceRate: number };
    recommendations: { total: number; byCategory: Record<string, number> };
    outcomes: { total: number; successful: number; recommendationAccuracy: number };
    risks: { total: number; open: number; byCategory: Record<string, number>; averageScore: number };
    evidenceQuality: number;
  };
  topRisks: Array<{ id: string; category: string; score: number; impact: string }>;
  organizationalKnowledge: Array<{ domain: string; confidence: number; reinforcementCount: number; patternCount: number }>;
  pendingRecommendations: Array<{ id: string; title: string; category: string; confidence: number; priority: string }>;
  openDecisionsCount: number;
  intelligenceScore: { score: number; breakdown: Record<string, number> };
}

const CATEGORY_COLOR: Record<string, string> = { risk: '#ef4444', opportunity: '#3b82f6', watch: '#f59e0b', compliance: '#8b5cf6' };

/**
 * Executive Dashboard (Sprint 10, scoped). Answers the questions an
 * executive actually asks in one screen using the executive-summary
 * endpoint that has existed since Sprint 5. No KPI Builder, no Dashboard
 * Builder, no drag-and-drop widgets, no PDF/Excel export — those are
 * separate products, not this screen.
 */
export default function ExecutiveDashboard({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [data, setData] = useState<ExecutiveSummary | null>(null);
  const [missingEvidenceCount, setMissingEvidenceCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [earlyWarningCount, setEarlyWarningCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await decisionIntelligenceApi.getExecutiveSummary(tenantId));
      const [missing, dupes, warnings] = await Promise.all([reasoningEngineApi.missingEvidence(tenantId), reasoningEngineApi.duplicateSignals(tenantId), reasoningEngineApi.earlyWarnings(tenantId)]);
      setMissingEvidenceCount(missing.count);
      setDuplicateCount(dupes.count);
      setEarlyWarningCount(warnings.count);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  if (loading) return <div style={{ padding: 24 }}>Loading executive summary...</div>;
  if (error) return <div style={{ padding: 24, color: '#ef4444' }}>Error: {error}</div>;
  if (!data) return <div style={{ padding: 24 }}>No data yet — nothing has moved through the loop for this tenant.</div>;

  const { statistics, topRisks, organizationalKnowledge, pendingRecommendations, openDecisionsCount, intelligenceScore } = data;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Executive Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Organizational Intelligence Score</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: intelligenceScore.score >= 70 ? '#22c55e' : intelligenceScore.score >= 40 ? '#f59e0b' : '#ef4444' }}>
              {intelligenceScore.score}
            </div>
          </div>
          <button onClick={load}>Refresh</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Stat theme={theme} label="Decision Acceptance Rate" value={`${Math.round(statistics.decisions.acceptanceRate * 100)}%`} />
        <Stat theme={theme} label="Recommendation Accuracy" value={`${Math.round(statistics.outcomes.recommendationAccuracy * 100)}%`} />
        <Stat theme={theme} label="Evidence Quality" value={`${Math.round(statistics.evidenceQuality * 100)}%`} />
        <Stat theme={theme} label="Open Decisions" value={String(openDecisionsCount)} />
        <Stat theme={theme} label="Open Risks" value={String(statistics.risks.open)} />
        <Stat theme={theme} label="Avg Risk Score" value={String(statistics.risks.averageScore)} />
      </div>

      <h2 style={{ marginBottom: 12 }}>Pending Recommendations — awaiting a decision</h2>
      {pendingRecommendations.length === 0 ? (
        <p style={{ color: theme.textMuted, marginBottom: 32 }}>Nothing pending.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          {pendingRecommendations.map((r) => (
            <div key={r.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${CATEGORY_COLOR[r.category] ?? theme.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span>{r.title}</span>
              <span style={{ color: theme.textMuted, fontSize: 12 }}>{r.category} · {Math.round(r.confidence * 100)}% confidence · {r.priority} priority</span>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>Top Risks</h2>
      {topRisks.length === 0 ? (
        <p style={{ color: theme.textMuted, marginBottom: 32 }}>No risks assessed yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {topRisks.map((r) => (
            <div key={r.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', color: theme.textMuted }}>{r.category}</div>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>Score: {r.score}</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Impact: {r.impact}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginBottom: 12 }}>Data Quality Alerts</h2>
      <p style={{ color: theme.textMuted, fontSize: 12, marginBottom: 12 }}>Deterministic checks — not AI-generated, algorithmic detection over real data.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${missingEvidenceCount > 0 ? '#f59e0b' : '#22c55e'}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>Signals Missing Evidence (3+ days old)</div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{missingEvidenceCount}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${duplicateCount > 0 ? '#f59e0b' : '#22c55e'}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>Likely Duplicate Signal Clusters</div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{duplicateCount}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${earlyWarningCount > 0 ? '#ef4444' : '#22c55e'}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>Early Warnings (high/critical, unaddressed)</div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>{earlyWarningCount}</div>
        </div>
      </div>

      <h2 style={{ marginBottom: 12 }}>Organizational Knowledge</h2>
      {organizationalKnowledge.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No reinforced Mental Models yet — this fills in as Learnings accumulate per domain.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Domain</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Confidence</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Reinforced</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Patterns</th>
            </tr>
          </thead>
          <tbody>
            {organizationalKnowledge.map((m) => (
              <tr key={m.domain}>
                <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{m.domain}</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{Math.round(m.confidence * 100)}%</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{m.reinforcementCount}×</td>
                <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{m.patternCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
