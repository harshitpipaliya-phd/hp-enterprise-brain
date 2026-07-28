import { useState, useEffect } from 'react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { reasoningEngineApi } from '../../api/reasoning-engine';
import { notificationApi } from '../../api/notification';
import { aiApi } from '../../api/ai';
import { taskApi } from '../../api/task';
import { useTheme } from '../../hooks/useTheme';
import { LoadingState, ErrorState } from '../shared/States';
import type { View } from '../../App';

interface CommandCenterProps {
  tenantId: string;
  onNavigate: (view: View) => void;
}

/**
 * Command Center — single pane of glass. Composes data already served by
 * existing, already-tested endpoints into one view. No new backend logic —
 * every number here is something another screen already computes
 * correctly; this brings them together with quick navigation.
 */
export default function CommandCenter({ tenantId, onNavigate }: CommandCenterProps) {
  const theme = useTheme();
  const [summary, setSummary] = useState<any>(null);
  const [missingEvidence, setMissingEvidence] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [aiExecutions, setAiExecutions] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      decisionIntelligenceApi.getExecutiveSummary(tenantId),
      reasoningEngineApi.missingEvidence(tenantId),
      reasoningEngineApi.duplicateSignals(tenantId),
      notificationApi.unreadCount(tenantId),
      aiApi.executions(tenantId),
      aiApi.providers(),
      taskApi.listRegistry(),
    ])
      .then(([summaryRes, missingRes, dupRes, unreadRes, execRes, providerRes, tasksRes]) => {
        setSummary(summaryRes);
        setMissingEvidence(missingRes.count);
        setDuplicates(dupRes.count);
        setUnreadNotifications(unreadRes.count);
        setAiExecutions(execRes.slice(0, 5));
        setProviders(providerRes.providers);
        setTaskCount(tasksRes.length);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <LoadingState label="Loading command center..." />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return null;

  const configuredProviders = providers.filter((p) => p.available).length;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 4 }}>Command Center</h1>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>Everything in one view — click any card to go to its full screen.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Card theme={theme} onClick={() => onNavigate('executive')} label="Intelligence Score" value={String(summary.intelligenceScore.score)}
          color={summary.intelligenceScore.score >= 70 ? '#22c55e' : summary.intelligenceScore.score >= 40 ? '#f59e0b' : '#ef4444'} />
        <Card theme={theme} onClick={() => onNavigate('executive')} label="Pending Recommendations" value={String(summary.pendingRecommendations.length)} />
        <Card theme={theme} onClick={() => onNavigate('executive')} label="Open Decisions" value={String(summary.openDecisionsCount)} />
        <Card theme={theme} onClick={() => onNavigate('executive')} label="Top Risks" value={String(summary.topRisks.length)} color={summary.topRisks.length > 0 ? '#ef4444' : undefined} />
        <Card theme={theme} onClick={() => onNavigate('executive')} label="Data Quality Alerts" value={String(missingEvidence + duplicates)} color={(missingEvidence + duplicates) > 0 ? '#f59e0b' : '#22c55e'} />
        <Card theme={theme} label="Unread Notifications" value={String(unreadNotifications)} />
        <Card theme={theme} onClick={() => onNavigate('aiworkspace')} label="AI Providers Configured" value={`${configuredProviders}/${providers.length}`} color={configuredProviders > 0 ? '#22c55e' : theme.textMuted} />
        <Card theme={theme} onClick={() => onNavigate('tasks')} label="Available Tasks" value={String(taskCount)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Top Risks</span>
            <button onClick={() => onNavigate('executive')} style={{ fontSize: 11 }}>View all →</button>
          </h3>
          {summary.topRisks.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: 13 }}>No risks assessed yet.</p>
          ) : summary.topRisks.slice(0, 4).map((r: any) => (
            <div key={r.id} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, marginBottom: 6, fontSize: 12 }}>
              <span style={{ textTransform: 'uppercase', color: theme.textMuted }}>{r.category}</span> — Score: {r.score}
            </div>
          ))}
        </div>
        <div>
          <h3 style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Recent AI Activity</span>
            <button onClick={() => onNavigate('aiworkspace')} style={{ fontSize: 11 }}>View all →</button>
          </h3>
          {aiExecutions.length === 0 ? (
            <p style={{ color: theme.textMuted, fontSize: 13 }}>No AI executions yet.</p>
          ) : aiExecutions.map((e: any) => (
            <div key={e.id} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, marginBottom: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>{e.serviceName}</span>
              <span style={{ color: e.status === 'success' ? '#22c55e' : e.status === 'not_configured' ? theme.textMuted : '#ef4444' }}>{e.status}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: 11, color: theme.textMuted }}>Press Ctrl+K / Cmd+K anywhere to jump to any screen directly.</p>
    </div>
  );
}

function Card({ label, value, theme, onClick, color }: { label: string; value: string; theme: ReturnType<typeof useTheme>; onClick?: () => void; color?: string }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}`, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: color ?? theme.text }}>{value}</div>
    </div>
  );
}
