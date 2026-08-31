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
  departmentScore, departmentInsights, departmentPosition, scoreStatus,
  type DepartmentMetrics, type DepartmentSupport,
} from '../department/departmentScore';
import { DepartmentScoreRing, DepartmentMeter, DepartmentStat } from '../department/DepartmentScoreRing';
import '../department/DepartmentList.css';
import './DepartmentIntelligence.css';
import '../department/department.css';

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

  const model = useMemo(
    () => buildDepartmentIntelligenceModel({ twin, departments, summary, people }),
    [twin, departments, summary, people],
  );

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

  const insights = useMemo(
    () => departmentInsights(ownMetrics, support, scored, DEFAULT_THRESHOLDS),
    [ownMetrics, support, scored],
  );

  const position = useMemo(() => {
    const scores = new Map<string, number | null>();

    for (const dept of departments) {
      const row = metrics[String(dept.id)];
      if (!row) continue;
      const headcount = Number(summary?.peoplePerDepartment?.[String(dept.id)] ?? row.people ?? 0) || 0;
      scores.set(String(dept.id), departmentScore({ ...row, people: headcount }, support).score);
    }

    return departmentPosition(scores, String(selectedId));
  }, [departments, metrics, summary, support, selectedId]);

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

          <div className="di-grid">
            <div className="di-column">
              <section className="dept-intel__card di-health" aria-label="Department intelligence">
                <div className="dept-intel__card-head">
                  <h2>Department intelligence</h2>
                  <span>{`${scored.measured.length} of ${scored.dimensions.length} dimensions measured`}</span>
                </div>

                {scored.score === null ? (
                  /*
                    NO NUMBER, AND THE REASON IN WORDS.

                    The old page published 50/100 here for any unit with nobody
                    in it — the mean of "nothing is here" and "nothing is wrong
                    here". A sentence naming what is missing is a better answer
                    than a midpoint, and it is the only one that tells the
                    organization what to do next.
                  */
                  <p className="di-note di-note--empty">{scored.unscoredReason}</p>
                ) : (
                  <div className="di-health__body">
                    <DepartmentScoreRing
                      score={scored.score}
                      status={scored.status}
                      label={scored.label}
                      size={104}
                    />
                    <div className="di-health__components">
                      {scored.dimensions.map((dimension) => (
                        <DepartmentMeter
                          key={dimension.key}
                          label={dimension.label}
                          score={dimension.score}
                          status={dimension.score === null ? null : scoreStatusFor(dimension.score)}
                          basis={dimension.basis}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <p className="di-note">
                  The score is the weighted mean of the dimensions this organization can actually measure. A dimension
                  it does not record is left out and its weight redistributed — never counted as zero — so a department
                  is never marked down for data the source system has never held.
                </p>
              </section>

              {/*
                WHAT THIS DEPARTMENT TELLS US.

                Every line is derived from the counts above; nothing here is a
                template with a name dropped into it, which is why a department
                can legitimately produce no insight at all.
              */}
              <section className="dept-intel__card" aria-label="What this department tells us">
                <div className="dept-intel__card-head">
                  <h2>What this department tells us</h2>
                  <span>
                    {insights.strengths.length + insights.risks.length + insights.focus.length}
                    {' '}
                    {insights.strengths.length + insights.risks.length + insights.focus.length === 1 ? 'observation' : 'observations'}
                  </span>
                </div>

                {insights.empty ? (
                  <p className="di-note di-note--empty">
                    Not enough evidence to generate a reliable department insight. Insights appear as people are
                    assigned, capabilities assessed, and signals or decisions recorded against this unit.
                  </p>
                ) : (
                  <div className="di-insights">
                    <InsightGroup title="Strengths" tone="good" items={insights.strengths} />
                    <InsightGroup title="Risks" tone="crit" items={insights.risks} />
                    <InsightGroup title="Focus areas" tone="warn" items={insights.focus} />
                  </div>
                )}
              </section>

              {/*
                CAPABILITIES, WITH A USEFUL ABSENCE.

                "Capabilities: 0" told a reader nothing they could act on. The
                three states below are genuinely different and each says what to
                do: this organization does not assess capability at all; it does,
                and this unit has not been assessed; or here is what it holds.
              */}
              <section className="dept-intel__card" aria-label="Capabilities">
                <div className="dept-intel__card-head">
                  <h2>Capabilities</h2>
                  {model.capability && <span>{model.capability.cells.length} assessed</span>}
                </div>

                {!support.capability ? (
                  <p className="di-note di-note--empty">
                    No capability has been assigned anywhere in this organization yet. Assign capabilities to this
                    department to measure capability coverage and identify skill gaps.
                  </p>
                ) : !model.capability ? (
                  <p className="di-note di-note--empty">
                    No capability assigned to this department has been assessed, although other departments have
                    assessments recorded. Assess the people here to compare its strengths and gaps with theirs.
                  </p>
                ) : (
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
                    <p className="di-note">
                      {`${ownMetrics.capabilityAssessedPeople.toLocaleString()} of ${ownMetrics.people.toLocaleString()} `}
                      {ownMetrics.people === 1 ? 'person has' : 'people have'} been assessed, averaging out of 5.
                    </p>
                  </div>
                )}
              </section>

              <section className="dept-intel__directory" aria-label="People in this department">
                <div className="dept-intel__table-head">
                  <div>
                    <h2>People</h2>
                    <p>
                      {peopleTotal === 0
                        ? 'Nobody in the source system is assigned to this unit.'
                        : `${peopleTotal.toLocaleString()} ${peopleTotal === 1 ? 'person' : 'people'} — select one to open their profile.`}
                    </p>
                  </div>
                  {/*
                    The search box stays available whenever the unit has anyone,
                    because it now queries the SERVER: it can find someone on
                    page 40 without that page ever having been loaded, which the
                    old client-side filter over one page could not.
                  */}
                  {peopleTotal > 0 && (
                    <label className="dept-intel__search di-people__search">
                      <Search size={15} />
                      <input
                        value={personSearch}
                        onChange={(e) => { setPersonSearch(e.target.value); setPage(0); }}
                        placeholder="Search people…"
                        aria-label="Search people in this department"
                      />
                    </label>
                  )}
                </div>

                {pageRows.length === 0 ? (
                  <p className="di-note di-note--empty">
                    {peopleLoading
                      ? 'Loading people…'
                      : personSearch.trim()
                        ? `No one in this department matches “${personSearch.trim()}”.`
                        : 'No people in the source system are assigned to this unit.'}
                  </p>
                ) : (
                  <>
                    <ul className="di-people" data-loading={peopleLoading || undefined}>
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
                      PAGINATED IN SQL, NOT SCROLLED. A department of 768 people
                      rendered as one column is a page nobody reaches the bottom
                      of, and it pushes every panel below it off screen. The page
                      numbers are windowed so a 77-page department does not draw
                      77 buttons.
                    */}
                    {pageCount > 1 && (
                      <nav className="di-pager" aria-label="People pages">
                        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                          <ChevronLeft size={15} /> Previous
                        </button>

                        <span className="di-pager__pages">
                          {pageWindow(safePage, pageCount).map((entry, index) => (
                            entry === null ? (
                              <span key={`gap-${index}`} className="di-pager__gap" aria-hidden="true">…</span>
                            ) : (
                              <button
                                key={entry}
                                type="button"
                                className="di-pager__page"
                                aria-current={entry === safePage ? 'page' : undefined}
                                onClick={() => setPage(entry)}
                              >
                                {entry + 1}
                              </button>
                            )
                          ))}
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

                    <p className="di-note">
                      {`Showing ${(safePage * PAGE_SIZE + 1).toLocaleString()}–${Math.min(peopleTotal, safePage * PAGE_SIZE + pageRows.length).toLocaleString()} of ${peopleTotal.toLocaleString()}.`}
                    </p>
                  </>
                )}
              </section>
            </div>

            <div className="di-column">
              {/*
                DEPARTMENT POSITION.

                Computed from the scores actually published, never from the
                department list: a unit that could not be scored is excluded
                from the average rather than entering it as a zero, because six
                unscored units would drag the organization average to a figure
                no department recognises and "#2 of 13" would be a ranking
                against units that were never in the race.
              */}
              <section className="dept-intel__card" aria-label="Department position">
                <div className="dept-intel__card-head">
                  <h2>Department position</h2>
                  <span>{position.scoredPeers} scored</span>
                </div>

                {position.rank === null || position.organizationAverage === null ? (
                  <p className="di-note di-note--empty">
                    {scored.score === null
                      ? 'This department is not scored, so it cannot be ranked against the others.'
                      : `A ranking needs at least two scored departments to compare against; this organization has ${position.scoredPeers}.`}
                  </p>
                ) : (
                  <dl className="di-benchmark">
                    <div>
                      <dt>Organization average</dt>
                      <dd>
                        <strong>{position.organizationAverage}%</strong>
                        <small>Across {position.scoredPeers} scored {position.scoredPeers === 1 ? 'department' : 'departments'}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>This department</dt>
                      <dd>
                        <strong>{scored.score}%</strong>
                        <small>{scored.label}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Position</dt>
                      <dd>
                        <strong>#{position.rank} of {position.scoredPeers}</strong>
                        <small>
                          {position.unscored > 0
                            ? `${position.unscored} further ${position.unscored === 1 ? 'unit is' : 'units are'} not scored and excluded`
                            : 'Every recorded unit is scored'}
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>Difference</dt>
                      <dd>
                        <strong>{(position.delta ?? 0) >= 0 ? '+' : ''}{position.delta} pts</strong>
                        <small>Against the organization average</small>
                      </dd>
                    </div>
                  </dl>
                )}
              </section>

              <section className="dept-intel__card" aria-label="Size against other departments">
                <div className="dept-intel__card-head">
                  {/* SIZE IS REPORTED, NEVER SCORED. Being large is not being
                      healthy — the old model scored headcount against the median
                      and graded the biggest unit "Excellent" for it. These are
                      the same facts, stated rather than graded. */}
                  <h2>Size and share</h2>
                  <span>{model.peerCount} {model.peerCount === 1 ? 'peer' : 'peers'}</span>
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


/**
 * A dimension's own band, so a meter is coloured by its own value rather than
 * by the department's composite. A unit scoring 88 overall with capability at
 * 40 must show that meter in the attention colour, not the healthy one.
 */
function scoreStatusFor(score: number) {
  return scoreStatus(score, DEFAULT_THRESHOLDS);
}

/**
 * One group of insights, rendered only when it has something to say.
 *
 * An empty "Strengths" heading over nothing is the kind of hollow furniture
 * this pass exists to remove, so the group returns null rather than a heading
 * with an empty list under it.
 */
function InsightGroup({ title, tone, items }: {
  title: string;
  tone: 'good' | 'warn' | 'crit';
  items: { title: string; detail: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="di-insight-group" data-tone={tone}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
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
