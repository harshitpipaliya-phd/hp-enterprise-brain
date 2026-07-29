import { useEffect, useState } from 'react';
import { api as deptApi } from '../../api/department';
import { api as capabilityApi } from '../../api/capability';
import { api as personApi } from '../../api/person';
import { LoadingState, ErrorState } from '../shared/States';

interface Department {
  id: string;
  name: string;
  code?: string | null;
}

interface HeatmapCell {
  capabilityId: string;
  departmentId: string | null;
  averageLevel: number;
  assessedCount: number;
}

interface TimelineItem {
  type: string;
  actorId: string;
  createdAt: string;
}

interface DepartmentTwin {
  department: Department & { description?: string | null };
  personCount: number;
  capabilityHeatmap: HeatmapCell[];
  openRiskSignalCount: number;
  decisionCount: number;
  decisionApprovalRate: number | null;
  timeline: TimelineItem[];
}

interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  designation?: string | null;
  jobTitle?: string | null;
}

function eventLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DepartmentIntelligence({ tenantId, departmentId, onBack, onSelectPerson }: { tenantId: string; departmentId?: string; onBack?: () => void; onSelectPerson?: (personId: string) => void }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [capabilityNames, setCapabilityNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>(departmentId ?? '');
  const [twin, setTwin] = useState<DepartmentTwin | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [listLoading, setListLoading] = useState(!departmentId);
  const [twinLoading, setTwinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (departmentId) { setListLoading(false); return; }
    setListLoading(true);
    deptApi.listDepartments(tenantId)
      .then((depts: Department[]) => {
        setDepartments(depts);
        if (depts.length > 0) setSelectedId(depts[0].id);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setListLoading(false));
  }, [tenantId, departmentId]);

  useEffect(() => {
    capabilityApi.listCapabilities(tenantId)
      .then((caps: any[]) => {
        const names: Record<string, string> = {};
        for (const c of caps) names[c.id] = c.name;
        setCapabilityNames(names);
      })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    if (!selectedId) return;
    setTwinLoading(true);
    setError(null);
    Promise.all([
      deptApi.getTwin(tenantId, selectedId),
      personApi.listPeople(tenantId, undefined, selectedId),
    ])
      .then(([twinData, peopleData]) => { setTwin(twinData); setPeople(peopleData); })
      .catch((e: any) => setError(e.message))
      .finally(() => setTwinLoading(false));
  }, [tenantId, selectedId]);

  const refresh = () => {
    if (!selectedId) return;
    setTwinLoading(true);
    Promise.all([deptApi.getTwin(tenantId, selectedId), personApi.listPeople(tenantId, undefined, selectedId)])
      .then(([twinData, peopleData]) => { setTwin(twinData); setPeople(peopleData); })
      .catch((e: any) => setError(e.message))
      .finally(() => setTwinLoading(false));
  };

  if (listLoading) return <LoadingState label="Loading departments..." />;
  if (error && !twin) return <ErrorState message={error} />;

  if (!departmentId && departments.length === 0) {
    return <div className="eb-dashed-empty">No departments yet. Create one to see its intelligence dashboard here.</div>;
  }

  return (
    <div className="eb-fade-in">
      {onBack && <button onClick={onBack} className="eb-pill-btn" style={{ marginBottom: 14 }}>{'\u2190'} Back to Departments</button>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div className="eb-eyebrow">Department Intelligence</div>
          <h1 className="eb-headline">{twin ? twin.department.name : 'Loading...'}</h1>
        </div>
        {!departmentId && (
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ alignSelf: 'center' }}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {twinLoading || !twin ? (
        <LoadingState label="Loading department twin..." />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <span className="eb-conn-pill"><span className="eb-conn-dot" />{'Live \u00B7 GET /departments/' + tenantId + '/' + twin.department.id + '/twin'}</span>
            <button className="eb-pill-btn" onClick={refresh}>{'\u21BA Re-ingest'}</button>
          </div>

          <div className="eb-tile-grid">
            <div className="eb-tile">
              <div className="eb-tile-label">People</div>
              <div className="eb-tile-value-row"><span className="eb-tile-value">{twin.personCount}</span></div>
              <div className="eb-tile-note">assigned to this department</div>
            </div>
            <div className="eb-tile">
              <div className="eb-tile-label">Open Risk Signals</div>
              <div className="eb-tile-value-row"><span className="eb-tile-value" style={{ color: twin.openRiskSignalCount > 0 ? 'var(--feedback-error-content)' : 'var(--content-primary)' }}>{twin.openRiskSignalCount}</span></div>
              <div className="eb-tile-note">unaddressed, high severity</div>
            </div>
            <div className="eb-tile">
              <div className="eb-tile-label">Decisions</div>
              <div className="eb-tile-value-row"><span className="eb-tile-value">{twin.decisionCount}</span></div>
              <div className="eb-tile-note">made by people in this department</div>
            </div>
            <div className="eb-tile">
              <div className="eb-tile-label">Approval Rate</div>
              <div className="eb-tile-value-row"><span className="eb-tile-value">{twin.decisionApprovalRate != null ? Math.round(twin.decisionApprovalRate * 100) + '%' : '\u2014'}</span></div>
              <div className="eb-progress-track" style={{ marginTop: 8 }}>
                <div className="eb-progress-fill" style={{ width: (twin.decisionApprovalRate != null ? twin.decisionApprovalRate * 100 : 0) + '%' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              <div className="eb-panel">
                <div className="eb-panel-head">
                  <span className="eb-panel-title">Capability heatmap</span>
                  <span className="eb-panel-tag">capabilityHeatmap[]</span>
                </div>
                {twin.capabilityHeatmap.length === 0 ? (
                  <div className="eb-dashed-empty">No capabilities assessed in this department yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {twin.capabilityHeatmap.map((cell) => (
                      <div key={cell.capabilityId} className="eb-bar-row">
                        <span className="eb-bar-label">{capabilityNames[cell.capabilityId] ?? cell.capabilityId}</span>
                        <span className="eb-bar-track"><span className="eb-bar-fill" style={{ width: (cell.averageLevel / 5) * 100 + '%' }} /></span>
                        <span className="eb-bar-value">{cell.averageLevel.toFixed(1)}</span>
                        <span className="eb-bar-meta">{cell.assessedCount} assessed</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="eb-panel">
                <div className="eb-panel-head">
                  <span className="eb-panel-title">People in this department</span>
                  <span className="eb-panel-tag">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
                </div>
                <div className="eb-endpoint-note">
                  {'GET /people/' + tenantId + '?departmentId=' + twin.department.id + ' \u00B7 select a person to open their intelligence profile'}
                </div>
                {people.length === 0 ? (
                  <div className="eb-dashed-empty">No people returned for this department. The list endpoint responded with an empty set.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {people.map((p) => (
                      <div
                        key={p.id}
                        className="eb-list-row"
                        role={onSelectPerson ? 'button' : undefined}
                        onClick={() => onSelectPerson && onSelectPerson(p.id)}
                      >
                        {/* Optional-chained: a person row with no name on file
                            is a data state, not a reason to blank the screen. */}
                        <span className="eb-avatar">{p.firstName?.[0]}{p.lastName?.[0]}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <div className="eb-list-row-name">{p.firstName} {p.lastName}</div>
                          <div className="eb-list-row-sub">{p.designation ?? p.jobTitle ?? '\u2014'}</div>
                        </span>
                        {onSelectPerson && <span className="eb-list-row-arrow">{'\u2192'}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="eb-panel">
              <div className="eb-panel-head">
                <span className="eb-panel-title">Activity timeline</span>
                <span className="eb-panel-tag">timeline[]</span>
              </div>
              {twin.timeline.length === 0 ? (
                <div className="eb-dashed-empty">No recorded activity yet.</div>
              ) : (
                <div>
                  {twin.timeline.map((e, i) => (
                    <div key={i} className="eb-timeline-item">
                      <span className="eb-timeline-rail">
                        <span className="eb-timeline-dot" />
                        {i < twin.timeline.length - 1 && <span className="eb-timeline-line" />}
                      </span>
                      <span style={{ flex: 1 }}>
                        <div className="eb-timeline-text">{eventLabel(e.type)}</div>
                        <div className="eb-timeline-meta">{new Date(e.createdAt).toLocaleString()}</div>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
