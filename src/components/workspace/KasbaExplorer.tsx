import { useState, useEffect } from 'react';
import { kasbaApi } from '../../api/kasba';
import { api as capabilityApi } from '../../api/capability';
import { KasbaBadge } from '../../components/rcl';
import { IntelligenceCard, type IntelligenceStatus } from '../../ui/intelligenceCard';
import { useToast } from '../Toast';
import './kasba.css';

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

/**
 * The five-dimension roll-up the heatmap endpoint has always published and
 * this screen never drew. `average` is NULL — not 0 — when no assessment on
 * that dimension exists, and the renderer keeps it that way.
 */
interface DimensionSummary { assessed: number; average: number | null }

interface AssessmentModel {
  dimensions: string[];
  maxLevel: number;
  assessableEntityTypes?: string[];
  origin?: string;
}
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
export default function KasbaExplorer(
  { tenantId, organizationName }: { tenantId: string; organizationName?: string },
) {
  const { showToast } = useToast();
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);
  /* The roll-up and the tenant's own model, both straight from the API — the
     dimension list is NOT a constant here, so a four-dimension tenant renders
     four axes without a frontend change. */
  const [dimensions, setDimensions] = useState<Record<string, DimensionSummary>>({});
  const [model, setModel] = useState<AssessmentModel | null>(null);
  const [assignmentCount, setAssignmentCount] = useState(0);
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
      .then(([hm, caps]) => {
        setHeatmap(Array.isArray(hm?.cells) ? hm.cells : []);
        setDimensions(hm?.dimensions ?? {});
        setModel(hm?.model ?? null);
        setAssignmentCount(Number(hm?.assignments ?? 0));
        setCapabilities(Array.isArray(caps) ? caps : []);
      })
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

  /* Short keys, so the five dimensions stay distinguishable when the label
     column is narrow. Anything the tenant model adds falls back to its own
     initials rather than being dropped. */
  const DIM_KEY: Record<string, string> = {
    knowledge: 'K', ability: 'A', skill: 'S', behaviour: 'B', attitude: 'At',
  };

  const dimList = model?.dimensions ?? Object.keys(dimensions);
  const maxLevel = model?.maxLevel ?? 5;

  /* Averaged over ASSESSED values only. A dimension nobody measured is absent
     from this list entirely; it is never folded in as a zero, which would drag
     the organisation score down with a measurement that was never taken. */
  const assessedAverages = dimList
    .map((d) => dimensions[d]?.average)
    .filter((v): v is number => v !== null && v !== undefined);

  const overallAverage = assessedAverages.length
    ? Math.round((assessedAverages.reduce((a, b) => a + b, 0) / assessedAverages.length) * 100) / 100
    : null;

  const stateCount = (state: string) =>
    heatmap.filter((c) => (c.capabilityState ?? 'Unknown') === state).length;

  const assessedCapabilities = new Set(heatmap.map((c) => c.capabilityId)).size;

  if (loading) return <div className="kx-loading">Reading this organization&rsquo;s assessments&hellip;</div>;

  return (
    <div className="kx-page">
      <header className="kx-head">
        <div>
          <span className="kx-kicker">Knowledge</span>
          <h1 className="kx-title">
            {organizationName ? <strong>{organizationName}</strong> : 'This organization'}
            {' \u00b7 KASBA capability assessment'}
          </h1>
          <p className="kx-lede">
            Knowledge, Ability, Skill, Behaviour and Attitude, measured per capability. A level answers
            &ldquo;how good&rdquo;; the state beside it answers &ldquo;how firmly do we know&rdquo;.
            Department-level aggregates only &mdash; no individual is identifiable from this screen.
          </p>
        </div>
      </header>

      <div className="kx-metrics">
        <div className="kx-metric">
          <span className="kx-metric__value">{capabilities.length.toLocaleString()}</span>
          <span className="kx-metric__label">Capabilities</span>
        </div>
        <div className="kx-metric">
          <span className="kx-metric__value">{assessedCapabilities.toLocaleString()}</span>
          <span className="kx-metric__label">With assessments</span>
        </div>
        <div className="kx-metric">
          <span className="kx-metric__value">{assignmentCount.toLocaleString()}</span>
          <span className="kx-metric__label">Assignments</span>
        </div>
        {['Assessed', 'Demonstrated', 'Inferred', 'Asserted', 'Unknown'].map((st) => (
          <div className="kx-metric" key={st}>
            <span className="kx-metric__value">{stateCount(st).toLocaleString()}</span>
            <span className="kx-metric__label">{st}</span>
          </div>
        ))}
        <div className="kx-metric">
          {/* Em dash, not 0, when nothing anywhere has been assessed. */}
          {overallAverage === null
            ? <span className="kx-metric__value kx-metric__value--none">&mdash;</span>
            : <span className="kx-metric__value">{overallAverage}</span>}
          <span className="kx-metric__label">Average level</span>
        </div>
      </div>

      <section className="kx-section">
        <div className="kx-section__head">
          <h2 className="kx-section__title">The five dimensions</h2>
          <span className="kx-section__note">
            averaged over assessed values only &mdash; an unassessed dimension is not counted as zero
          </span>
        </div>

        <div className="kx-dims">
          {dimList.map((d) => {
            const cell = dimensions[d];
            const avg = cell?.average ?? null;
            const pct = avg === null ? 0 : Math.max(2, (avg / maxLevel) * 100);

            return (
              <div className={`kx-dim${avg === null ? ' kx-dim--null' : ''}`} key={d}>
                <span className="kx-dim__key" aria-hidden="true">{DIM_KEY[d] ?? d.slice(0, 2)}</span>
                <span className="kx-dim__name">{d}</span>
                <span className="kx-dim__bar">
                  {avg !== null && <span className="kx-dim__fill" style={{ width: `${pct}%` }} />}
                </span>
                <span className="kx-dim__value">
                  {avg === null ? 'Not assessed' : (
                    <>
                      {avg} / {maxLevel}
                      <span className="kx-dim__count"> &middot; {cell?.assessed ?? 0} assessed</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="kx-section">
        <div className="kx-section__head">
          <h2 className="kx-section__title">Capability heatmap</h2>
          <span className="kx-section__note">one cell per capability and department</span>
        </div>

        {heatmap.length === 0 ? (
          /*
           * An honest empty state. It reports what the organization DOES have —
           * capabilities defined, assignments on file — so the reader can see
           * why the assessment is empty rather than being told nothing. No
           * number here is invented; each is a real count from the API.
           */
          <div className="kx-empty">
            <h3 className="kx-empty__title">No KASBA assessments yet</h3>
            <p className="kx-empty__body">
              Assessments appear here once capabilities have been evaluated across Knowledge, Ability,
              Skill, Behaviour and Attitude. Nothing is estimated on their behalf: a dimension that has
              not been assessed stays empty rather than being scored zero.
            </p>
            <div className="kx-empty__facts">
              <span className="kx-empty__fact">
                <span className="kx-empty__fact-value">{capabilities.length.toLocaleString()}</span>
                <span className="kx-empty__fact-label">Capabilities defined</span>
              </span>
              <span className="kx-empty__fact">
                <span className="kx-empty__fact-value">{assignmentCount.toLocaleString()}</span>
                <span className="kx-empty__fact-label">Assignments</span>
              </span>
              <span className="kx-empty__fact">
                <span className="kx-empty__fact-value">0</span>
                <span className="kx-empty__fact-label">Assessed</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="kx-cells">
            {heatmap.map((cell, i) => (
              <IntelligenceCard
                key={i}
                status={levelStatus(cell.averageLevel)}
                title={capabilityName(cell.capabilityId)}
                description={cell.departmentId ? `Department ${cell.departmentId}` : undefined}
                badge={<KasbaBadge state={cell.capabilityState ?? 'Unknown'} />}
                meta={[
                  `${cell.averageLevel} / ${maxLevel}`,
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
      </section>

      <section className="kx-section">
        <div className="kx-section__head">
          <h2 className="kx-section__title">Capability task browser</h2>
          <span className="kx-section__note">what a capability decomposes into, and which parts need evidence</span>
        </div>

        <div className="kx-row">
          <select
            className="u-select"
            value={selectedCapabilityId ?? ''}
            onChange={(e) => e.target.value && loadTasks(e.target.value)}
            aria-label="Choose a capability to view its tasks"
          >
            <option value="">
              {capabilities.length === 0
                ? 'No capabilities defined for this organization'
                : 'Select a capability to view its tasks...'}
            </option>
            {capabilities.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.capabilityCode})</option>
            ))}
          </select>

          {selectedCapabilityId && (
            <button type="button" className="u-btn u-btn-secondary u-btn-sm" onClick={() => setShowTaskForm((v) => !v)}>
              {showTaskForm ? 'Cancel' : '+ Add task'}
            </button>
          )}
        </div>

        {selectedCapabilityId && (
          <>
            {showTaskForm && (
              <form className="kx-form" onSubmit={submitTask}>
                <input
                  className="u-input"
                  placeholder="Task name"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                />
                <textarea
                  className="u-input"
                  placeholder="Description (optional)"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  style={{ minHeight: 60 }}
                />
                <select
                  className="u-select"
                  value={parentTaskId ?? ''}
                  onChange={(e) => setParentTaskId(e.target.value || null)}
                  aria-label="Parent task"
                >
                  <option value="">Top-level task</option>
                  {topLevelTasks.map((t) => (
                    <option key={t.id} value={t.id}>Sub-task of: {t.name}</option>
                  ))}
                </select>
                <label className="kx-check">
                  <input
                    type="checkbox"
                    checked={taskEvidenceRequired}
                    onChange={(e) => setTaskEvidenceRequired(e.target.checked)}
                  />
                  Evidence required for this task
                </label>
                <button type="submit" className="u-btn u-btn-primary u-btn-sm">Save task</button>
              </form>
            )}

            {tasksLoading ? (
              <div className="kx-loading">Loading tasks&hellip;</div>
            ) : topLevelTasks.length === 0 ? (
              <p className="kx-section__note">No tasks defined yet for this capability.</p>
            ) : (
              <div className="kx-tasks">
                {topLevelTasks.map((t) => (
                  <div className="kx-task" key={t.id}>
                    <div className="kx-task__head">
                      <strong className="kx-task__name">{t.name}</strong>
                      {t.evidenceRequired && <span className="kx-task__flag">evidence required</span>}
                    </div>
                    {t.description && <p className="kx-task__desc">{t.description}</p>}
                    {subTasksOf(t.id).length > 0 && (
                      <div className="kx-task__subs">
                        {subTasksOf(t.id).map((sub) => (
                          <div className="kx-task__sub" key={sub.id}>&#8627; {sub.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
