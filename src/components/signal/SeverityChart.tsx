import { useTheme } from '../../hooks/useTheme';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SeverityChartProps {
  data: Record<string, number>;
  title?: string;
}

const COLORS: Record<string, string> = {
  low: 'var(--status-good)',
  medium: 'var(--status-warn)',
  high: 'var(--status-warn)',
  critical: 'var(--status-crit)',
  unknown: 'var(--content-tertiary)',
};

export default function SeverityChart({ data, title = 'Severity Distribution' }: SeverityChartProps) {
  const theme = useTheme();
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: theme.text }}>{title}</h3>
      {chartData.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: 13, padding: 16, textAlign: 'center' }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ name, percent }: any) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: theme.textMuted }}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] || 'var(--content-tertiary)'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8 }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
