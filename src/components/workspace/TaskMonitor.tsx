import { useState, useEffect } from 'react';
import { taskApi } from '../../api/task';
import { useTheme } from '../../hooks/useTheme';

interface TaskDef { name: string; description: string; category: string }
interface StepResult { taskName: string; status: 'completed' | 'failed'; output?: Record<string, unknown>; error?: string; attempts: number }

/**
 * Task Orchestrator Monitor. Real: pulls the actual Task Registry (5
 * deterministic tasks wrapping existing services), builds a sequence,
 * runs it, shows per-step results including retries and failures. Not
 * built: parallel/conditional execution, a scheduler, resource metrics.
 */
export default function TaskMonitor({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [registry, setRegistry] = useState<TaskDef[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ steps: StepResult[]; allSucceeded: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    taskApi.listRegistry().then(setRegistry).catch((e: any) => setError(e.message));
  }, []);

  const toggleTask = (name: string) => {
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
  };

  const run = async () => {
    if (selected.length === 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const steps = selected.map((taskName) => ({ taskName }));
      setResult(await taskApi.runSequence(tenantId, steps, false));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1000, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 8 }}>Task Orchestrator</h1>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Deterministic tasks wrapping existing services — not AI reasoning agents. Select tasks, run them in sequence, watch each step's real result.
      </p>

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}

      <h3>Task Registry</h3>
      <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
        {registry.map((t) => (
          <label key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.includes(t.name)} onChange={() => toggleTask(t.name)} />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 13 }}>{t.name} <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>{t.category}</span></div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{t.description}</div>
            </div>
          </label>
        ))}
      </div>

      <button onClick={run} disabled={running || selected.length === 0}>{running ? 'Running...' : `Run ${selected.length} Task(s)`}</button>

      {result && (
        <div style={{ marginTop: 24 }}>
          <h3>Execution Results — {result.allSucceeded ? '✅ All succeeded' : '⚠️ Some failed'}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {result.steps.map((s, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${s.status === 'completed' ? '#22c55e' : '#ef4444'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{s.taskName}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{s.attempts} attempt(s)</span>
                </div>
                {s.status === 'completed' ? (
                  <pre style={{ fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap' }}>{JSON.stringify(s.output, null, 2)}</pre>
                ) : (
                  <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{s.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
