import { useState, useEffect } from 'react';
import { kasbaApi } from '../../api/kasba';
import { api as capabilityApi } from '../../api/capability';
import { KasbaBadge } from '../../components/rcl';
import { IntelligenceCard, type IntelligenceStatus } from '../../ui/intelligenceCard';
import { useToast } from '../Toast';

interface HeatmapCell {
  capabilityId: string;
  departmentId: string | null;
  averageLevel: number;
  assessedCount: number;
  /** Architecture Invariant 6. The WEAKEST state in the cell — see the API. */
  capabilityState?: string;
  unknownCount?: number;
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
      // The heatmap endpoint answers with an envelope: `cells` is the
      // per-(capability, department) grid this screen draws, alongside the
      // five-dimension roll-up it also publishes. Assigning the envelope
      // itself here is what made heatmap.map throw.
      .then(([hm, caps]) => { setHeatmap(Array.isArray(hm?.cells) ? hm.cells : []); setCapabilities(caps); })
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

  /**
   * The capability bands, named for IntelligenceCard.
   *
   * This replaces levelColor(), which returned a raw token string and had no
   * caller left once the cards stopped being hand-drawn.
   *
   * THRESHOLDS ARE UNCHANGED — 4.0 and 2.5, exactly as levelColor used — because
   * they are a judgement about capability, not a styling detail, and this change
   * is meant to restyle the card rather than move the line between "fine" and
   * "not fine".
   *
   * Two of the three hues are identical to what they replace: 'at-risk' resolves
   * to var(--status-warn) and 'critical' to var(--status-crit). Only the top
   * band shifts, from var(--status-good) to the card's teal — the one
   * documented divergence between the design prototype and the token set.
   * 'watch' is deliberately unused: inventing a fourth band here would change
   * what the screen asserts about a capability.
   */
  const levelStatus = (level: number): IntelligenceStatus =>
    level >= 4 ? 'healthy' : level >= 2.5 ? 'at-risk' : 'critical';

  /**
   * A level answers "how good". A state answers "how firmly do we know that"
   * (Architecture Invariant 6, Product Bible §5.7). Showing the number without
   * the state is what lets a self-assertion read as a measurement, so the badge
   * sits beside every level and Unknown is deliberately the loudest of them:
   * Pilot §A requires UNKNOWN shown honestly, not hidden behind a neutral grey.
   */
  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const subTasksOf = (parentId: string) => tasks.filter((t) => t.parentTaskId === parentId);

  if (loading) return <div style={{ padding: 24 }}>Loading KASBA data...</div>;

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1100, margin: '0 auto', padding: 24, backgroundColor: 'var(--surface-ground)', color: 'var(--content-primary)', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 4 }}>KASBA Explorer</h1>
      <p style={{ color: 'var(--content-tertiary)', marginBottom: 24, fontSize: 13 }}>
        Organization-wide capability heatmap and task decomposition. Department-level aggregates only — no individual is ever identifiable from this screen.
      </p>

      <h3>Capability Heatmap</h3>
      {heatmap.length === 0 ? (
        <p style={{ color: 'var(--content-tertiary)', marginBottom: 24 }}>No assessed capabilities yet — this fills in as real proficiency assessments are recorded.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          {/*
            IntelligenceCard replaces the hand-rolled card that stood here. The
            geometry is unchanged — it was copied from this pattern in the first
            place — and three things are deliberately carried across rather than
            lost in the swap:

              · KasbaBadge, in the card's `badge` slot. The level and the state
                answer different questions and both stay visible (see the note
                above levelStatus, and Invariant 6).
              · "N unknown" keeps its critical hue, which is why `meta` takes
                nodes and not strings.
              · The 4.0 / 2.5 thresholds are untouched.

            One real improvement comes free: the card renders a <button> when
            given onClick, so this list is now keyboard-reachable and shows a
            focus ring. The <div onClick> it replaces was neither.
          */}
          {heatmap.map((cell, i) => (
            <IntelligenceCard
              key={i}
              status={levelStatus(cell.averageLevel)}
              title={capabilityName(cell.capabilityId)}
              description={cell.departmentId ? `Department ${cell.departmentId}` : undefined}
              badge={<KasbaBadge state={cell.capabilityState ?? 'Unknown'} />}
              meta={[
                `${cell.averageLevel} / 5`,
                // "3 assessed" beside a Mastered badge would imply all three
                // were; the cell shows the weakest state precisely because they
                // were not. The original wording is kept verbatim.
                `${cell.assessedCount} assessed`,
                ...((cell.unknownCount ?? 0) > 0
                  ? [<span key="unknown" style={{ color: 'var(--status-crit)' }}>{cell.unknownCount} unknown</span>]
                  : []),
              ]}
              onClick={() => loadTasks(cell.capabilityId)}
            />
          ))}
        </div>
      )}

      <h3>Capability Task Browser</h3>
      <select
        value={selectedCapabilityId ?? ''}
        onChange={(e) => e.target.value && loadTasks(e.target.value)}
        style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)', color: 'var(--content-primary)', marginBottom: 16, width: '100%' }}
      >
        <option value="">Select a capability to view its tasks...</option>
        {capabilities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.capabilityCode})</option>)}
      </select>

      {selectedCapabilityId && (
        <>
          <button onClick={() => setShowTaskForm((s) => !s)} style={{ marginBottom: 12 }}>{showTaskForm ? 'Cancel' : '+ Add Task'}</button>
          {showTaskForm && (
            <form onSubmit={submitTask} style={{ padding: 16, borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)', marginBottom: 16, display: 'grid', gap: 8 }}>
              <input placeholder="Task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} required style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-ground)', color: 'var(--content-primary)' }} />
              <textarea placeholder="Description (optional)" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-ground)', color: 'var(--content-primary)', minHeight: 60 }} />
              <select value={parentTaskId ?? ''} onChange={(e) => setParentTaskId(e.target.value || null)} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-ground)', color: 'var(--content-primary)' }}>
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
            <p style={{ color: 'var(--content-tertiary)' }}>No tasks defined yet for this capability.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {topLevelTasks.map((t) => (
                <div key={t.id} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--content-primary)' }}>{t.name}</strong>
                    {t.evidenceRequired && <span style={{ fontSize: 10, color: 'var(--content-tertiary)' }}>evidence required</span>}
                  </div>
                  {t.description && <p style={{ fontSize: 12, color: 'var(--content-tertiary)', margin: '4px 0 0' }}>{t.description}</p>}
                  {subTasksOf(t.id).length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 16, borderLeft: `2px solid var(--border-default)` }}>
                      {subTasksOf(t.id).map((sub) => (
                        <div key={sub.id} style={{ fontSize: 12, padding: '4px 0', color: 'var(--content-secondary)' }}>↳ {sub.name}</div>
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
