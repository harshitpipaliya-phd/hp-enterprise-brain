import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Gauge,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react';
import { api as deptApi } from '../../api/department';
import { api as capabilityApi } from '../../api/capability';
import { api as personApi } from '../../api/person';
import { LoadingState, ErrorState } from '../shared/States';
import '../department/DepartmentList.css';
import './DepartmentIntelligence.css';

interface Department {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  departmentType?: string | null;
  status?: string | null;
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
  department: Department;
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
  email?: string | null;
  employmentStatus?: string | null;
  status?: string | null;
}

/**
 * The canonical per-department headcount, computed once on the server.
 *
 * Read rather than re-derived for the same reason every other screen reads it:
 * a department page that counts its own people and an organization page that
 * counts them centrally will disagree, and the reader has no way to tell which
 * number is the real one.
 */
interface Summary {
  people?: { total?: number; withoutUnit?: number; inVisibleUnits?: number };
  peoplePerDepartment?: Record<string, number>;
}

/**
 * ONE MEASURABLE COMPONENT OF DEPARTMENT HEALTH.
 *
 * A component exists only when the organization has the data to measure it. The
 * whole point of carrying `available` rather than defaulting a missing signal to
 * zero is that "this department has no assessed capabilities" and "this
 * department's capabilities assess badly" are opposite findings, and averaging
 * the first in as a 0 would report a healthy department as failing.
 */
interface HealthComponent {
  key: string;
  label: string;
  /** 0–100, or null when this organization cannot measure it at all. */
  score: number | null;
  /** The sentence that makes the number checkable. */
  basis: string;
}

const PAGE_SIZE = 10;

