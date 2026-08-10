import { useTheme } from '../../hooks/useTheme';

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  metric?: number;
}

interface InsightsPanelProps {
  insights: Insight[];
}

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  low: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: 'var(--status-good)' },
  medium: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: 'var(--status-warn)' },
  high: { bg: 'var(--feedback-error-surface)', border: 'var(--feedback-error-border)', text: 'var(--feedback-error-content)' },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  const theme = useTheme();

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: theme.text }}>Executive Insights</h3>
      {insights.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: 13, padding: 16, textAlign: 'center' }}>No insights available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((insight) => {
            const colors = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.low;
            return (
              <div
                key={insight.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 2 }}>{insight.title}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.4 }}>{insight.description}</div>
                {insight.metric !== undefined && (
                  <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, marginTop: 4 }}>{insight.metric}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
