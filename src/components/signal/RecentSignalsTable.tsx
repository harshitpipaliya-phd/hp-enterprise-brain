import { useTheme } from '../../hooks/useTheme';
import type { Signal } from '../signal/SignalDashboard';

interface RecentSignalsTableProps {
  signals: Signal[];
  onAdvance: (signal: Signal, status: Signal['status']) => void;
  loading?: boolean;
}

const SEVERITY_COLOR: Record<string, { bg: string; text: string }> = {
  low: { bg: 'rgba(34,197,94,0.10)', text: 'var(--status-good)' },
  medium: { bg: 'rgba(245,158,11,0.10)', text: 'var(--status-warn)' },
  high: { bg: 'var(--feedback-warning-surface)', text: 'var(--chart-3)' },
  critical: { bg: 'var(--feedback-error-surface)', text: 'var(--feedback-error-content)' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: 'rgba(59,130,246,0.10)', text: 'var(--chart-1)' },
  triaged: { bg: 'var(--feedback-warning-surface)', text: 'var(--chart-4)' },
  investigating: { bg: 'var(--feedback-info-surface)', text: 'var(--chart-5)' },
  evidenced: { bg: 'var(--action-subtle)', text: 'var(--accent-intelligence-deep)' },
  resolved: { bg: 'rgba(34,197,94,0.10)', text: 'var(--status-good)' },
  dismissed: { bg: 'var(--surface-inset)', text: 'var(--content-secondary)' },
};

export default function RecentSignalsTable({ signals, onAdvance, loading }: RecentSignalsTableProps) {
  const theme = useTheme();

  if (loading) {
    return <div style={{ color: theme.textMuted, padding: 24, textAlign: 'center' }}>Loading signals...</div>;
  }

  if (signals.length === 0) {
    return <div style={{ color: theme.textMuted, padding: 24, textAlign: 'center' }}>No signals detected yet.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            {['Source', 'Severity', 'Confidence', 'Classification', 'Related To', 'Status', 'Detected', 'Actions'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => {
            const sev = SEVERITY_COLOR[s.severity] || SEVERITY_COLOR.low;
            const sts = STATUS_COLORS[s.status] || STATUS_COLORS.new;
            return (
              <tr key={s.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{s.source}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, backgroundColor: sev.bg, color: sev.text }}>
                    {s.severity}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{Math.round((s.confidence ?? 0) * 100)}%</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{s.classification || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>
                  {s.relatedEntityType ? `${s.relatedEntityType}:${s.relatedEntityId}` : '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, backgroundColor: sts.bg, color: sts.text }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                  {new Date(s.createdDate).toLocaleString()}
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  {s.status === 'new' && (
                    <button onClick={() => onAdvance(s, 'triaged')} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, cursor: 'pointer', fontSize: 12 }}>
                      Triage
                    </button>
                  )}
                  {s.status !== 'dismissed' && s.status !== 'resolved' && (
                    <button onClick={() => onAdvance(s, 'dismissed')} style={{ marginLeft: 6, padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, cursor: 'pointer', fontSize: 12 }}>
                      Dismiss
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
