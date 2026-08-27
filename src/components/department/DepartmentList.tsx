import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, RefreshCw, Search, UserCheck, UserMinus, Users } from 'lucide-react';
import type { Organization } from '../../App';
import { api as deptApi } from '../../api/department';
import { api as personApi } from '../../api/person';
import type { Department } from './DepartmentApp';
import AcademicSectionView from './AcademicSectionView';
import './DepartmentList.css';
import { CHART_PALETTE, STATUS_COLOR } from '../../ui/palette';

interface Props {
  organization: Organization;
  departments: Department[];
  loading: boolean;
  onSelect: (dept: Department) => void;
  onEdit: (dept: Department) => void;
  onArchive: (dept: Department) => void;
  onCreate: () => void;
  onRefresh: () => Promise<void> | void;
  onBack: () => void;
}

/**
 * The server's canonical answer to "how many departments, how many people".
 *
 * Every field here is computed once by App\Domain\Organization\FoundationCounts
 * and published identically to the Organization overview and the Intelligence
 * Workspace. Nothing on this screen may recompute them.
 */
interface FoundationSummary {
  departments: { total: number; active: number; inactive: number; supported: boolean };
  /** STAFF from the connected HR system. Never students. */
  people: { total: number; withoutUnit: number; inVisibleUnits: number; supported: boolean };
  /** Children derived from imported academic and fee files. A separate entity. */
  students: { total: number; inBothFiles: number; supported: boolean };
  records: { total: number };
  peoplePerDepartment: Record<string, number>;
}

interface DepartmentTwin {
  personCount?: number;
  capabilityHeatmap?: Array<{ averageLevel: number; assessedCount: number }>;
  openRiskSignalCount?: number;
  feeIntelligence?: {
    records: number;
    students: number;
    outstanding: number;
    expectedCollectable: number;
    collectionRate: number | null;
    criticalStudents: number;
    highStudents: number;
  } | null;
}

type SortKey = 'name' | 'status' | 'people' | 'updated';
type EnrichedDepartment = Department & {
  /** ERP staff in this unit, from the shared count. Never a student count. */
  peopleCount: number | null;
  /** School tenants only, and deliberately kept apart from peopleCount. */
  studentCount: number | null;
  headName: string | null;
  assessedCapabilities: number;
  atRiskPeople: number;
  feeIntelligence: DepartmentTwin['feeIntelligence'];
};

/* Shared with Signals and every other screen — see ui/palette. */
const PALETTE = CHART_PALETTE;
const STATUS_COLORS = STATUS_COLOR;

function normalized(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length ? text.toLowerCase() : fallback;
}

function displayLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? date.toLocaleDateString() : '—';
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function personLabel(person: { id: string; displayName?: string | null; firstName?: string | null; lastName?: string | null }): string {
  const display = String(person.displayName ?? '').trim();
  if (display) return display;
  const full = `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
  return full || `Person ${person.id}`;
}

/**
 * Departments — "how is this organization structured, and where are the gaps?"
 *
 * WHAT CAME OFF THIS SCREEN. Four pie/line charts and three "Layer 1 / Layer 2 /
 * Layer 3" cards, none of which answered that question. The worst was a
 * "Department Growth Trend" line: it bucketed departments by their `created_date`
 * in the source system, so for an organization whose units were all loaded in one
 * import it drew a single spike and called it growth. "Active vs Archived" and
 * "Head Assignment Status" were pie charts over two values each, restating a
 * number already on a KPI tile eight inches above.
 *
 * A department head was also printed as its raw foreign key — `headId` straight
 * into the markup — so the leadership line read "Head assigned / 4417". It now
 * resolves against the people list that this screen already loads.
 */
export default function DepartmentList({ organization, departments, loading, onSelect, onEdit, onArchive, onCreate, onRefresh, onBack }: Props) {
  const [summary, setSummary] = useState<FoundationSummary | null>(null);
  const [headNames, setHeadNames] = useState<Record<string, string>>({});
  const [twins, setTwins] = useState<Record<string, DepartmentTwin>>({});
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [leadershipFilter, setLeadershipFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [refreshing, setRefreshing] = useState(false);

  /*
    ONE REQUEST FOR THE COUNTS, instead of downloading the workforce.

    This screen used to fetch the tenant's ENTIRE people list — every row, on a
    tenant with 200,000 of them — purely to group it by department in the
    browser, and then fire one twin request per department on top. The counts
    now arrive pre-aggregated from a single GROUP BY, and they are the same
    numbers the Organization overview publishes, which the browser-side grouping
    could never guarantee.

    Twins are still fetched per department, because fee intelligence genuinely
    is per unit and has no aggregate endpoint. They stay best-effort: a twin
    that fails costs that card its fee panel and nothing else.
  */
  useEffect(() => {
    let cancelled = false;
    setEnrichmentLoading(true);
    Promise.all([
      deptApi.getSummary(organization.tenantId).catch(() => null),
      Promise.allSettled(departments.map((dept) => deptApi.getTwin(organization.tenantId, dept.id))),
    ])
      .then(([summaryRow, twinResults]) => {
        if (cancelled) return;
        setSummary((summaryRow as FoundationSummary | null) ?? null);
        const nextTwins: Record<string, DepartmentTwin> = {};
        twinResults.forEach((result, index) => {
          if (result.status === 'fulfilled') nextTwins[departments[index].id] = result.value;
        });
        setTwins(nextTwins);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setTwins({});
        }
      })
      .finally(() => {
        if (!cancelled) setEnrichmentLoading(false);
      });
    return () => { cancelled = true; };
  }, [organization.tenantId, organization.id, departments]);

  /*
    Head names, fetched ONE PERSON AT A TIME and only for units that name one.

    The screen used to download the whole workforce so it could turn a headId
    into a name — on a source system that has no department-head column at all,
    so the map it built was never read. This asks only for the heads that exist,
    which on today's ERPs is a request count of zero.
  */
  const headIds = useMemo(
    () => Array.from(new Set(departments.map((d) => d.headId).filter((id): id is string => Boolean(id)))),
    [departments],
  );

  useEffect(() => {
    if (headIds.length === 0) {
      setHeadNames({});
      return;
    }

    let cancelled = false;
    Promise.allSettled(headIds.map((id) => personApi.getPerson(organization.tenantId, id)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) next[headIds[index]] = personLabel(result.value);
        });
        setHeadNames(next);
      });

    return () => { cancelled = true; };
  }, [organization.tenantId, headIds]);

  const enriched = useMemo<EnrichedDepartment[]>(() => {
    const perDepartment = summary?.peoplePerDepartment ?? {};

    return departments.map((dept) => {
      const twin = twins[dept.id];
      const heatmap = twin?.capabilityHeatmap ?? [];
      const fee = twin?.feeIntelligence ?? null;

      return {
        ...dept,
        /*
          THE SHARED COUNT, and the twin only as a fallback when the summary
          could not be loaded. It used to read `fee.students ?? twin.personCount
          ?? …`, so on a school tenant every unit's "people" was a STUDENT
          count — which is how this screen came to publish thousands under a
          label the Organization overview used for staff.
        */
        peopleCount: perDepartment[dept.id] ?? twin?.personCount ?? null,
        studentCount: fee?.students ?? null,
        headName: dept.headId ? headNames[String(dept.headId)] ?? null : null,
        assessedCapabilities: heatmap.filter((cell) => Number(cell.assessedCount ?? 0) > 0).length,
        atRiskPeople: Number(((fee?.criticalStudents ?? 0) + (fee?.highStudents ?? 0)) || (twin?.openRiskSignalCount ?? 0)),
        feeIntelligence: fee,
      };
    });
  }, [departments, summary, twins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((dept) => {
        const status = normalized(dept.status, 'unknown');
        const type = normalized(dept.departmentType, 'unknown');
        const hasHead = Boolean(dept.headId);
        if (q && ![dept.name, dept.description, dept.headName, dept.departmentType, dept.status].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
        if (statusFilter && status !== statusFilter) return false;
        if (typeFilter && type !== typeFilter) return false;
        if (leadershipFilter === 'headed' && !hasHead) return false;
        if (leadershipFilter === 'missing' && hasHead) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'people') return (b.peopleCount ?? -1) - (a.peopleCount ?? -1);
        if (sortKey === 'updated') return (parseDate(b.updatedDate)?.getTime() ?? 0) - (parseDate(a.updatedDate)?.getTime() ?? 0);
        if (sortKey === 'status') return normalized(a.status, 'unknown').localeCompare(normalized(b.status, 'unknown'));
        return a.name.localeCompare(b.name);
      });
  }, [enriched, search, statusFilter, typeFilter, leadershipFilter, sortKey]);

  const model = useMemo(() => {
    const headed = filtered.filter((dept) => Boolean(dept.headId));
    const missingHeads = filtered.filter((dept) => !dept.headId);
    const feeRows = filtered.filter((dept) => dept.feeIntelligence);

    // Bars are sized by whichever population this unit actually holds:
    // students for a class section, staff for a department. The label above
    // them says which, so the two are never read as one number.
    const sizeRows = filtered
      .map((dept) => ({ name: dept.name, value: dept.studentCount ?? dept.peopleCount ?? 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const maxSize = Math.max(...sizeRows.map((row) => row.value), 1);

    const staffCounts = filtered.map((d) => d.peopleCount).filter((v): v is number => v !== null);

    return {
      /*
        THE CANONICAL COUNTS, not a length of whatever this screen happens to
        hold. `total` and `active` used to be derived from the FILTERED list, so
        typing in the search box changed the headline "Departments" figure and
        the Organization overview — which counts active units only — disagreed
        with it permanently. The filtered count still has a home: the "N of M"
        line beside the filters, which is where a view-dependent number belongs.
      */
      total: summary?.departments.total ?? departments.length,
      active: summary?.departments.active
        ?? departments.filter((d) => normalized(d.status, 'unknown') === 'active').length,
      people: summary?.people.total ?? null,
      peopleInVisibleUnits: summary?.people.inVisibleUnits ?? null,
      peopleWithoutUnit: summary?.people.withoutUnit ?? null,
      visible: filtered.length,
      headed,
      missingHeads,
      avgTeamSize: average(staffCounts),
      totalStudents: filtered.reduce((sum, dept) => sum + (dept.studentCount ?? 0), 0),
      feeRows,
      totalOutstanding: feeRows.reduce((sum, dept) => sum + Number(dept.feeIntelligence?.outstanding ?? 0), 0),
      avgCollection: average(feeRows.map((d) => d.feeIntelligence?.collectionRate).filter((v): v is number => v !== null && v !== undefined)),
      sizeRows: sizeRows.map((row) => ({ ...row, percent: row.value / maxSize })),
    };
  }, [filtered, departments, summary]);

  /**
   * Whether this organization's source system records department heads at all.
   *
   * It usually does not. DepartmentController::map() returns `headId => null`
   * unconditionally, with a comment noting the universal 'head' field has no
   * column behind it in this ERP — so on most tenants every department comes
   * back headless. Reporting that as "5 of 5 departments have no head", with a
   * red gap marker on every card, presents a missing FIELD as a missing PERSON
   * and asks the administrator to fix something they cannot fix from here.
   *
   * When not one department carries a head, the screen says the source does not
   * record them and drops the leadership column entirely. When some do, the
   * gaps among the rest are real and are shown.
   */
  const headsAreRecorded = useMemo(
    () => departments.some((dept) => Boolean(dept.headId)),
    [departments],
  );

  const options = useMemo(() => ({
    statuses: Array.from(new Set(departments.map((dept) => normalized(dept.status, 'unknown')))).sort(),
    types: Array.from(new Set(departments.map((dept) => normalized(dept.departmentType, 'unknown')))).sort(),
  }), [departments]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setLeadershipFilter('');
    setSortKey('name');
  };

  if (loading) return <div className="dept-intel__loading">Loading departments…</div>;

  /*
    A SCHOOL WITH NO HR DEPARTMENTS GETS ITS TEACHING SECTIONS INSTEAD.

    Lions has 7,445 children and zero rows in hrms_departments, so everything
    below this line would render an empty page. The section view is not a
    substitute for departments and does not pretend to be one — it says on its
    own header that the HR system records none — but it is the structure a head
    teacher actually navigates by. Only reached when there are no HR units AND
    there are students, so Fiber Valley and Sunrise are untouched.
  */
  if (departments.length === 0 && (summary?.students.total ?? 0) > 0) {
    return (
      <AcademicSectionView
        organization={organization}
        hrDepartmentCount={summary?.departments.total ?? 0}
        onBack={onBack}
      />
    );
  }

  const isSchool = model.feeRows.length > 0;
  const unitPlural = isSchool ? 'class sections' : 'departments';
  const memberPlural = isSchool ? 'students' : 'people';

  /*
    Say where the people are, rather than leaving a reader to notice that the
    per-unit numbers below do not add up to the tile above. Some staff sit in no
    unit at all, and some sit in units the source system carries but this
    organization does not display (ERP template rows). Both are real and both
    are named.
  */
  const peopleHint = model.people === null
    ? 'Count unavailable'
    : [
      model.peopleInVisibleUnits !== null && model.peopleInVisibleUnits !== model.people
        ? `${model.peopleInVisibleUnits.toLocaleString()} in these ${unitPlural}`
        : null,
      model.peopleWithoutUnit ? `${model.peopleWithoutUnit.toLocaleString()} unassigned` : null,
      model.avgTeamSize !== null && model.avgTeamSize > 0
        ? `${model.avgTeamSize.toFixed(model.avgTeamSize < 10 ? 1 : 0)} on average per unit`
        : null,
    ].filter(Boolean).join(' · ') || 'All mapped to a unit';

  return (
    <div className="dept-intel">
      <header className="dept-intel__header">
        <div>
          <span className="eb-page-kicker">Foundation</span>
          <h1>Department Performance</h1>
          <p>How {organization.name} is structured: each unit, who leads it, how many {memberPlural} are in it, and which units need attention.</p>
        </div>
        <div className="dept-intel__actions">
          <button className="dept-intel__ghost" onClick={onBack}>Back to Organization</button>
          <button onClick={onCreate}>+ New Department</button>
          <button className="dept-intel__refresh" onClick={refresh} disabled={refreshing || enrichmentLoading}>
            <RefreshCw size={15} />
            {refreshing || enrichmentLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {/*
        ZERO IS AN ANSWER, and the empty state states which question it answers.

        Lions holds 398,831 imported academic and fee rows and no HR department,
        so this screen is legitimately empty — but "no departments" beside a
        People screen listing 7,445 students reads as a screen that failed to
        load. The distinction is the point: classes, divisions and subjects are
        dimensions of the imported data and are shown on the student screens; a
        department is an HR unit and comes only from the connected source system.
      */}
      {departments.length === 0 ? (
        <div className="dept-intel__empty dept-intel__empty--page">
          <Building2 size={26} />
          <strong>This organization has no departments in its HR system</strong>
          <p>
            Departments are units of the connected HR system. Once they exist, each unit&apos;s head, size and
            capability coverage appear here, and staff can be assigned to them.
          </p>
          {(summary?.students.total ?? 0) > 0 && (
            <p>
              Imported academic and fee data is held separately: {(summary?.students.total ?? 0).toLocaleString()}{' '}
              students, organised by class, division and subject rather than by department. Those are
              dimensions of the imported files, not HR units, so they are not counted here.
            </p>
          )}
        </div>
      ) : (
        <>
          <section className="dept-intel__filters" aria-label="Department filters">
            <label className="dept-intel__search">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${unitPlural}…`} />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
              <option value="">All statuses</option>
              {options.statuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type filter">
              <option value="">All types</option>
              {options.types.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}
            </select>
            {headsAreRecorded && (
              <select value={leadershipFilter} onChange={(e) => setLeadershipFilter(e.target.value)} aria-label="Leadership filter">
                <option value="">All leadership</option>
                <option value="headed">Has a head</option>
                <option value="missing">No head assigned</option>
              </select>
            )}
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort order">
              <option value="name">Sort by name</option>
              <option value="status">Sort by status</option>
              <option value="people">Sort by size</option>
              <option value="updated">Sort by last updated</option>
            </select>
            <button className="dept-intel__ghost" onClick={clearFilters}>Reset</button>
            <span className="dept-intel__count">{model.visible.toLocaleString()} of {model.total.toLocaleString()} {unitPlural} shown</span>
          </section>

          <section className="dept-intel__kpis">
            <Kpi
              icon={<Building2 size={18} />}
              label={isSchool ? 'Class sections' : 'Departments'}
              value={model.total.toLocaleString()}
              hint={model.total === model.active
                ? 'All currently active'
                : `${model.active.toLocaleString()} active · ${(model.total - model.active).toLocaleString()} inactive`}
              tone="state"
            />
            {/* "Staff", matching the Organization overview tile it must agree
                with. Both count the connected HR roster; neither counts a
                student. */}
            <Kpi
              icon={<Users size={18} />}
              label="Staff"
              value={model.people === null ? '—' : model.people.toLocaleString()}
              hint={peopleHint}
              tone="state"
            />
            {isSchool && (
              <Kpi
                icon={<Users size={18} />}
                label="Students"
                value={model.totalStudents.toLocaleString()}
                hint="From imported academic & fee data, in the visible sections"
                tone="state"
              />
            )}
            {headsAreRecorded && (
              <>
                <Kpi
                  icon={<UserCheck size={18} />}
                  label="With a head"
                  value={model.headed.length.toLocaleString()}
                  hint={model.visible ? `${Math.round((model.headed.length / model.visible) * 100)}% of visible units` : '—'}
                  tone="good"
                />
                <Kpi
                  icon={<UserMinus size={18} />}
                  label="Without a head"
                  value={model.missingHeads.length.toLocaleString()}
                  hint={model.missingHeads.length > 0 ? 'Nobody accountable for these units' : 'Every unit has a head'}
                  tone={model.missingHeads.length > 0 ? 'crit' : 'good'}
                />
              </>
            )}
            {isSchool && (
              <>
                <Kpi
                  icon={<Users size={18} />}
                  label="Average collection"
                  value={formatPercent(model.avgCollection)}
                  hint="Collected against net fees"
                  tone={model.avgCollection !== null && model.avgCollection >= 0.5 ? 'good' : 'warn'}
                />
                <Kpi
                  icon={<AlertTriangle size={18} />}
                  label="Fees outstanding"
                  value={formatCurrency(model.totalOutstanding)}
                  hint="Across the visible sections"
                  tone={model.totalOutstanding > 0 ? 'warn' : 'good'}
                />
              </>
            )}
          </section>

          {/* Explain the absence rather than silently dropping the column. */}
          {!headsAreRecorded && departments.length > 0 && (
            <p className="dept-intel__notice">
              The connected source system does not record a head for its departments, so leadership coverage
              cannot be reported here. Everything else on this screen comes from that system directly.
            </p>
          )}

          {model.sizeRows.length > 0 && (
            <section className="dept-intel__card">
              <div className="dept-intel__card-head">
                <h2>Largest {unitPlural}</h2>
                <span>{isSchool ? 'students' : 'people'} per unit</span>
              </div>
              <div className="dept-intel__bars">
                {model.sizeRows.map((row, index) => (
                  <div className="dept-intel__bar-row" key={row.name}>
                    <span>{row.name}</span>
                    <div><i style={{ width: `${Math.max(row.percent * 100, 2)}%`, backgroundColor: PALETTE[index % PALETTE.length] }} /></div>
                    <strong>{row.value.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="dept-intel__directory">
            <div className="dept-intel__table-head">
              <div>
                <h2>All {unitPlural}</h2>
                <p>Select a unit to open its workspace.</p>
              </div>
              <span>{model.visible.toLocaleString()} shown</span>
            </div>
            {filtered.length === 0 ? (
              <div className="dept-intel__empty">No {unitPlural} match the current filters.</div>
            ) : (
              <div className="dept-intel__directory-grid">
                {filtered.map((dept) => {
                  const status = normalized(dept.status, 'unknown');
                  return (
                    <article className="dept-intel__unit-card" key={dept.id}>
                      <div className="dept-intel__unit-head">
                        <button className="dept-intel__link" onClick={() => onSelect(dept)}>{dept.name}</button>
                        <span className="dept-intel__badge" style={{ color: STATUS_COLORS[status] ?? STATUS_COLORS.unknown, backgroundColor: `${STATUS_COLORS[status] ?? STATUS_COLORS.unknown}1f` }}>{displayLabel(status)}</span>
                      </div>
                      <div className="dept-intel__unit-meta">
                        <span>{displayLabel(normalized(dept.departmentType, 'unknown'))}</span>
                        <span>Updated {formatDate(dept.updatedDate)}</span>
                      </div>
                      {dept.description && <p className="dept-intel__unit-desc">{dept.description}</p>}

                      {/*
                        auto-fit, not a fixed three columns. With two stats in a
                        `repeat(3, 1fr)` grid the third column sat empty on every
                        card, which is most of what made this screen read as
                        misaligned. The tiles now fill the row they are given.
                      */}
                      <div className="dept-intel__unit-stats">
                        {dept.studentCount !== null && (
                          <div>
                            <strong>{dept.studentCount.toLocaleString()}</strong>
                            <span>students</span>
                          </div>
                        )}
                        <div>
                          <strong>{dept.peopleCount === null ? '—' : dept.peopleCount.toLocaleString()}</strong>
                          <span>people</span>
                        </div>
                        {dept.feeIntelligence ? (
                          <>
                            <div>
                              <strong>{formatPercent(dept.feeIntelligence.collectionRate)}</strong>
                              <span>fees collected</span>
                            </div>
                            <div>
                              <strong>{dept.atRiskPeople.toLocaleString()}</strong>
                              <span>at-risk students</span>
                            </div>
                          </>
                        ) : (
                          <div>
                            <strong>{dept.assessedCapabilities > 0 ? dept.assessedCapabilities.toLocaleString() : '—'}</strong>
                            <span>capabilities assessed</span>
                          </div>
                        )}
                      </div>

                      {dept.feeIntelligence && (
                        <div className="dept-intel__unit-meta">
                          <span>{formatCurrency(dept.feeIntelligence.outstanding)} outstanding</span>
                          <span>{formatCurrency(dept.feeIntelligence.expectedCollectable)} expected</span>
                        </div>
                      )}

                      {headsAreRecorded && (
                        <div className="dept-intel__leadership-line">
                          {dept.headId ? (
                            <>
                              <span className="ok">Head</span>
                              <em>{dept.headName ?? 'Not in the current people list'}</em>
                            </>
                          ) : (
                            <>
                              <span className="gap">No head assigned</span>
                              <em>Nobody is accountable for this unit</em>
                            </>
                          )}
                        </div>
                      )}

                      <div className="dept-intel__row-actions">
                        <button onClick={() => onSelect(dept)}>Open</button>
                        <button onClick={() => onEdit(dept)}>Edit</button>
                        <button onClick={() => onArchive(dept)}>Archive</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

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
