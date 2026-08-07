import { useTheme } from '../../hooks/useTheme';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MTTRChartProps {
  data: Array<{ date: string; count: number }>;
  title?: string;
}

export default function MTTRChart({ data, title = 'Resolution Trend' }: MTTRChartProps) {
  const theme = useTheme();

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: theme.text }}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis
            dataKey="date"
            stroke={theme.textMuted}
            tick={{ fontSize: 11, fill: theme.textMuted }}
            tickFormatter={(v: string) => {
              const d = new Date(v + 'T00:00:00');
              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis stroke={theme.textMuted} allowDecimals={false} tick={{ fontSize: 11, fill: theme.textMuted }} />
          <Tooltip
            contentStyle={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8 }}
            labelFormatter={(v: any) => new Date(String(v) + 'T00:00:00').toLocaleDateString()}
            formatter={(value: any) => [value, 'Resolved']}
          />
          <Bar dataKey="hours" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
