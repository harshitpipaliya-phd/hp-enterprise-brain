import { useTheme } from '../../hooks/useTheme';

export interface SummaryCard {
  label: string;
  value: string | number;
  tone?: 'default' | 'good' | 'warning' | 'danger';
  hint?: string;
}

interface SummaryCardsProps {
  items: SummaryCard[];
}

const TONE_COLORS: Record<string, { bg: string; text: string }> = {
  default: { bg: 'rgba(59,130,246,0.08)', text: 'var(--chart-1)' },
  good: { bg: 'rgba(34,197,94,0.08)', text: 'var(--status-good)' },
  warning: { bg: 'rgba(245,158,11,0.08)', text: 'var(--status-warn)' },
  danger: { bg: 'var(--feedback-error-surface)', text: 'var(--feedback-error-content)' },
};

export default function SummaryCards({ items }: SummaryCardsProps) {
  const theme = useTheme();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
      {items.map((item) => {
        const tone = TONE_COLORS[item.tone ?? 'default'];
        return (
          <div
            key={item.label}
            style={{
              padding: 16,
              borderRadius: 12,
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tone.text, lineHeight: 1.1 }}>{item.value}</div>
            {item.hint && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{item.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}
