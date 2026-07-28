import { useState, useEffect } from 'react';
import { kasbaApi } from '../../api/kasba';
import { api as capabilityApi } from '../../api/capability';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../Toast';

interface HeatmapCell {
  capabilityId: string;
  departmentId: string | null;
  averageLevel: number;
  assessedCount: number;
}
interface Capability { id: string; name: string; capabilityCode: string }
interface CapabilityTask {
  id: string;
  parentTaskId: string | null;
  name: string;
  description: string | null;
  evidenceRequired: boolean;
}

/**
 * KASBA Explorer. Closes the two real gaps named in the completion audit:
 * the org-wide heatmap had zero UI despite being real and tested, and the
 * Task hierarchy had zero UI and zero consumer anywhere in the codebase.
 * Deliberately does not include anything resembling individual ranking —
 * the heatmap endpoint itself is privacy-checked by test to never expose
 * a person-identifiable number, and this screen doesn't work around that.
 */
export default function KasbaExplorer({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const { showToast } = useToast();
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<CapabilityTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskEvidenceRequired, setTaskEvidenceRequired] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([kasbaApi.heatmap(tenantId), capabilityApi.listCapabilities(tenantId)])
      .then(([hm, caps]) => { setHeatmap(hm); setCapabilities(caps); })
      .catch((e: any) => showToast('error', e.message))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const capabilityName = (id: string) => capabilities.find((c) => c.id === id)?.name ?? id;

  const loadTasks = async (capabilityId: string) => {
    setSelectedCapabilityId(capabilityId);
    setTasksLoading(true);
    try {
      setTasks(await kasbaApi.tasksForCapability(tenantId, capabilityId));
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setTasksLoading(false);
    }
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCapabilityId) return;
    try {
      await kasbaApi.createTask({
        tenantId, capabilityId: selectedCapabilityId, name: taskName,
        description: taskDescription || undefined, evidenceRequired: taskEvidenceRequired,
        parentTaskId: parentTaskId ?? undefined,
      });
      showToast('success', 'Task added');
      setTaskName(''); setTaskDescription(''); setTaskEvidenceRequired(false); setParentTaskId(null); setShowTaskForm(false);
      await loadTasks(selectedCapabilityId);
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const levelColor = (level: number) => level >= 4 ? '#22c55e' : level >= 2.5 ? '#f59e0b' : '#ef4444';
  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const subTasksOf = (parentId: string) => tasks.filter((t) => t.parentTaskId === parentId);

  if (loading) return <div style={{ padding: 24 }}>Loading KASBA data...</div>;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 4 }}>KASBA Explorer</h1>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Organization-wide capability heatmap and task decomposition. Department-level aggregates only — no individual is ever identifiable from this screen.
      </p>

      <h3>Capability Heatmap</h3>
      {heatmap.length === 0 ? (
        <p style={{ color: theme.textMuted, marginBottom: 24 }}>No assessed capabilities yet — this fills in as real proficiency assessments are recorded.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          {heatmap.map((cell, i) => (
            <div
              key={i}
              onClick={() => loadTasks(cell.capabilityId)}
              style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${levelColor(cell.averageLevel)}`, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <strong>{capabilityName(cell.capabilityId)}</strong>
                {cell.departmentId && <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 8 }}>dept: {cell.departmentId}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: levelColor(cell.averageLevel) }}>{cell.averageLevel}/5</div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{cell.assessedCount} assessed</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3>Capability Task Browser</h3>
      <select
        value={selectedCapabilityId ?? ''}
        onChange={(e) => e.target.value && loadTasks(e.target.value)}
        style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text, marginBottom: 16, width: '100%' }}
      >
        <option value="">Select a capability to view its tasks...</option>
        {capabilities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.capabilityCode})</option>)}
      </select>

      {selectedCapabilityId && (
        <>
          <button onClick={() => setShowTaskForm((s) => !s)} style={{ marginBottom: 12 }}>{showTaskForm ? 'Cancel' : '+ Add Task'}</button>
          {showTaskForm && (
            <form onSubmit={submitTask} style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, marginBottom: 16, display: 'grid', gap: 8 }}>
              <input placeholder="Task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
              <textarea placeholder="Description (optional)" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, minHeight: 60 }} />
              <select value={parentTaskId ?? ''} onChange={(e) => setParentTaskId(e.target.value || null)} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
                <option value="">Top-level task</option>
                {topLevelTasks.map((t) => <option key={t.id} value={t.id}>Sub-task of: {t.name}</option>)}
              </select>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={taskEvidenceRequired} onChange={(e) => setTaskEvidenceRequired(e.target.checked)} />
                Evidence required for this task
              </label>
              <button type="submit">Save Task</button>
            </form>
          )}

          {tasksLoading ? (
            <div>Loading tasks...</div>
          ) : topLevelTasks.length === 0 ? (
            <p style={{ color: theme.textMuted }}>No tasks defined yet for this capability.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {topLevelTasks.map((t) => (
                <div key={t.id} style={{ padding: 10, borderRadius: 6, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{t.name}</strong>
                    {t.evidenceRequired && <span style={{ fontSize: 10, color: theme.textMuted }}>evidence required</span>}
                  </div>
                  {t.description && <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>{t.description}</p>}
                  {subTasksOf(t.id).length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: `2px solid ${theme.border}` }}>
                      {subTasksOf(t.id).map((sub) => (
                        <div key={sub.id} style={{ fontSize: 12, padding: '4px 0' }}>↳ {sub.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