export default function DepartmentIntelligence({
  tenantId,
  departmentId,
  onBack,
  onSelectPerson,
}: {
  tenantId: string;
  departmentId?: string;
  onBack?: () => void;
  onSelectPerson?: (personId: string) => void;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [capabilityNames, setCapabilityNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string>(departmentId ?? '');
  const [twin, setTwin] = useState<DepartmentTwin | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [twinLoading, setTwinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personSearch, setPersonSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => { setSelectedId(departmentId ?? ''); }, [departmentId]);

  /*
    THE PEER SET IS LOADED EVEN WHEN ONE DEPARTMENT WAS NAMED.

    "23 people" is a fact; "23 people — the second-largest of nine units, and
    two and a half times the median" is intelligence, and the difference is
    whether the other departments are in hand. They are two small list calls, so
    the benchmark is always available rather than only on the picker route.
  */
  useEffect(() => {
    let cancelled = false;
    setListLoading(true);

    Promise.all([
      deptApi.listDepartments(tenantId).catch(() => [] as Department[]),
      deptApi.getSummary(tenantId).catch(() => null),
    ])
      .then(([depts, summaryData]) => {
        if (cancelled) return;
        setDepartments(Array.isArray(depts) ? depts : []);
        setSummary(summaryData);
        if (!departmentId && Array.isArray(depts) && depts.length > 0) setSelectedId((current) => current || depts[0].id);
      })
      .catch((e: any) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setListLoading(false); });

    return () => { cancelled = true; };
  }, [tenantId, departmentId]);

  useEffect(() => {
    let cancelled = false;
    capabilityApi.listCapabilities(tenantId)
      .then((caps: any[]) => {
        if (cancelled) return;
        const names: Record<string, string> = {};
        for (const c of caps) names[c.id] = c.name;
        setCapabilityNames(names);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tenantId]);

  /**
   * Load one department, ignoring anything that arrives after the user has
   * moved on.
   *
   * The picker makes switching departments a single keystroke, and two requests
   * against a slow connection do not come back in the order they were sent. The
   * token — rather than a per-effect boolean — is what covers the manual
   * Refresh button too, which is not an effect and could otherwise land on top
   * of a newer selection.
   */
  const requestRef = useRef(0);

  const loadDepartment = (id: string) => {
    if (!id) return;

    const token = ++requestRef.current;
    setTwinLoading(true);
    setError(null);

    Promise.all([
      deptApi.getTwin(tenantId, id),
      personApi.listPeople(tenantId, undefined, id).catch(() => [] as PersonRow[]),
    ])
      .then(([twinData, peopleData]) => {
        if (token !== requestRef.current) return;
        setTwin(twinData);
        setPeople(Array.isArray(peopleData) ? peopleData : []);
      })
      .catch((e: any) => { if (token === requestRef.current) setError(e.message); })
      .finally(() => { if (token === requestRef.current) setTwinLoading(false); });
  };

  useEffect(() => {
    setPage(0);
    setPersonSearch('');
    loadDepartment(selectedId);
  }, [tenantId, selectedId]);

  /* ------------------------------------------------------------------ model */

  const model = useMemo(
    () => buildModel({ twin, departments, summary, people }),
    [twin, departments, summary, people],
  );

  const filteredPeople = useMemo(() => {
    const needle = personSearch.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((p) => personLabel(p).toLowerCase().includes(needle)
      || String(p.designation ?? p.jobTitle ?? '').toLowerCase().includes(needle)
      || String(p.email ?? '').toLowerCase().includes(needle));
  }, [people, personSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredPeople.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  /* ----------------------------------------------------------------- render */

  if (listLoading && !twin) return <LoadingState label="Loading department intelligence…" />;
  if (error && !twin) return <ErrorState message={error} />;

  if (!departmentId && departments.length === 0) {
    return (
      <div className="dept-intel">
        <div className="dept-intel__empty dept-intel__empty--page">
          <strong>This organization has no departments in its connected system</strong>
          <p>
            Department intelligence is produced from units in the source system. Once units exist and people are
            assigned to them, each unit&apos;s size, capability coverage and risk appear here.
          </p>
        </div>
      </div>
    );
  }

  const department = twin?.department;

  return (
    <div className="dept-intel eb-fade-in">
      <header className="dept-intel__header">
        <div>
          <span className="dept-intel__kicker">Department Intelligence</span>
          <h1>{department?.name ?? 'Department'}</h1>
          <p>
            {describeDepartment(department, model)}
          </p>
        </div>
        <div className="dept-intel__actions">
          {onBack && (
            <button className="dept-intel__ghost" onClick={onBack}>
              <ArrowLeft size={15} /> Back to Departments
            </button>
          )}
          {!departmentId && departments.length > 1 && (
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Choose a department">
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
              ))}
            </select>
          )}
          <button className="dept-intel__refresh" onClick={() => loadDepartment(selectedId)} disabled={twinLoading}>
            <RefreshCw size={15} /> {twinLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {twinLoading && !twin ? (
        <LoadingState label="Loading department intelligence…" />
      ) : !twin ? (
        <ErrorState message={error ?? 'This department could not be loaded.'} />
      ) : (
        <>
          <section className="dept-intel__kpis" aria-label="Department indicators">
            <Kpi
              icon={<Users size={18} />}
              label="Headcount"
              value={model.headcount.toLocaleString()}
              hint={model.headcountHint}
              tone={model.headcount === 0 ? 'warn' : 'state'}
            />
            {/*
              CAPABILITY STRENGTH IS OMITTED, NOT ZEROED, when nothing in this
              department has been assessed. A 0.0/5 tile is read as "this team
              is incompetent"; the honest statement is that no assessment has
              been recorded, and it belongs in the findings list rather than in
              a headline number.
            */}
            {model.capability && (
              <Kpi
                icon={<Target size={18} />}
                label="Capability strength"
                value={`${model.capability.average.toFixed(1)} / 5`}
                hint={model.capability.hint}
                tone={model.capability.average >= 3.5 ? 'good' : model.capability.average >= 2.5 ? 'warn' : 'crit'}
              />
            )}
            <Kpi
              icon={<AlertTriangle size={18} />}
              label="Open risk signals"
              value={twin.openRiskSignalCount.toLocaleString()}
              hint={model.riskHint}
              tone={twin.openRiskSignalCount === 0 ? 'good' : twin.openRiskSignalCount > 3 ? 'crit' : 'warn'}
            />
            {model.decisions && (
              <Kpi
                icon={<BarChart3 size={18} />}
                label="Decisions"
                value={model.decisions.count.toLocaleString()}
                hint={model.decisions.hint}
                tone={model.decisions.tone}
              />
            )}
            {model.activity && (
              <Kpi
                icon={<Gauge size={18} />}
                label="Recent activity"
                value={model.activity.recent.toLocaleString()}
                hint={model.activity.hint}
                tone={model.activity.recent > 0 ? 'good' : 'warn'}
              />
            )}
          </section>

          <div className="di-grid">
            <div className="di-column">
              <section className="dept-intel__card di-health" aria-label="Department health">
                <div className="dept-intel__card-head">
                  <h2>Department health</h2>
                  {/* One text node, not three: a caption split across JSX
                      interpolations is one string to a reader and three to
                      anything that reads the DOM. */}
                  <span>{`${model.health.measured} of ${model.health.components.length} signals measurable`}</span>
                </div>

                {model.health.score === null ? (
                  <p className="di-note di-note--empty">
                    Nothing this organization currently records can be scored for this department. Health appears once
                    people are assigned to the unit, capabilities are assessed, or signals and decisions reference it.
                  </p>
                ) : (
                  <div className="di-health__body">
                    <div className="di-score" data-tone={scoreTone(model.health.score)}>
                      <strong>{model.health.score}</strong>
                      <span>out of 100</span>
                      <em>{scoreLabel(model.health.score)}</em>
                    </div>
                    <div className="di-health__components">
                      {model.health.components.map((component) => (
                        <div key={component.key} className="di-component" data-available={component.score !== null}>
                          <div className="di-component__head">
                            <span>{component.label}</span>
                            <strong>{component.score === null ? 'Not measured' : `${component.score}`}</strong>
                          </div>
                          {component.score !== null && (
                            <div className="di-component__track">
                              <i style={{ width: `${component.score}%` }} data-tone={scoreTone(component.score)} />
                            </div>
                          )}
                          <p>{component.basis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="di-note">
                  The score is the plain average of the signals this organization can actually measure. A signal it
                  does not record is left out rather than counted as zero, so a department is never marked down for
                  data the source system has never held.
                </p>
              </section>

              <section className="dept-intel__card" aria-label="Key findings">
                <div className="dept-intel__card-head">
                  <h2>What this says</h2>
                  <span>{model.findings.length} {model.findings.length === 1 ? 'finding' : 'findings'}</span>
                </div>
                {model.findings.length === 0 ? (
                  <p className="di-note di-note--empty">
                    Nothing about this department stands out against the rest of the organization.
                  </p>
                ) : (
                  <ul className="di-findings">
                    {model.findings.map((finding) => (
                      <li key={finding.title} data-tone={finding.tone}>
                        <strong>{finding.title}</strong>
                        <p>{finding.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {model.capability && (
                <section className="dept-intel__card" aria-label="Capability strength">
                  <div className="dept-intel__card-head">
                    <h2>Capability strength</h2>
                    <span>{model.capability.cells.length} assessed</span>
                  </div>
                  <div className="dept-intel__bars">
                    {model.capability.cells.map((cell) => (
                      <div key={cell.capabilityId} className="dept-intel__bar-row">
                        <span>{capabilityNames[cell.capabilityId] ?? cell.capabilityId}</span>
                        <div>
                          <i
                            style={{
                              width: `${Math.min(100, (cell.averageLevel / 5) * 100)}%`,
                              background: cell.averageLevel >= 3.5
                                ? 'var(--status-good)'
                                : cell.averageLevel >= 2.5 ? 'var(--status-warn)' : 'var(--status-crit)',
                            }}
                          />
                        </div>
                        <strong>{cell.averageLevel.toFixed(1)}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="dept-intel__directory" aria-label="People in this department">
                <div className="dept-intel__table-head">
                  <div>
                    <span className="dept-intel__kicker">Who works here</span>
                    <h2>People</h2>
                    <p>Select a person to open their individual intelligence profile.</p>
                  </div>
                  {people.length > PAGE_SIZE && (
                    <label className="dept-intel__search di-people__search">
                      <Search size={15} />
                      <input
                        value={personSearch}
                        onChange={(e) => { setPersonSearch(e.target.value); setPage(0); }}
                        placeholder="Search this department…"
                      />
                    </label>
                  )}
                </div>

                {filteredPeople.length === 0 ? (
                  <p className="di-note di-note--empty">
                    {people.length === 0
                      ? 'No people in the source system are assigned to this unit.'
                      : `No one in this department matches “${personSearch}”.`}
                  </p>
                ) : (
                  <>
                    <ul className="di-people">
                      {pageRows.map((person) => (
                        <li key={person.id}>
                          <button type="button" onClick={() => onSelectPerson?.(person.id)} disabled={!onSelectPerson}>
                            <span className="di-people__avatar" aria-hidden="true">{initials(person)}</span>
                            <span className="di-people__identity">
                              <strong>{personLabel(person)}</strong>
                              <small>{person.designation || person.jobTitle || 'Role not recorded in the source system'}</small>
                            </span>
                            {onSelectPerson && <ChevronRight size={16} className="di-people__arrow" />}
                          </button>
                        </li>
                      ))}
                    </ul>

                    {/*
                      PAGINATED RATHER THAN SCROLLED. A department of four
                      hundred rendered as one column is a page nobody reaches the
                      bottom of, and it pushes every panel below it off screen.
                    */}
                    {pageCount > 1 && (
                      <nav className="di-pager" aria-label="People pages">
                        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                          <ChevronLeft size={15} /> Previous
                        </button>
                        <span>
                          {(safePage * PAGE_SIZE + 1).toLocaleString()}–
                          {Math.min(filteredPeople.length, (safePage + 1) * PAGE_SIZE).toLocaleString()}
                          {' of '}{filteredPeople.length.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                          disabled={safePage >= pageCount - 1}
                        >
                          Next <ChevronRight size={15} />
                        </button>
                      </nav>
                    )}
                  </>
                )}
              </section>
            </div>

            <div className="di-column">
              <section className="dept-intel__card" aria-label="Benchmark against other departments">
                <div className="dept-intel__card-head">
                  <h2>Benchmark</h2>
                  <span>{model.peerCount} {model.peerCount === 1 ? 'unit' : 'units'}</span>
                </div>
                {model.benchmarks.length === 0 ? (
                  <p className="di-note di-note--empty">
                    A benchmark needs other departments to compare against. This organization has only one unit
                    recorded.
                  </p>
                ) : (
                  <dl className="di-benchmark">
                    {model.benchmarks.map((row) => (
                      <div key={row.label}>
                        <dt>{row.label}</dt>
                        <dd>
                          <strong>{row.value}</strong>
                          <small>{row.detail}</small>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section className="dept-intel__card" aria-label="Activity">
                <div className="dept-intel__card-head">
                  <h2>Activity</h2>
                  <span>{twin.timeline.length} recorded</span>
                </div>
                {twin.timeline.length === 0 ? (
                  <p className="di-note di-note--empty">
                    Nothing has been recorded against this department yet. Activity appears as its people are
                    assessed, and as signals and decisions reference the unit.
                  </p>
                ) : (
                  <ol className="di-timeline">
                    {twin.timeline.slice(0, 12).map((event, index) => (
                      <li key={`${event.type}-${event.createdAt}-${index}`}>
                        <span className="di-timeline__dot" aria-hidden="true" />
                        <div>
                          <strong>{eventLabel(event.type)}</strong>
                          <small>{formatWhen(event.createdAt)}</small>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  MODEL                                                                     */
/* ========================================================================== */

interface Finding {
  title: string;
  detail: string;
  tone: 'good' | 'warn' | 'crit' | 'state';
}

interface Benchmark {
  label: string;
  value: string;
  detail: string;
}

interface Model {
  headcount: number;
  headcountHint: string;
  riskHint: string;
  peerCount: number;
  capability: { average: number; hint: string; cells: HeatmapCell[] } | null;
  decisions: { count: number; hint: string; tone: 'good' | 'warn' | 'crit' | 'state' } | null;
  activity: { recent: number; hint: string } | null;
  health: { score: number | null; measured: number; components: HealthComponent[] };
  findings: Finding[];
  benchmarks: Benchmark[];
}

/**
 * Everything the screen states about a department, derived in one place.
 *
 * NO METRIC IS INVENTED AND NO ABSENCE IS SCORED. Each block below either has
 * the data behind it or returns null, and the render treats null as "do not
 * show this" rather than "show a zero". That rule is what keeps a small
 * organization's department page from being a grid of 0s that says nothing.
 */
function buildModel({
  twin,
  departments,
  summary,
  people,
}: {
  twin: DepartmentTwin | null;
  departments: Department[];
  summary: Summary | null;
  people: PersonRow[];
}): Model {
  const empty: Model = {
    headcount: 0,
    headcountHint: 'No people assigned',
    riskHint: 'None open',
    peerCount: 0,
    capability: null,
    decisions: null,
    activity: null,
    health: { score: null, measured: 0, components: [] },
    findings: [],
    benchmarks: [],
  };

  if (!twin) return empty;

  const perDepartment = summary?.peoplePerDepartment ?? {};
  const departmentId = String(twin.department.id);

  /*
    THE SERVER'S COUNT WINS. `personCount` on the twin and the roster length are
    both legitimate answers to slightly different questions (assigned vs
    visible to this user), and the shared summary is the one the Organization
    screen prints. Preferring it is what stops the two pages disagreeing.
  */
  const headcount = Number(perDepartment[departmentId] ?? twin.personCount ?? people.length) || 0;

  const peerSizes = departments
    .map((d) => Number(perDepartment[String(d.id)] ?? 0))
    .filter((n) => Number.isFinite(n));
  const peerCount = Math.max(0, departments.length - 1);
  const staffed = peerSizes.filter((n) => n > 0);
  const orgPeople = Number(summary?.people?.total ?? 0) || peerSizes.reduce((a, b) => a + b, 0);
  const median = medianOf(staffed);
  const rank = peerSizes.length > 0
    ? peerSizes.filter((n) => n > headcount).length + 1
    : null;

  const share = orgPeople > 0 ? (headcount / orgPeople) * 100 : null;

  const headcountHint = headcount === 0
    ? 'No one in the source system is assigned to this unit'
    : [
      share !== null ? `${share.toFixed(share < 10 ? 1 : 0)}% of the workforce` : null,
      rank !== null && departments.length > 1 ? `${ordinal(rank)} largest of ${departments.length}` : null,
    ].filter(Boolean).join(' · ') || 'Assigned in the source system';

  /* ------------------------------------------------------------ capability */

  const cells = (twin.capabilityHeatmap ?? []).filter((c) => Number(c.assessedCount) > 0);
  const assessedPeople = cells.reduce((max, c) => Math.max(max, Number(c.assessedCount) || 0), 0);
  const capability = cells.length > 0
    ? {
      average: cells.reduce((sum, c) => sum + Number(c.averageLevel || 0), 0) / cells.length,
      cells: [...cells].sort((a, b) => b.averageLevel - a.averageLevel),
      hint: headcount > 0 && assessedPeople > 0
        ? `${cells.length} ${cells.length === 1 ? 'capability' : 'capabilities'} · ${Math.min(100, Math.round((assessedPeople / headcount) * 100))}% of the team assessed`
        : `${cells.length} ${cells.length === 1 ? 'capability' : 'capabilities'} assessed`,
    }
    : null;

  /* ------------------------------------------------------------- decisions */

  const decisionCount = Number(twin.decisionCount ?? 0) || 0;
  const approval = twin.decisionApprovalRate;
  const decisions = decisionCount > 0
    ? {
      count: decisionCount,
      hint: approval === null
        ? 'Recorded for people in this unit'
        : `${Math.round(approval * 100)}% approved`,
      tone: (approval === null ? 'state' : approval >= 0.7 ? 'good' : approval >= 0.4 ? 'warn' : 'crit') as Finding['tone'],
    }
    : null;

  /* -------------------------------------------------------------- activity */

  const timeline = twin.timeline ?? [];
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = timeline.filter((e) => {
    const at = Date.parse(e.createdAt);
    return Number.isFinite(at) && at >= cutoff;
  }).length;
  const activity = timeline.length > 0
    ? {
      recent,
      hint: recent === 0
        ? `Nothing in 30 days · ${timeline.length} recorded in total`
        : `events in the last 30 days · ${timeline.length} in total`,
    }
    : null;

  /* ---------------------------------------------------------------- health */

  const components: HealthComponent[] = [
    {
      key: 'staffing',
      label: 'Staffing',
      score: median > 0 && headcount > 0
        ? clamp(Math.round((headcount / median) * 60))
        : headcount > 0 ? 70 : departments.length > 0 ? 0 : null,
      basis: headcount === 0
        ? 'No one is assigned to this unit, which is what a size score measures.'
        : median > 0
          ? `${headcount.toLocaleString()} people against a median unit of ${median.toLocaleString()}.`
          : `${headcount.toLocaleString()} people assigned.`,
    },
    {
      key: 'capability',
      label: 'Capability',
      score: capability ? clamp(Math.round((capability.average / 5) * 100)) : null,
      basis: capability
        ? `Average assessed level ${capability.average.toFixed(1)} of 5 across ${capability.cells.length} ${capability.cells.length === 1 ? 'capability' : 'capabilities'}.`
        : 'No capability in this unit has been assessed, so there is nothing to score.',
    },
    {
      key: 'risk',
      /*
        ALWAYS MEASURABLE, and deliberately unlike the three around it.

        "No open risk signal references this department" is a fact the twin
        established by looking — not an absence of data — so scoring it 100 is
        honest where scoring an unassessed capability 0 would not be. Marking it
        "not measured" instead would put a warning on the cleanest department in
        the organization.
      */
      label: 'Risk',
      score: clamp(100 - twin.openRiskSignalCount * 20),
      basis: twin.openRiskSignalCount === 0
        ? 'No open risk signal references this department.'
        : `${twin.openRiskSignalCount} open risk ${twin.openRiskSignalCount === 1 ? 'signal' : 'signals'} reference this department.`,
    },
    {
      key: 'decision',
      label: 'Decision quality',
      score: approval !== null ? clamp(Math.round(approval * 100)) : null,
      basis: approval !== null
        ? `${Math.round(approval * 100)}% of ${decisionCount.toLocaleString()} recorded ${decisionCount === 1 ? 'decision was' : 'decisions were'} approved.`
        : 'No decision with a recorded outcome belongs to this department yet.',
    },
  ];

  const measurable = components.filter((c) => c.score !== null);
  const health = {
    components,
    measured: measurable.length,
    score: measurable.length > 0
      ? Math.round(measurable.reduce((sum, c) => sum + (c.score as number), 0) / measurable.length)
      : null,
  };

  /* -------------------------------------------------------------- findings */

  const findings: Finding[] = [];

  if (headcount === 0) {
    findings.push({
      title: 'No one is assigned to this unit',
      detail: 'The unit exists in the source system but holds no people, so nothing about its work can be measured. Either staff are recorded against another unit or the assignment has not been made.',
      tone: 'warn',
    });
  } else if (median > 0 && headcount >= median * 2) {
    findings.push({
      title: 'Substantially larger than a typical unit',
      detail: `${headcount.toLocaleString()} people against a median of ${median.toLocaleString()} across ${staffed.length} staffed ${staffed.length === 1 ? 'unit' : 'units'}. Concentration of this size is where single points of failure and span-of-control problems tend to appear first.`,
      tone: 'state',
    });
  } else if (median > 0 && headcount * 3 <= median) {
    findings.push({
      title: 'Much smaller than a typical unit',
      detail: `${headcount.toLocaleString()} ${headcount === 1 ? 'person' : 'people'} against a median of ${median.toLocaleString()}. Small units carry little redundancy: one absence is a large share of the team.`,
      tone: 'warn',
    });
  }

  if (twin.openRiskSignalCount > 0) {
    findings.push({
      title: `${twin.openRiskSignalCount} open risk ${twin.openRiskSignalCount === 1 ? 'signal' : 'signals'}`,
      detail: headcount > 0
        ? `Unaddressed and referencing this department — roughly one for every ${Math.max(1, Math.round(headcount / twin.openRiskSignalCount)).toLocaleString()} people in it. Open each signal to see the evidence behind it.`
        : 'Unaddressed and referencing this department.',
      tone: twin.openRiskSignalCount > 3 ? 'crit' : 'warn',
    });
  }

  if (!capability && headcount > 0) {
    findings.push({
      title: 'Capability has never been assessed here',
      detail: `None of the ${headcount.toLocaleString()} people in this unit has a recorded capability assessment, so strengths and gaps cannot be compared against the rest of the organization.`,
      tone: 'warn',
    });
  } else if (capability) {
    const weakest = capability.cells[capability.cells.length - 1];
    const strongest = capability.cells[0];
    if (strongest && weakest && strongest.capabilityId !== weakest.capabilityId && strongest.averageLevel - weakest.averageLevel >= 1) {
      findings.push({
        title: 'Capability is uneven across the unit',
        detail: `The strongest assessed capability averages ${strongest.averageLevel.toFixed(1)} of 5 and the weakest ${weakest.averageLevel.toFixed(1)} — a spread of ${(strongest.averageLevel - weakest.averageLevel).toFixed(1)} levels within the same team.`,
        tone: 'state',
      });
    }
  }

  if (approval !== null && approval < 0.5 && decisionCount >= 3) {
    findings.push({
      title: 'Most decisions here are not approved',
      detail: `${Math.round(approval * 100)}% of ${decisionCount.toLocaleString()} recorded decisions were approved. A low rate usually points at proposals reaching the decision stage without the evidence to carry them.`,
      tone: 'crit',
    });
  }

  if (activity && activity.recent === 0 && timeline.length > 0) {
    findings.push({
      title: 'No activity in the last 30 days',
      detail: `${timeline.length.toLocaleString()} events are recorded against this department, but none of them recently. Its intelligence is based on older data than the rest of the organization's.`,
      tone: 'warn',
    });
  }

  /* ------------------------------------------------------------- benchmark */

  const benchmarks: Benchmark[] = [];

  if (departments.length > 1) {
    if (rank !== null) {
      benchmarks.push({
        label: 'Size rank',
        value: `${ordinal(rank)} of ${departments.length}`,
        detail: share !== null
          ? `${headcount.toLocaleString()} people — ${share.toFixed(share < 10 ? 1 : 0)}% of the recorded workforce`
          : `${headcount.toLocaleString()} people`,
      });
    }

    if (median > 0) {
      const delta = headcount - median;
      benchmarks.push({
        label: 'Against the median unit',
        value: `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`,
        detail: `Median staffed unit holds ${median.toLocaleString()} ${median === 1 ? 'person' : 'people'} across ${staffed.length} ${staffed.length === 1 ? 'unit' : 'units'}`,
      });
    }

    if (capability) {
      benchmarks.push({
        label: 'Capability average',
        value: `${capability.average.toFixed(1)} / 5`,
        detail: `Across ${capability.cells.length} assessed ${capability.cells.length === 1 ? 'capability' : 'capabilities'} in this unit`,
      });
    }

    const unstaffed = departments.length - staffed.length;
    if (unstaffed > 0) {
      benchmarks.push({
        label: 'Units with no people',
        value: unstaffed.toLocaleString(),
        detail: `${unstaffed} of ${departments.length} recorded units hold no one in the source system`,
      });
    }
  }

  return {
    headcount,
    headcountHint,
    riskHint: twin.openRiskSignalCount === 0
      ? 'Nothing unaddressed references this unit'
      : 'Unaddressed, referencing this unit',
    peerCount,
    capability,
    decisions,
    activity,
    health,
    findings,
    benchmarks,
  };
}

/* ========================================================================== */
/*  HELPERS                                                                   */
/* ========================================================================== */

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'state' | 'good' | 'warn' | 'crit' }) {
  return (
    <article className="dept-intel__kpi" data-tone={tone}>
      <div className="dept-intel__kpi-icon">{icon}</div>
      <div className="dept-intel__kpi-label">{label}</div>
      <div className="dept-intel__kpi-value">{value}</div>
      <div className="dept-intel__kpi-hint">{hint}</div>
    </article>
  );
}

function describeDepartment(department: Department | undefined, model: Model): string {
  if (!department) return 'Loading this unit’s intelligence…';

  const parts = [
    department.description?.trim() || null,
    model.headcount > 0
      ? `${model.headcount.toLocaleString()} ${model.headcount === 1 ? 'person' : 'people'}`
      : 'No people assigned',
    model.health.score !== null ? `health ${model.health.score}/100` : null,
  ].filter(Boolean);

  return parts.join(' · ');
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function scoreTone(score: number): 'good' | 'warn' | 'crit' {
  return score >= 70 ? 'good' : score >= 45 ? 'warn' : 'crit';
}

function scoreLabel(score: number): string {
  return score >= 80 ? 'Strong' : score >= 65 ? 'Healthy' : score >= 45 ? 'Needs attention' : 'At risk';
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function personLabel(person: PersonRow): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || 'Unnamed person';
}

function initials(person: PersonRow): string {
  const letters = `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.trim();
  return (letters || personLabel(person)[0] || '?').toUpperCase();
}

function eventLabel(type: string): string {
  return type.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatWhen(value: string): string {
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return value;

  const days = Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000));
  const absolute = new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  if (days <= 0) return `Today · ${absolute}`;
  if (days === 1) return `Yesterday · ${absolute}`;
  if (days < 30) return `${days} days ago · ${absolute}`;
  return absolute;
}
