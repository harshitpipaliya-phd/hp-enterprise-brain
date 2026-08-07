import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Building2, Network, RefreshCw, Search, ShieldCheck, UserCheck, UserMinus, Users } from 'lucide-react';
import type { Organization } from '../../App';
import { api as deptApi } from '../../api/department';
import { api as personApi } from '../../api/person';
import type { Department } from './DepartmentApp';
import './DepartmentList.css';

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
  orgId?: string | null;
  departmentId?: string | null;
}

interface DepartmentTwin {
  personCount?: number;
  capabilityHeatmap?: Array<{ averageLevel: number; assessedCount: number }>;
  openRiskSignalCount?: number;
  decisionCount?: number;
  decisionApprovalRate?: number | null;
}

type SortKey = 'name' | 'status' | 'people' | 'coverage' | 'updated';
type DistributionRow = { name: string; value: number; percent: number };
type EnrichedDepartment = Department & {
  peopleCount: number | null;
  coverage: number | null;
  assessedCapabilities: number;
  openRiskSignals: number;
  decisionCount: number;
  decisionApprovalRate: number | null;
};

const PALETTE = ['#2f7f93', '#a8892f', '#bd2f68', '#7b68b4', '#5aa8ba', '#596780', '#8b6f2f'];
const STATUS_COLORS: Record<string, string> = {
  active: '#2f7f93',
  inactive: '#a8892f',
  archived: '#7c8496',
  unknown: '#7c8496',
};

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
  return value === null ? '-' : `${Math.round(value * 100)}%`;
}

function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? date.toLocaleDateString() : '-';
}

