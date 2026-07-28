import { useEffect, useState } from 'react';
import { api as personApi } from '../../api/person';
import { LoadingState, ErrorState } from '../shared/States';

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email: string;
}

interface CapabilityScore {
  capabilityId: string;
  capabilityName: string;
  scores: { knowledge: number | null; ability: number | null; skill: number | null; behaviour: number | null; attitude: number | null; overall: number | null };
  gaps: Array<{ dimension: string; currentLevel: number | null; targetLevel: number; gap: number }>;
  assessedDate: string | null;
}

interface ExecutionHistoryItem {
  id: string;
  esoId: string;
  status: string;
  completedDate: string | null;
  createdDate: string;
}

interface Twin {
  person: { firstName: string; lastName: string; jobTitle: string | null; email: string };
  capabilityCount: number;
  capabilityScores: CapabilityScore[];
  decisionParticipation: { total: number; approved: number };
  learningContributions: number;
  recentActivity: Array<{ type: string; createdAt: string; entityType: string }>;
  guardians: Array<{ firstName: string; lastName: string; relationship: string; email: string | null; phone: string | null; isPrimaryContact: boolean }>;
  executionHistory: ExecutionHistoryItem[];
  individualScore: { score: number | null; breakdown: { capabilityScore: number | null; decisionQuality: number | null; executionSuccess: number | null } };
}

const KASBA_DIMS: Array<{ key: 'knowledge' | 'ability' | 'skill' | 'behaviour' | 'attitude'; letter: string; name: string; desc: string }> = [
  { key: 'knowledge', letter: 'K', name: 'Knowledge', desc: 'What the person understands \u2014 concepts, facts, and frameworks they can recall and reason with.' },
  { key: 'ability', letter: 'A', name: 'Ability', desc: 'Capacity to apply knowledge under real conditions \u2014 judgment developed through practice.' },
  { key: 'skill', letter: 'S', name: 'Skill', desc: 'Demonstrated technique \u2014 the observable, repeatable execution of a task.' },
  { key: 'behaviour', letter: 'B', name: 'Behaviour', desc: 'Consistent conduct under pressure \u2014 what they actually do, not just what they know to do.' },
  { key: 'attitude', letter: 'A', name: 'Attitude', desc: 'Disposition toward the work \u2014 observed longitudinally through evidence, never assumed.' },
];

function scoreColor(val: number | null): string {
  if (val == null) return 'var(--conf-none)';
  if (val >= 4) return 'var(--conf-verified)';
  if (val >= 3) return 'var(--conf-high)';
  if (val >= 2) return 'var(--conf-med)';
  return 'var(--conf-low)';
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('approved') || s.includes('success')) return 'eb-badge eb-badge-success';
  if (s.includes('fail') || s.includes('reject')) return 'eb-badge eb-badge-danger';
  if (s.includes('progress') || s.includes('pending')) return 'eb-badge eb-badge-warning';
  return 'eb-badge';
}

function eventLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PersonIntelligence({ tenantId, personId, onBack }: { tenantId: string; personId?: string; onBack?: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedId, setSelectedId] = useState<string>(personId ?? '');
  const [twin, setTwin] = useState<Twin | null>(null);
  const [listLoading, setListLoading] = useState(!personId);
  const [twinLoading, setTwinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCapability, setActiveCapability] = useState<string | null>(null);
  const [activeDim, setActiveDim] = useState<typeof KASBA_DIMS[number]['key']>('knowledge');

  useEffect(() => {
    if (personId) { setListLoading(false); return; }
    setListLoading(true);
    personApi.listPeople(tenantId)
      .then((data: Person[]) => {
        setPeople(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setListLoading(false));
  }, [tenantId, personId]);

  const loadTwin = () => {
    if (!selectedId) return;
    setTwinLoading(true);
    setError(null);
    personApi.getTwin(tenantId, selectedId)
      .then((t: Twin) => {
        setTwin(t);
        if (t.capabilityScores.length > 0) setActiveCapability(t.capabilityScores[0].capabilityId);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setTwinLoading(false));
  };

  useEffect(() => { loadTwin(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId, selectedId]);

  if (listLoading) return <LoadingState label="Loading people..." />;
  if (error && !twin) return <ErrorState message={error} />;

  if (!personId && people.length === 0) {
    return <div className="eb-dashed-empty">No people yet. Add someone to see their intelligence profile here.</div>;
  }

  const score = twin ? twin.individualScore.score : null;
  const selectedCapability = twin?.capabilityScores.find((c) => c.capabilityId === activeCapability) ?? twin?.capabilityScores[0] ?? null;
  const activeDimMeta = KASBA_DIMS.find((d) => d.key === activeDim)!;
  const activeDimValue = selectedCapability?.scores[activeDim] ?? null;
  const activeDimGap = selectedCapability?.gaps.find((g) => g.dimension.toLowerCase() === activeDim);

  return (
    <div className="eb-fade-in" style={{ maxWidth: 1180, margin: '0 auto' }}>
      {onBack && <button onClick={onBack} className="eb-pill-btn" style={{ marginBottom: 14 }}>{'\u2190 Back'}</button>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div className="eb-eyebrow">People Intelligence</div>
          <h1 className="eb-headline" style={{ fontSize: 34 }}>{twin ? twin.person.firstName + ' ' + twin.person.lastName : 'Loading...'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border-default)', borderRadius: 999, padding: '8px 18px 8px 8px', background: 'var(--surface-inset)' }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--content-primary)', color: 'var(--surface-card)', display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>
            {twin ? (twin.person.firstName[0] ?? '') + (twin.person.lastName[0] ?? '') : '\u2014'}
          </span>
          <span>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, color: 'var(--content-primary)' }}>{twin ? twin.person.firstName + ' ' + twin.person.lastName : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--content-tertiary)' }}>{twin?.person.jobTitle ?? 'No title on record'}</div>
          </span>
        </div>
      </div>

      {!personId && (
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ marginBottom: 20 }}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.jobTitle ? ' \u2014 ' + p.jobTitle : ''}</option>
          ))}
        </select>
      )}

      {twinLoading || !twin ? (
        <LoadingState label="Loading person twin..." />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <span className="eb-conn-pill"><span className="eb-conn-dot" />{'Live \u00B7 GET /people/' + tenantId + '/' + selectedId + '/twin'}</span>
            <button className="eb-pill-btn" onClick={loadTwin}>{'\u21BA Re-ingest'}</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 30 }}>
            <div className="eb-record-stat">
              <div className="eb-record-stat-label">Individual Score</div>
              <div className="eb-record-stat-value">{score != null ? Math.round(score) : '\u2014'}</div>
            </div>
            <div className="eb-record-stat">
              <div className="eb-record-stat-label">Capabilities</div>
              <div className="eb-record-stat-value">{twin.capabilityCount}</div>
            </div>
            <div className="eb-record-stat">
              <div className="eb-record-stat-label">Decisions</div>
              <div className="eb-record-stat-value">{twin.decisionParticipation.total}</div>
            </div>
            <div className="eb-record-stat">
              <div className="eb-record-stat-label">Approved</div>
              <div className="eb-record-stat-value">{twin.decisionParticipation.approved}</div>
            </div>
            <div className="eb-record-stat">
              <div className="eb-record-stat-label">Learning</div>
              <div className="eb-record-stat-value">{twin.learningContributions}</div>
            </div>
          </div>

          {/* ---- KASBA capability record: three-column layout matching EB-DLS reference ---- */}
          {twin.capabilityScores.length === 0 ? (
            <div className="eb-panel" style={{ marginBottom: 24 }}>
              <div className="eb-panel-head"><span className="eb-panel-title">Capability profile</span><span className="eb-panel-tag">capabilityScores[].scores</span></div>
              <div className="eb-dashed-empty">No capability assessments on record yet \u2014 capabilityScores[] is empty.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 30 }}>
              <p style={{ margin: '0 0 20px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--content-secondary)', maxWidth: '78ch' }}>
                The Capability Model \u2014 <strong style={{ color: 'var(--content-primary)' }}>KASBA</strong> \u2014 decomposes each capability into five evidenced dimensions from <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--accent-evidence)' }}>capabilityScores[].scores</span>. Select a dimension to see its record.
              </p>
              <div className="eb-grid" style={{ gridTemplateColumns: '320px 1fr', alignItems: 'start', gap: 18 }}>

                {/* profile card */}
                <div className="eb-panel">
                  <div style={{ marginBottom: 4 }}>
                    <select
                      value={selectedCapability?.capabilityId ?? ''}
                      onChange={(e) => { setActiveCapability(e.target.value); }}
                      style={{ width: '100%', marginBottom: 14, fontWeight: 650 }}
                    >
                      {twin.capabilityScores.map((cs) => (
                        <option key={cs.capabilityId} value={cs.capabilityId}>{cs.capabilityName}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--content-tertiary)', margin: '4px 0 12px' }}>
                    Capability state
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {KASBA_DIMS.map((d) => {
                      const val = selectedCapability?.scores[d.key] ?? null;
                      const isActive = activeDim === d.key;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setActiveDim(d.key)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, background: isActive ? 'var(--surface-hover)' : 'transparent',
                            border: 'none', boxShadow: 'none', padding: '8px 8px', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: scoreColor(val), width: 14 }}>{d.letter}</span>
                          <span className="eb-bar-track" style={{ flex: 1 }}><span className="eb-bar-fill" style={{ width: ((val ?? 0) / 5) * 100 + '%', background: scoreColor(val) }} /></span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--content-primary)', width: 32, textAlign: 'right' }}>{val != null ? val.toFixed(1) : '\u2014'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--content-tertiary)' }}>Overall score</span>
                    <span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: scoreColor(selectedCapability?.scores.overall ?? null) }}>
                        {selectedCapability?.scores.overall != null ? selectedCapability.scores.overall.toFixed(1) : '\u2014'}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--content-tertiary)' }}> / 5</span>
                    </span>
                  </div>
                </div>

                {/* selected dimension detail */}
                <div className="eb-panel" style={{ minHeight: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700, color: scoreColor(activeDimValue) }}>{activeDimMeta.letter}</span>
                    <span style={{ fontFamily: 'var(--display)', fontSize: 21, fontWeight: 700, color: 'var(--content-primary)' }}>{activeDimMeta.name}</span>
                    <span style={{ marginInlineStart: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: scoreColor(activeDimValue) }}>
                      {activeDimValue != null ? activeDimValue.toFixed(1) + ' / 5' : 'Not assessed'}
                    </span>
                  </div>
                  <p style={{ margin: '14px 0 20px', fontSize: 14.5, lineHeight: 1.5, color: 'var(--content-secondary)' }}>{activeDimMeta.desc}</p>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--content-tertiary)', marginBottom: 12 }}>capability_proficiency record</div>
                  {selectedCapability?.assessedDate ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--surface-inset)', padding: '13px 16px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: scoreColor(activeDimValue), flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--content-secondary)' }}>Last assessed {new Date(selectedCapability.assessedDate).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <div className="eb-dashed-empty">No assessment record for this dimension yet.</div>
                  )}
                  {activeDimGap && (
                    <div style={{ marginTop: 14, border: '1px solid var(--feedback-warning-border)', background: 'var(--feedback-warning-surface)', borderRadius: 12, padding: '13px 16px' }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--feedback-warning-content)', marginBottom: 6 }}>Gap vs role target</div>
                      <div style={{ fontSize: 13.5, color: 'var(--content-secondary)' }}>Current {activeDimGap.currentLevel ?? '\u2014'} vs target {activeDimGap.targetLevel} \u2014 gap of {activeDimGap.gap}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="eb-grid eb-grid-2" style={{ alignItems: 'start' }}>
            <div className="eb-panel">
              <div className="eb-panel-head">
                <span className="eb-panel-title">Execution history</span>
                <span className="eb-panel-tag">executionHistory[]</span>
              </div>
              {twin.executionHistory.length === 0 ? (
                <div className="eb-dashed-empty">No ESO executions recorded yet.</div>
              ) : (
                <table>
                  <thead><tr><th>ESO</th><th>Status</th><th>Completed</th></tr></thead>
                  <tbody>
                    {twin.executionHistory.map((ex) => (
                      <tr key={ex.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{ex.esoId}</td>
                        <td><span className={statusBadgeClass(ex.status)}>{ex.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{ex.completedDate ? new Date(ex.completedDate).toLocaleDateString() : '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="eb-panel">
              <div className="eb-panel-head">
                <span className="eb-panel-title">Recent activity</span>
                <span className="eb-panel-tag">recentActivity[]</span>
              </div>
              {twin.recentActivity.length === 0 ? (
                <div className="eb-dashed-empty">No attributed activity in this twin yet.</div>
              ) : (
                <div>
                  {twin.recentActivity.map((a, i) => (
                    <div key={i} className="eb-timeline-item">
                      <span className="eb-timeline-rail">
                        <span className="eb-timeline-dot" />
                        {i < twin.recentActivity.length - 1 && <span className="eb-timeline-line" />}
                      </span>
                      <span style={{ flex: 1 }}>
                        <div className="eb-timeline-text">{eventLabel(a.type)} <span style={{ color: 'var(--content-tertiary)' }}>{'\u00B7 ' + a.entityType}</span></div>
                        <div className="eb-timeline-meta">{new Date(a.createdAt).toLocaleDateString()}</div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {twin.guardians.length > 0 && (
            <div className="eb-panel" style={{ marginTop: 20 }}>
              <div className="eb-panel-head"><span className="eb-panel-title">Guardians</span></div>
              <table>
                <thead><tr><th>Name</th><th>Relationship</th><th>Contact</th></tr></thead>
                <tbody>
                  {twin.guardians.map((g, i) => (
                    <tr key={i}>
                      <td>{g.firstName} {g.lastName} {g.isPrimaryContact && <span className="eb-badge eb-badge-info" style={{ marginLeft: 6 }}>Primary</span>}</td>
                      <td>{g.relationship}</td>
                      <td style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{g.email ?? g.phone ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
