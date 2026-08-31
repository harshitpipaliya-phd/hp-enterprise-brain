import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  IdCard,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api as deptApi } from '../../api/department';
import { api as capabilityApi } from '../../api/capability';
import { api as personApi } from '../../api/person';
import { LoadingState, ErrorState } from '../shared/States';
import { HeaderActions, PageHeader } from '../../ui';
import {
  EMPTY_METRICS, NO_SUPPORT, DEFAULT_THRESHOLDS,
  departmentScore,
  type DepartmentMetrics, type DepartmentSupport,
} from '../department/departmentScore';
import { DepartmentScoreRing, DepartmentStat } from '../department/DepartmentScoreRing';
import { DepartmentProfileView } from '../department/DepartmentProfileView';
import type { DepartmentProfile } from '../../api/department';
import '../department/DepartmentList.css';
import './DepartmentIntelligence.css';
import '../department/department.css';
import '../department/departmentProfile.css';

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
  const [profile, setProfile] = useState<DepartmentProfile | null>(null);
  const [twinLoading, setTwinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personSearch, setPersonSearch] = useState('');
  const [page, setPage] = useState(0);

  /* The batched per-department facts — one request for the whole organization,
     which is also what makes the peer comparison below possible without asking
     for every other department's twin. */
  const [metrics, setMetrics] = useState<Record<string, DepartmentMetrics>>({});
  const [support, setSupport] = useState<DepartmentSupport>(NO_SUPPORT);

  /* Server-side roster paging. `people` holds ONE PAGE, never the department's
     whole staff — see loadPeople below. */
  const [peopleTotal, setPeopleTotal] = useState(0);
  const [peoplePages, setPeoplePages] = useState(1);
  const [peopleLoading, setPeopleLoading] = useState(false);

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
      deptApi.getIntelligence(tenantId).catch(() => null),
    ])
      .then(([depts, summaryData, intelligence]) => {
        if (cancelled) return;
        setDepartments(Array.isArray(depts) ? depts : []);
        setSummary(summaryData);

        if (intelligence) {
          const next: Record<string, DepartmentMetrics> = {};
          for (const [id, row] of Object.entries(intelligence.departments ?? {})) {
            next[String(id)] = { ...EMPTY_METRICS, ...(row as Partial<DepartmentMetrics>) };
          }
          setMetrics(next);
          setSupport({ ...NO_SUPPORT, ...(intelligence.support ?? {}) });
        }
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

    deptApi.getTwin(tenantId, id)
      .then((twinData) => {
        if (token !== requestRef.current) return;
        setTwin(twinData);
      })
      .catch((e: any) => { if (token === requestRef.current) setError(e.message); })
      .finally(() => { if (token === requestRef.current) setTwinLoading(false); });
  };

  /**
   * ONE PAGE OF THE ROSTER, NARROWED ON THE SERVER.
   *
   * This screen used to call `listPeople`, which downloads the tenant's ENTIRE
   * workforce and filters it in the browser — 768 rows serialised, sent and
   * discarded on Fiber Valley so that ten could be rendered, and again on every
   * department switch and every keystroke of the search box.
   *
   * The unit filter, the search and the page are now all SQL, and `total` comes
   * from a COUNT on the same builder as the rows, so the pager cannot label a
   * page that a different filter produced.
   */
  const peopleRequestRef = useRef(0);

  const loadPeople = (id: string, pageIndex: number, query: string) => {
    if (!id) {
      setPeople([]);
      setPeopleTotal(0);
      setPeoplePages(1);
      return;
    }

    const token = ++peopleRequestRef.current;
    setPeopleLoading(true);

    personApi.listPeoplePage(tenantId, {
      unitId: id,
      q: query,
      page: pageIndex + 1,
      perPage: PAGE_SIZE,
    })
      .then((result) => {
        if (token !== peopleRequestRef.current) return;
        setPeople(result.people as PersonRow[]);
        setPeopleTotal(result.total);
        setPeoplePages(Math.max(1, result.pages));
        // The server clamps a page past the end; follow it rather than leaving
        // the pager pointing at a page that does not exist.
        if (result.page - 1 !== pageIndex) setPage(result.page - 1);
      })
      .catch(() => {
        if (token !== peopleRequestRef.current) return;
        setPeople([]);
        setPeopleTotal(0);
        setPeoplePages(1);
      })
      .finally(() => { if (token === peopleRequestRef.current) setPeopleLoading(false); });
  };

  useEffect(() => {
    setPage(0);
    setPersonSearch('');
    loadDepartment(selectedId);

    /*
      THE PROFILE IS ONE REQUEST, AND IT IS THE PAGE.

      Composed server-side from aggregates already cached for the tenant, so it
      costs about what the list costs. Failure is silent and the panels below
      simply do not render: the twin's own sections still work, and a screen
      that blanked because a secondary endpoint was unavailable is the failure
      this codebase keeps rediscovering.
    */
    setProfile(null);

    if (selectedId) {
      // Called through Promise.resolve so a SYNCHRONOUS throw — an api surface
      // without this method, which is what a stale bundle or an older mock
      // looks like — lands in the same catch as a failed request rather than
      // taking the render down with it.
      Promise.resolve()
        .then(() => deptApi.getProfile(tenantId, selectedId))
        .then((p) => setProfile(p))
        .catch(() => setProfile(null));
    }
  }, [tenantId, selectedId]);

  /*
    A SEARCH IS A REQUEST NOW, so it is debounced. Without the delay every
    keystroke would issue its own query; the request token in loadPeople keeps
    the answers in order, and this keeps their number sane.
  */
  useEffect(() => {
    const timer = window.setTimeout(() => loadPeople(selectedId, page, personSearch), personSearch ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [tenantId, selectedId, page, personSearch]);

  /* ------------------------------------------------------------------ model */


  /*
    THE DEPARTMENT'S OWN SCORE, and the peer set it is ranked against, from the
    one batched response. Both are derived by the SAME function the directory
    card uses, so a unit cannot read 78% on the list and 74% on its own page.
  */
  const own = metrics[String(selectedId)] ?? EMPTY_METRICS;

  const ownMetrics = useMemo<DepartmentMetrics>(() => ({
    ...own,
    // The shared headcount wins over the metrics row's own, for the same reason
    // it does on every other screen: one published number per department.
    people: Number(summary?.peoplePerDepartment?.[String(selectedId)] ?? own.people ?? 0) || 0,
  }), [own, summary, selectedId]);

  const scored = useMemo(
    () => departmentScore(ownMetrics, support, DEFAULT_THRESHOLDS),
    [ownMetrics, support],
  );



  // The rows for this page ARE the page: filtering and slicing happen in SQL.
  const pageCount = peoplePages;
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const pageRows = people;

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
      <PageHeader
        variant="detail"
        icon={<FolderTree />}
        eyebrow="Department Intelligence"
        title={department?.name ?? 'Department'}
        description={describeDepartment(department, ownMetrics, scored)}
        aside={(
          <DepartmentScoreRing
            score={scored.score}
            status={scored.status}
            label={scored.label}
            size={68}
            caption={scored.score === null ? 'Not enough data' : `${scored.measured.length} of ${scored.dimensions.length} measured`}
          />
        )}
        back={onBack ? { label: 'Departments', onClick: onBack } : null}
        meta={[
          department?.code ? { icon: <IdCard />, label: department.code, title: 'Department code' } : null,
        ]}
        actions={(
          <HeaderActions>
            {!departmentId && departments.length > 1 && (
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} aria-label="Choose a department">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="u-btn u-btn-secondary"
              onClick={() => loadDepartment(selectedId)}
              disabled={twinLoading}
            >
              <RefreshCw size={15} aria-hidden="true" /> {twinLoading ? 'Refreshing' : 'Refresh'}
            </button>
          </HeaderActions>
        )}
      />

      {twinLoading && !twin ? (
        <LoadingState label="Loading department intelligence…" />
      ) : !twin ? (
        <ErrorState message={error ?? 'This department could not be loaded.'} />
      ) : (
        <>
          {/*
            ONLY WHAT CAN BE DERIVED, AND NOTHING PADDED TO FILL THE ROW.

            The old row printed "Open risk signals 0" on every organization that
            has never attributed a signal to a department — a confident zero
            standing in for "we have never looked". Each tile below renders only
            when its family of data exists for this ORGANIZATION, and shows a
            stated empty state rather than a 0 when it exists but this unit has
            none of it. That distinction comes from the server's `support` flags
            and cannot be recovered from the counts alone.
          */}
          <section className="dept-stats-row" aria-label="Department indicators">
            <DepartmentStat
              label="People"
              value={ownMetrics.people}
              hint={ownMetrics.people === 0
                ? 'No people currently assigned'
                : `${ownMetrics.people === 1 ? 'Person' : 'People'} recorded in this unit`}
              tone={ownMetrics.people === 0 ? 'warn' : 'state'}
            />

            <DepartmentStat
              label="Intelligence"
              value={scored.score === null ? null : `${scored.score}%`}
              hint={scored.label ?? undefined}
              emptyHint="Not enough data"
              tone={scored.status === 'attention' ? 'crit' : scored.status === 'watch' ? 'warn' : 'good'}
            />

            {support.operational && (
              <DepartmentStat
                label="Work items"
                value={ownMetrics.operationalRecords}
                hint={ownMetrics.operationalCompletionRate === null
                  ? 'Imported records attributed to this unit'
                  : `${Math.round(ownMetrics.operationalCompletionRate * 100)}% completed`}
                emptyHint="No imported work"
                tone={ownMetrics.operationalCompletionRate === null
                  ? 'state'
                  : ownMetrics.operationalCompletionRate >= 0.75 ? 'good'
                    : ownMetrics.operationalCompletionRate >= 0.55 ? 'warn' : 'crit'}
              />
            )}

            {support.capability && (
              <DepartmentStat
                label="Capability coverage"
                value={ownMetrics.people > 0
                  ? `${Math.min(100, Math.round((ownMetrics.capabilityAssessedPeople / ownMetrics.people) * 100))}%`
                  : null}
                hint={`${ownMetrics.capabilityAssessedPeople.toLocaleString()} of ${ownMetrics.people.toLocaleString()} assessed`}
                emptyHint="No people to assess"
                tone={ownMetrics.capabilityAssessedPeople === 0 ? 'warn' : 'state'}
              />
            )}

            {support.signals && (
              <DepartmentStat
                label="Signals"
                value={ownMetrics.signalsTotal === 0 ? null : ownMetrics.signalsOpen}
                hint={`Open, of ${ownMetrics.signalsTotal.toLocaleString()} raised`}
                emptyHint="No active signals"
                tone={ownMetrics.signalsOpenHigh > 0 ? 'crit' : ownMetrics.signalsOpen > 0 ? 'warn' : 'good'}
              />
            )}

            {support.evidence && (
              <DepartmentStat
                label="Evidence"
                value={ownMetrics.evidenceCount === 0 ? null : ownMetrics.evidenceCount}
                hint={`Supporting ${ownMetrics.evidenceCount === 1 ? 'record' : 'records'} behind this unit's signals`}
                emptyHint="No evidence linked"
              />
            )}

            {support.cases && (
              <DepartmentStat
                label="Cases"
                value={ownMetrics.casesTotal === 0 ? null : ownMetrics.casesOpen}
                hint={`Active, of ${ownMetrics.casesTotal.toLocaleString()} opened`}
                emptyHint="No investigations"
                tone={ownMetrics.casesOpen > 0 ? 'warn' : 'good'}
              />
            )}

            {support.activity && ownMetrics.activityTotal > 0 && (
              <DepartmentStat
                label="Recent activity"
                value={ownMetrics.activityRecent}
                hint={`Recorded in 30 days, of ${ownMetrics.activityTotal.toLocaleString()} in total`}
                tone={ownMetrics.activityRecent > 0 ? 'good' : 'warn'}
              />
            )}
          </section>

          {/*
            THE PROFILE IS THE PAGE NOW.

            The old two-column grid rendered the score, its dimension meters and
            a handful of counts, and every other question the screen claims to
            answer — how busy, how fast, how it compares, what to do — had no
            panel at all. This renders the composed profile instead: the same
            score, plus the performance, workload, trend, contribution, ranking,
            narrative and next action derived from it.

            Rendered only when the profile arrived. There is no half-page: the
            older sections above (people, capabilities, raw detail) are
            independent of this request and keep working on their own.
          */}
          {profile && (
            <DepartmentProfileView
              profile={profile}
            />
          )}

          {/*
            THE ROSTER AND THE CAPABILITY REGISTER.

            Kept below the intelligence panels rather than beside them: the
            profile answers "how is this unit doing", and this answers "who is
            in it", which is the question a reader asks second. Paging and
            search are SERVER-SIDE — `pageRows` is the page, not a slice of a
            downloaded roster.
          */}
          <div className="dp-grid dp-grid--2">
            <section className="dp-card" aria-label="People in this department">
              <div className="dp-card__head">
                <h2>People</h2>
                <span className="dp-chip">{peopleTotal.toLocaleString()} recorded</span>
              </div>

              <label className="dp-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={personSearch}
                  placeholder="Search this department…"
                  onChange={(e) => { setPersonSearch(e.target.value); setPage(0); }}
                  aria-label="Search people in this department"
                />
              </label>

              {peopleLoading && pageRows.length === 0 ? (
                <p className="dp-note">Loading…</p>
              ) : pageRows.length === 0 ? (
                <p className="dp-empty">
                  {personSearch
                    ? 'Nobody in this department matches that search.'
                    : 'No one is assigned to this unit in the source system.'}
                </p>
              ) : (
                <>
                  <ul className="dp-people">
                    {pageRows.map((person) => (
                      <li key={person.id}>
                        <button
                          type="button"
                          className="dp-person"
                          onClick={() => onSelectPerson?.(person.id)}
                          disabled={!onSelectPerson}
                        >
                          <span className="dp-person__avatar" aria-hidden="true">{initials(person)}</span>
                          <span className="dp-person__body">
                            <span className="dp-person__name">{person.firstName} {person.lastName}</span>
                            <span className="dp-person__meta">
                              {person.designation || person.jobTitle || person.email || 'No role recorded'}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* The range and the total, so a reader knows the page is a
                      page and what it is a page OF. */}
                  <p className="dp-note">
                    Showing {(safePage * PAGE_SIZE) + 1}–{Math.min((safePage + 1) * PAGE_SIZE, peopleTotal)} of {peopleTotal.toLocaleString()}
                  </p>

                  {pageCount > 1 && (
                    <div className="dp-pager">
                      <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} aria-label="Previous page">
                        <ChevronLeft size={14} />
                      </button>
                      {pageWindow(safePage, pageCount).map((n, idx) => (
                        n === null
                          ? <span key={`gap-${idx}`} className="dp-pager__gap">…</span>
                          : <button
                              key={n}
                              type="button"
                              onClick={() => setPage(n)}
                              aria-current={n === safePage ? 'page' : undefined}
                              className={n === safePage ? 'is-current' : undefined}
                            >{n + 1}</button>
                      ))}
                      <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="dp-card" aria-label="Capabilities">
              <h2>Capabilities</h2>
              {(twin?.capabilityHeatmap ?? []).length === 0 ? (
                <p className="dp-empty">
                  No capability has been assigned to this department. Assigning one is what makes capability coverage
                  measurable — it is one of the dimensions the score above reports as unmeasurable.
                </p>
              ) : (
                <div className="dp-fields">
                  {(twin?.capabilityHeatmap ?? []).map((c) => (
                    <div key={c.capabilityId} className="dp-field">
                      <div className="dp-dim__head">
                        <span className="dp-dim__label">{capabilityNames[c.capabilityId] ?? 'Capability'}</span>
                        {/* averageLevel is a 0-5 proficiency, shown as the share
                            of the scale it reaches rather than as a percentage
                            of nothing. */}
                        <span className="dp-dim__value">{c.averageLevel.toFixed(1)} / 5</span>
                      </div>
                      <div className="dp-bar dp-bar--sm">
                        <i style={{ width: `${Math.max(2, (c.averageLevel / 5) * 100)}%` }} />
                      </div>
                      <p className="dp-dim__basis">Assessed across {c.assessedCount.toLocaleString()} people.</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
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
export function buildDepartmentIntelligenceModel({
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

function describeDepartment(
  department: Department | undefined,
  metrics: DepartmentMetrics,
  scored: ReturnType<typeof departmentScore>,
): string {
  if (!department) return 'Loading this unit’s intelligence…';

  /*
    NO SCORE IN THE SENTENCE WHEN THERE IS NO SCORE. The old version appended
    "health 50/100" to every unstaffed unit, which put the fabricated midpoint
    in a second place on the page.
  */
  const parts = [
    department.description?.trim() || null,
    metrics.people > 0
      ? `${metrics.people.toLocaleString()} ${metrics.people === 1 ? 'person' : 'people'}`
      : 'No people assigned',
    scored.score !== null ? `intelligence ${scored.score}%` : 'not enough data to score',
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

export function departmentScoreLabel(score: number): string {
  return score >= 85 ? 'Excellent' : score >= 65 ? 'Healthy' : score >= 45 ? 'Watch' : 'Needs Attention';
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






/**
 * The page numbers to draw: first, last, and a window around the current one.
 *
 * A department of 768 people is 77 pages, and 77 buttons is not a pager. `null`
 * marks an elided run, which the caller renders as an ellipsis.
 */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages = new Set<number>([0, total - 1, current]);
  for (const offset of [-1, 1]) {
    const page = current + offset;
    if (page > 0 && page < total - 1) pages.add(page);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push(null);
    out.push(page);
  });

  return out;
}