function countBy<T>(items: T[], pick: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = pick(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function distribution(counts: Record<string, number>): DistributionRow[] {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value, percent: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function coverageFromTwin(twin: DepartmentTwin | null | undefined): number | null {
  const heatmap = twin?.capabilityHeatmap ?? [];
  const assessed = heatmap.filter((cell) => Number(cell.assessedCount ?? 0) > 0);
  if (assessed.length === 0) return null;
  const meanLevel = average(assessed.map((cell) => Math.max(0, Math.min(Number(cell.averageLevel ?? 0), 5))));
  return meanLevel === null ? null : meanLevel / 5;
}

function buildGrowthTrend(departments: Department[]) {
  const dates = departments.map((dept) => parseDate(dept.createdDate)).filter((date): date is Date => date !== null);
  if (dates.length === 0) return [];
  const now = new Date();
  const earliest = new Date(Math.min(...dates.map((date) => date.getTime())));
  const days = Math.max(1, Math.ceil((now.getTime() - earliest.getTime()) / 86_400_000));
  const bucketCount = Math.min(12, Math.max(1, days));
  const bucketSize = Math.max(1, Math.ceil(days / bucketCount));
  const start = new Date(now.getTime() - (bucketCount - 1) * bucketSize * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const rows = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index * bucketSize);
    return { label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 };
  });

  departments.forEach((dept) => {
    const date = parseDate(dept.createdDate);
    if (!date || date < start || date > now) return;
    const index = Math.floor(Math.max(0, (date.getTime() - start.getTime()) / 86_400_000) / bucketSize);
    if (rows[index]) rows[index].count += 1;
  });

  return rows;
}

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

  const enriched = useMemo<EnrichedDepartment[]>(() => {
    const peopleCounts = countBy(people, (person) => String(person.departmentId ?? ''));
    return departments.map((dept) => {
      const twin = twins[dept.id];
      const heatmap = twin?.capabilityHeatmap ?? [];
      const peopleCount = twin?.personCount ?? peopleCounts[dept.id] ?? null;
      return {
        ...dept,
        peopleCount,
        coverage: coverageFromTwin(twin),
        assessedCapabilities: heatmap.filter((cell) => Number(cell.assessedCount ?? 0) > 0).length,
        openRiskSignals: Number(twin?.openRiskSignalCount ?? 0),
        decisionCount: Number(twin?.decisionCount ?? 0),
        decisionApprovalRate: twin?.decisionApprovalRate ?? null,
      };
    });
  }, [departments, people, twins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched
      .filter((dept) => {
        const status = normalized(dept.status, 'unknown');
        const type = normalized(dept.departmentType, 'unknown');
        const hasHead = Boolean(dept.headId);
        if (q && ![dept.name, dept.description, dept.headId, dept.departmentType, dept.status].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
        if (statusFilter && status !== statusFilter) return false;
        if (typeFilter && type !== typeFilter) return false;
        if (leadershipFilter === 'headed' && !hasHead) return false;
        if (leadershipFilter === 'missing' && hasHead) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'people') return (b.peopleCount ?? -1) - (a.peopleCount ?? -1);
        if (sortKey === 'coverage') return (b.coverage ?? -1) - (a.coverage ?? -1);
        if (sortKey === 'updated') return (parseDate(b.updatedDate)?.getTime() ?? 0) - (parseDate(a.updatedDate)?.getTime() ?? 0);
        if (sortKey === 'status') return normalized(a.status, 'unknown').localeCompare(normalized(b.status, 'unknown'));
        return a.name.localeCompare(b.name);
      });
  }, [enriched, search, statusFilter, typeFilter, leadershipFilter, sortKey]);

  const model = useMemo(() => {
    const active = filtered.filter((dept) => normalized(dept.status, 'unknown') === 'active');
    const archived = filtered.filter((dept) => normalized(dept.status, 'unknown') === 'archived');
    const inactive = filtered.filter((dept) => normalized(dept.status, 'unknown') === 'inactive');
    const headed = filtered.filter((dept) => Boolean(dept.headId));
    const missingHeads = filtered.filter((dept) => !dept.headId);
    const counts = filtered.map((dept) => dept.peopleCount).filter((value): value is number => value !== null);
    const coverages = filtered.map((dept) => dept.coverage).filter((value): value is number => value !== null);
    const riskDepartments = filtered.filter((dept) => dept.openRiskSignals > 0);
    const sizeRows = filtered
      .filter((dept) => dept.peopleCount !== null)
      .map((dept) => ({ name: dept.name, value: dept.peopleCount ?? 0, percent: 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const maxSize = Math.max(...sizeRows.map((row) => row.value), 1);
    const statusRows = distribution(countBy(filtered, (dept) => normalized(dept.status, 'unknown')));
    const typeRows = distribution(countBy(filtered, (dept) => normalized(dept.departmentType, 'unknown')));
    const leadershipRows = distribution({
      assigned: headed.length,
      missing: missingHeads.length,
    });
    const coverageRows = distribution({
      high: filtered.filter((dept) => dept.coverage !== null && dept.coverage >= 0.75).length,
      medium: filtered.filter((dept) => dept.coverage !== null && dept.coverage >= 0.4 && dept.coverage < 0.75).length,
      low: filtered.filter((dept) => dept.coverage !== null && dept.coverage < 0.4).length,
      unknown: filtered.filter((dept) => dept.coverage === null).length,
    });

    return {
      total: filtered.length,
      active,
      archived,
      inactive,
      headed,
      missingHeads,
      avgTeamSize: average(counts),
      avgCoverage: average(coverages),
      riskDepartments,
      sizeRows: sizeRows.map((row) => ({ ...row, percent: maxSize ? row.value / maxSize : 0 })),
      statusRows,
      typeRows,
      leadershipRows,
      coverageRows,
      growthRows: buildGrowthTrend(filtered),
    };
  }, [filtered]);

  const options = useMemo(() => ({
    statuses: Object.keys(countBy(departments, (dept) => normalized(dept.status, 'unknown'))).sort(),
    types: Object.keys(countBy(departments, (dept) => normalized(dept.departmentType, 'unknown'))).sort(),
  }), [departments]);

  const insights = useMemo(() => {
    const activeRate = model.total ? model.active.length / model.total : null;
    const lastGrowth = model.growthRows.length > 0 ? model.growthRows[model.growthRows.length - 1].count : 0;
    return [
      {
        label: 'Layer 1 - State',
        title: 'Current State',
        body: model.total === 0
          ? 'No departments match the current filters.'
          : `${model.active.length.toLocaleString()} active departments are visible, representing ${formatPercent(activeRate)} of the filtered structure.`,
        tone: 'state',
      },
      {
        label: 'Layer 2 - Movement',
        title: 'Structure Movement',
        body: model.growthRows.length > 0
          ? `${lastGrowth.toLocaleString()} departments were created in the latest visible time bucket; ${model.archived.length.toLocaleString()} are archived in the filtered view.`
          : 'No creation timestamps are available for trend analysis in the current data.',
        tone: 'movement',
      },
      {
        label: 'Layer 3 - Consequence',
        title: 'Leadership Risk',
        body: model.missingHeads.length > 0
          ? `${model.missingHeads.length.toLocaleString()} departments have no assigned head in the API response.`
          : 'Every filtered department has an assigned head.',
        tone: model.missingHeads.length > 0 ? 'impact' : 'state',
      },
      {
        label: 'Operations',
        title: 'Operating Load',
        body: model.avgTeamSize === null
          ? 'Team size could not be calculated because no people counts are available.'
          : `Average team size is ${model.avgTeamSize.toFixed(model.avgTeamSize < 10 ? 1 : 0)} people; ${model.riskDepartments.length.toLocaleString()} departments report open risk signals.`,
        tone: model.riskDepartments.length > 0 ? 'impact' : 'movement',
      },
    ] as Array<{ label: string; title: string; body: string; tone: 'state' | 'movement' | 'impact' }>;
  }, [model]);

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

  if (loading) return <div className="dept-intel__loading">Loading departments...</div>;

  return (
    <div className="dept-intel">
      <header className="dept-intel__header">
        <div>
          <div className="dept-intel__eyebrow">Organization Intelligence</div>
          <h1>Departments</h1>
          <p>{organization.name}: how is this organization structured, where are leadership gaps, and which units need attention?</p>
        </div>
        <div className="dept-intel__actions">
          <button className="dept-intel__ghost" onClick={onBack}>Back to Organizations</button>
          <button onClick={onCreate}>+ New Department</button>
          <button className="dept-intel__refresh" onClick={refresh} disabled={refreshing || enrichmentLoading}>
            <RefreshCw size={15} />
            {refreshing || enrichmentLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="dept-intel__filters" aria-label="Department filters">
        <label className="dept-intel__search">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search departments..." />
        </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {options.statuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {options.types.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}
        </select>
        <select value={leadershipFilter} onChange={(e) => setLeadershipFilter(e.target.value)}>
          <option value="">All leadership</option>
          <option value="headed">Assigned heads</option>
          <option value="missing">Missing heads</option>
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="name">Sort by name</option>
          <option value="status">Sort by status</option>
          <option value="people">Sort by team size</option>
          <option value="coverage">Sort by coverage</option>
          <option value="updated">Sort by last updated</option>
        </select>
        <button className="dept-intel__ghost" onClick={clearFilters}>Reset</button>
        <span className="dept-intel__count">{model.total.toLocaleString()} of {departments.length.toLocaleString()} departments</span>
      </section>

      <section className="dept-intel__kpis">
        <Kpi icon={<Building2 size={18} />} label="Total Departments" value={model.total.toLocaleString()} hint="Filtered department records" tone="state" />
        <Kpi icon={<Activity size={18} />} label="Active Departments" value={model.active.length.toLocaleString()} hint={`${model.inactive.length.toLocaleString()} inactive`} tone={model.active.length > 0 ? 'good' : 'warn'} />
        <Kpi icon={<UserCheck size={18} />} label="Departments With Heads" value={model.headed.length.toLocaleString()} hint={formatPercent(model.total ? model.headed.length / model.total : null)} tone="good" />
        <Kpi icon={<UserMinus size={18} />} label="Departments Without Heads" value={model.missingHeads.length.toLocaleString()} hint="Leadership assignment gaps" tone={model.missingHeads.length > 0 ? 'crit' : 'good'} />
        <Kpi icon={<Users size={18} />} label="Average Team Size" value={model.avgTeamSize === null ? '-' : model.avgTeamSize.toFixed(model.avgTeamSize < 10 ? 1 : 0)} hint="Calculated from people API" tone="state" />
        <Kpi icon={<ShieldCheck size={18} />} label="Average Capability Coverage" value={formatPercent(model.avgCoverage)} hint="From department twin heatmaps" tone={model.avgCoverage !== null && model.avgCoverage >= 0.5 ? 'good' : 'warn'} />
        <Kpi icon={<AlertTriangle size={18} />} label="Departments With Risk" value={model.riskDepartments.length.toLocaleString()} hint="Open risk signals reported" tone={model.riskDepartments.length > 0 ? 'crit' : 'good'} />
      </section>

      <section className="dept-intel__summary">
        {insights.map((insight) => (
          <article className={`dept-intel__summary-card dept-intel__summary-card--${insight.tone}`} key={insight.title}>
            <div className="dept-intel__summary-label">{insight.label}</div>
            <h2>{insight.title}</h2>
            <p>{insight.body}</p>
          </article>
        ))}
      </section>

      <section className="dept-intel__grid dept-intel__grid--wide-left">
        <ChartCard title="Department Size Comparison" meta="people by department" footer={model.avgTeamSize === null ? 'People counts are unavailable in the current API response.' : `Average team size is ${model.avgTeamSize.toFixed(model.avgTeamSize < 10 ? 1 : 0)} people.`}>
          {model.sizeRows.length > 0 ? <HorizontalBars rows={model.sizeRows} colorFor={(_, index) => PALETTE[index % PALETTE.length]} /> : <EmptyChart />}
        </ChartCard>
        <PieCard title="Head Assignment Status" rows={model.leadershipRows} colorFor={(name) => name === 'assigned' ? '#2f7f93' : '#bd2f68'} />
      </section>

      <section className="dept-intel__grid dept-intel__grid--thirds">
        <PieCard title="Active vs Archived" rows={model.statusRows} colorFor={(name) => STATUS_COLORS[name] ?? STATUS_COLORS.unknown} />
        <DistributionCard title="Department Distribution" rows={model.typeRows} colorFor={(_, index) => PALETTE[index % PALETTE.length]} />
        <DistributionCard title="Capability Coverage Distribution" rows={model.coverageRows} colorFor={(name) => name === 'high' ? '#2f7f93' : name === 'medium' ? '#a8892f' : name === 'low' ? '#bd2f68' : '#7c8496'} />
      </section>

      <section className="dept-intel__grid dept-intel__grid--two">
        <ChartCard title="Department Growth Trend" meta="created departments" footer="Trend is derived from department creation timestamps returned by the API.">
          {model.growthRows.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={model.growthRows}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                <Line type="monotone" dataKey="count" stroke="#bd2f68" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </ChartCard>
        <ChartCard title="Leadership Overview" meta="organization map" footer="Each unit is sized by people count when available and tinted by leadership state.">
          {filtered.length > 0 ? (
            <div className="dept-intel__map">
              {filtered.slice(0, 24).map((dept) => {
                const size = Math.max(44, Math.min(118, 44 + (dept.peopleCount ?? 0) * 4));
                return (
                  <button key={dept.id} style={{ width: size, height: size }} className={dept.headId ? 'has-head' : 'missing-head'} onClick={() => onSelect(dept)} title={dept.name}>
                    <Network size={15} />
                    <span>{dept.name}</span>
                  </button>
                );
              })}
            </div>
          ) : <EmptyChart />}
        </ChartCard>
      </section>

      <section className="dept-intel__directory">
        <div className="dept-intel__table-head">
          <div>
            <h2>Organization Directory</h2>
            <p>Filtered departments with leadership, size, coverage, risk, and action context.</p>
          </div>
          <span>{model.total.toLocaleString()} units</span>
        </div>
        {filtered.length === 0 ? <EmptyChart /> : (
          <div className="dept-intel__directory-grid">
            {filtered.map((dept) => {
              const status = normalized(dept.status, 'unknown');
              const coverage = dept.coverage ?? 0;
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
                  <div className="dept-intel__unit-stats">
                    <div><strong>{dept.peopleCount === null ? '-' : dept.peopleCount.toLocaleString()}</strong><span>people</span></div>
                    <div><strong>{formatPercent(dept.coverage)}</strong><span>coverage</span></div>
                    <div><strong>{dept.openRiskSignals.toLocaleString()}</strong><span>risks</span></div>
                  </div>
                  <div className="dept-intel__leadership-line">
                    <span className={dept.headId ? 'ok' : 'gap'}>{dept.headId ? 'Head assigned' : 'No head assigned'}</span>
                    <em>{dept.headId ?? 'leadership gap'}</em>
                  </div>
                  <div className="dept-intel__coverage-track"><i style={{ width: `${coverage * 100}%` }} /></div>
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

function ChartCard({ title, meta, footer, children }: { title: string; meta: string; footer?: string; children: ReactNode }) {
  return (
    <article className="dept-intel__card">
      <div className="dept-intel__card-head">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      <div className="dept-intel__chart">{children}</div>
      {footer && <div className="dept-intel__card-foot">{footer}</div>}
    </article>
  );
}

function HorizontalBars({ rows, colorFor }: { rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <div className="dept-intel__bars">
      {rows.map((row, index) => (
        <div className="dept-intel__bar-row" key={row.name}>
          <span>{row.name}</span>
          <div><i style={{ width: `${Math.max(row.percent * 100, row.value > 0 ? 2 : 0)}%`, backgroundColor: colorFor(row.name, index) }} /></div>
          <strong>{row.value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}

function DistributionCard({ title, rows, colorFor }: { title: string; rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <ChartCard title={title} meta={`${rows.length.toLocaleString()} groups`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <div className="dept-intel__distribution">
          {rows.map((row, index) => (
            <div className="dept-intel__dist-row" key={row.name}>
              <div>
                <span style={{ backgroundColor: colorFor(row.name, index) }} />
                <strong>{displayLabel(row.name)}</strong>
              </div>
              <div className="dept-intel__dist-track"><i style={{ width: `${row.percent * 100}%`, backgroundColor: colorFor(row.name, index) }} /></div>
              <em>{row.value.toLocaleString()}</em>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function PieCard({ title, rows, colorFor }: { title: string; rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <ChartCard title={title} meta={`${rows.reduce((sum, row) => sum + row.value, 0).toLocaleString()} departments`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={54} outerRadius={84} paddingAngle={2}>
              {rows.map((row, index) => <Cell key={row.name} fill={colorFor(row.name, index)} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} formatter={(value: unknown) => [Number(value ?? 0), 'Departments']} labelFormatter={(value: unknown) => displayLabel(String(value ?? ''))} />
            <Legend formatter={(value) => displayLabel(String(value))} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function EmptyChart() {
  return <div className="dept-intel__empty">No data in the current filter.</div>;
}
