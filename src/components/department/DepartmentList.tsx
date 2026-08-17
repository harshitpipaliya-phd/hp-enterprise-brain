import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Building2, RefreshCw, Search, UserCheck, UserMinus, Users } from 'lucide-react';
import type { Organization } from '../../App';
import { api as deptApi } from '../../api/department';
import { api as personApi } from '../../api/person';
import type { Department } from './DepartmentApp';
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

interface PersonRow {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  orgId?: string | null;
  departmentId?: string | null;
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
  peopleCount: number | null;
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

function personLabel(person: PersonRow): string {
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
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [twins, setTwins] = useState<Record<string, DepartmentTwin>>({});
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [leadershipFilter, setLeadershipFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEnrichmentLoading(true);
    Promise.all([
      personApi.listPeople(organization.tenantId, organization.id),
      Promise.allSettled(departments.map((dept) => deptApi.getTwin(organization.tenantId, dept.id))),
    ])
      .then(([peopleRows, twinResults]) => {
        if (cancelled) return;
        setPeople(Array.isArray(peopleRows) ? peopleRows : []);
        const nextTwins: Record<string, DepartmentTwin> = {};
        twinResults.forEach((result, index) => {
          if (result.status === 'fulfilled') nextTwins[departments[index].id] = result.value;
        });
        setTwins(nextTwins);
      })
      .catch(() => {
        if (!cancelled) {
          setPeople([]);
          setTwins({});
        }
      })
      .finally(() => {
        if (!cancelled) setEnrichmentLoading(false);
      });
    return () => { cancelled = true; };
  }, [organization.tenantId, organization.id, departments]);

  const peopleById = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach((person) => map.set(String(person.id), personLabel(person)));
    return map;
  }, [people]);

  const enriched = useMemo<EnrichedDepartment[]>(() => {
    const peopleCounts = people.reduce<Record<string, number>>((acc, person) => {
      const key = String(person.departmentId ?? '');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return departments.map((dept) => {
      const twin = twins[dept.id];
      const heatmap = twin?.capabilityHeatmap ?? [];
      const fee = twin?.feeIntelligence ?? null;
      const peopleCount = fee?.students ?? twin?.personCount ?? peopleCounts[dept.id] ?? null;
      return {
        ...dept,
        peopleCount,
        headName: dept.headId ? peopleById.get(String(dept.headId)) ?? null : null,
        assessedCapabilities: heatmap.filter((cell) => Number(cell.assessedCount ?? 0) > 0).length,
        atRiskPeople: Number(((fee?.criticalStudents ?? 0) + (fee?.highStudents ?? 0)) || (twin?.openRiskSignalCount ?? 0)),
        feeIntelligence: fee,
      };
    });
  }, [departments, people, peopleById, twins]);

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
    const active = filtered.filter((dept) => normalized(dept.status, 'unknown') === 'active');
    const headed = filtered.filter((dept) => Boolean(dept.headId));
    const missingHeads = filtered.filter((dept) => !dept.headId);
    const counts = filtered.map((dept) => dept.peopleCount).filter((value): value is number => value !== null);
    const feeRows = filtered.filter((dept) => dept.feeIntelligence);
    const sizeRows = filtered
      .filter((dept) => dept.peopleCount !== null && dept.peopleCount > 0)
      .map((dept) => ({ name: dept.name, value: dept.peopleCount ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const maxSize = Math.max(...sizeRows.map((row) => row.value), 1);

    return {
      total: filtered.length,
      active,
      headed,
      missingHeads,
      avgTeamSize: average(counts),
      totalPeople: counts.reduce((sum, value) => sum + value, 0),
      feeRows,
      totalOutstanding: feeRows.reduce((sum, dept) => sum + Number(dept.feeIntelligence?.outstanding ?? 0), 0),
      avgCollection: average(feeRows.map((d) => d.feeIntelligence?.collectionRate).filter((v): v is number => v !== null && v !== undefined)),
      sizeRows: sizeRows.map((row) => ({ ...row, percent: row.value / maxSize })),
    };
  }, [filtered]);

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

  const isSchool = model.feeRows.length > 0;
  const unitPlural = isSchool ? 'class sections' : 'departments';
  const memberPlural = isSchool ? 'students' : 'people';

  return (
    <div className="dept-intel">
      <header className="dept-intel__header">
        <div>
          <h1>Departments</h1>
          <p>How {organization.name} is structured: each unit, who leads it, and how many {memberPlural} are in it.</p>
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

      {departments.length === 0 ? (
        <div className="dept-intel__empty dept-intel__empty--page">
          <Building2 size={26} />
          <strong>No departments are recorded for this organization</strong>
          <p>
            Departments come from the connected HR system. Once they exist, each unit&apos;s head, size and
            capability coverage appear here, and people can be assigned to them.
          </p>
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
            <span className="dept-intel__count">{model.total.toLocaleString()} of {departments.length.toLocaleString()} {unitPlural}</span>
          </section>

          <section className="dept-intel__kpis">
            <Kpi
              icon={<Building2 size={18} />}
              label={isSchool ? 'Class sections' : 'Departments'}
              value={model.total.toLocaleString()}
              hint={`${model.active.length.toLocaleString()} active`}
              tone="state"
            />
            <Kpi
              icon={<Users size={18} />}
              label={isSchool ? 'Students' : 'People'}
              value={model.totalPeople.toLocaleString()}
              hint={model.avgTeamSize === null ? 'No counts available' : `${model.avgTeamSize.toFixed(model.avgTeamSize < 10 ? 1 : 0)} on average per unit`}
              tone="state"
            />
            {headsAreRecorded && (
              <>
                <Kpi
                  icon={<UserCheck size={18} />}
                  label="With a head"
                  value={model.headed.length.toLocaleString()}
                  hint={model.total ? `${Math.round((model.headed.length / model.total) * 100)}% of visible units` : '—'}
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
              <span>{model.total.toLocaleString()} shown</span>
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

                      <div className="dept-intel__unit-stats">
                        <div>
                          <strong>{dept.peopleCount === null ? '—' : dept.peopleCount.toLocaleString()}</strong>
                          <span>{isSchool ? 'students' : 'people'}</span>
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
