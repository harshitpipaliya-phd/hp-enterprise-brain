import { useTheme } from '../../hooks/useTheme';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ArrivalChartProps {
  data: Array<{ date: string; count: number }>;
  title?: string;
}

export default function ArrivalChart({ data, title = 'Signal Arrival Trend' }: ArrivalChartProps) {
  const theme = useTheme();

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: theme.text }}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
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
          />
          <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
