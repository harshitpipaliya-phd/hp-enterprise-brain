import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { API_BASE } from '../../api/client.js';
import { useTheme } from '../../hooks/useTheme';

interface DecisionIntelligenceData {
  pipeline: { pending: number; approved: number; rejected: number };
  averageDecisionLatencyHours: number | null;
  decisionsByExecutorType: Record<string, number>;
  categoryExecutorHeatmap: Record<string, Record<string, number>>;
}

const PIE_COLORS = ['#f59e0b', '#22c55e', '#ef4444'];

/**
 * Decision Intelligence (Sprint 10). First real interactive charts in this
 * project — recharts was genuinely not installed before. Pipeline (bar),
 * executor split (pie), category x executor heatmap (table — a true visual
 * heatmap needs a layout decision beyond what a table gives you).
 */
export default function DecisionIntelligence({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [data, setData] = useState<DecisionIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    decisionIntelligenceApi.getDecisionIntelligence(tenantId)
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const exportCsv = async () => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/analytics/${tenantId}/decisions/export.csv`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decisions-${tenantId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: 24 }}>Loading decision intelligence...</div>;
  if (error) return <div style={{ padding: 24, color: '#ef4444' }}>Error: {error}</div>;
  if (!data) return null;

  const pipelineChartData = [
    { name: 'Pending', value: data.pipeline.pending },
    { name: 'Approved', value: data.pipeline.approved },
    { name: 'Rejected', value: data.pipeline.rejected },
  ];
  const executorChartData = Object.entries(data.decisionsByExecutorType).map(([name, value]) => ({ name, value }));
  const categories = Object.keys(data.categoryExecutorHeatmap);
  const executorTypes = [...new Set(categories.flatMap((c) => Object.keys(data.categoryExecutorHeatmap[c])))];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Decision Intelligence</h1>
        <button onClick={exportCsv}>Export CSV</button>
      </header>

      <div style={{ marginBottom: 24 }}>
        <span style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}`, display: 'inline-block' }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>Average Decision Latency</div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{data.averageDecisionLatencyHours != null ? `${data.averageDecisionLatencyHours}h` : 'No data yet'}</div>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <h3>Decision Pipeline</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineChartData}>
              <XAxis dataKey="name" stroke={theme.textMuted} />
              <YAxis stroke={theme.textMuted} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3>Decisions by Executor Type</h3>
          {executorChartData.length === 0 ? (
            <p style={{ color: theme.textMuted }}>No decisions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={executorChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {executorChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <h3>Category × Executor Type</h3>
      {categories.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No decisions linked to recommendations yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Category</th>
              {executorTypes.map((t) => <th key={t} style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat}>
                <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{cat}</td>
                {executorTypes.map((t) => (
                  <td key={t} style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{data.categoryExecutorHeatmap[cat][t] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
