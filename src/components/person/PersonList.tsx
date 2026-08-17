import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Archive, BrainCircuit, BriefcaseBusiness, Building2, Gauge, Mail, Search, ShieldAlert, Sparkles, UsersRound } from 'lucide-react';
import type { Person, PersonDepartment } from './PersonApp';

interface Props {
  people: Person[];
  departments: PersonDepartment[];
  loading: boolean;
  onSelect: (person: Person) => void;
  onEdit: (person: Person) => void;
  onArchive: (person: Person) => void;
  onRefresh: () => void;
  tenantId: string;
}

type SortKey = 'name' | 'department' | 'role' | 'status' | 'ai' | 'risk' | 'created';

const PAGE_SIZES = [10, 25, 50];

function norm(value: unknown): string {
  return String(value ?? '').trim();
}

function lower(value: unknown): string {
  return norm(value).toLowerCase();
}

function personName(person: Person): string {
  return norm(person.displayName) || `${norm(person.firstName)} ${norm(person.lastName)}`.trim() || `Person ${person.id}`;
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function scorePerson(person: Person): { ai: number; risk: number; missing: string[] } {
  const missing = [
    !norm(person.email) ? 'email' : '',
    !norm(person.departmentId) || norm(person.departmentId) === '0' ? 'department' : '',
    !norm(person.employeeId) ? 'employee id' : '',
    !norm(person.designation) && !norm(person.employmentType) ? 'role' : '',
    !norm(person.phone) ? 'phone' : '',
  ].filter(Boolean);

  const ai = Math.max(0, Math.round(((5 - missing.length) / 5) * 100));
  const risk = Math.min(100, Math.round(missing.length * 18 + (lower(person.status) !== 'active' ? 10 : 0)));
  return { ai, risk, missing };
}

export default function PersonList({ people, departments, loading, onSelect, onEdit, onArchive, onRefresh }: Props) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [experience, setExperience] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const departmentNames = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => map.set(String(dept.id), dept.name));
    return map;
  }, [departments]);

  const enriched = useMemo(() => people.map((person) => {
    const score = scorePerson(person);
    const departmentName = person.departmentId ? departmentNames.get(String(person.departmentId)) ?? `Department ${person.departmentId}` : 'Unassigned';
    const roleName = norm(person.designation) || norm(person.employmentType) || 'Unprofiled';
    const age = daysSince(person.createdDate);
    return { person, score, departmentName, roleName, age };
  }), [people, departmentNames]);

  const roles = useMemo(() => Array.from(new Set(enriched.map((row) => row.roleName))).sort(), [enriched]);
  const isStudentDataset = useMemo(() => enriched.length > 0 && enriched.filter((row) => lower(row.roleName) === 'student').length / enriched.length >= 0.8, [enriched]);

  const model = useMemo(() => {
    const total = enriched.length;
    const assignedDepartments = new Set(enriched.filter((row) => row.person.departmentId && row.person.departmentId !== '0').map((row) => row.person.departmentId)).size;
    const missingProfiles = enriched.filter((row) => row.score.missing.includes('role')).length;
    const recent = enriched.filter((row) => row.age !== null && row.age <= 30).length;
    const avgAi = total ? Math.round(enriched.reduce((sum, row) => sum + row.score.ai, 0) / total) : 0;
    const avgRisk = total ? Math.round(enriched.reduce((sum, row) => sum + row.score.risk, 0) / total) : 0;
    const skillCoverage = total ? Math.round((enriched.filter((row) => !row.score.missing.includes('role') && !row.score.missing.includes('department')).length / total) * 100) : 0;
    return { total, assignedDepartments, missingProfiles, recent, avgAi, avgRisk, skillCoverage };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = lower(query);
    return enriched.filter((row) => {
      const haystack = [
        personName(row.person),
        row.person.email,
        row.person.employeeId,
        row.departmentName,
        row.roleName,
        row.person.status,
      ].map(lower).join(' ');
      if (q && !haystack.includes(q)) return false;
      if (department !== 'all' && String(row.person.departmentId ?? '') !== department) return false;
      if (role !== 'all' && row.roleName !== role) return false;
      if (status !== 'all' && lower(row.person.status) !== status) return false;
      if (experience === 'new' && !(row.age !== null && row.age <= 30)) return false;
      if (experience === 'established' && !(row.age !== null && row.age > 30 && row.age <= 365)) return false;
      if (experience === 'long' && !(row.age !== null && row.age > 365)) return false;
      if (experience === 'unknown' && row.age !== null) return false;
      return true;
    });
  }, [department, enriched, experience, query, role, status]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const value = (row: typeof a) => {
        if (sortKey === 'name') return personName(row.person);
        if (sortKey === 'department') return row.departmentName;
        if (sortKey === 'role') return row.roleName;
        if (sortKey === 'status') return row.person.status;
        if (sortKey === 'ai') return row.score.ai;
        if (sortKey === 'risk') return row.score.risk;
        return new Date(row.person.createdDate || 0).getTime();
      };
      const av = value(a);
      const bv = value(b);
      return typeof av === 'number' && typeof bv === 'number'
        ? (av - bv) * dir
        : String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [filtered, sortDir, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => dir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const onFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  if (loading) {
    return (
      <div className="people-dashboard">
        <div className="people-skeleton people-skeleton-hero" />
        <div className="people-kpi-grid">
          {Array.from({ length: 6 }).map((_, index) => <div className="people-skeleton people-skeleton-card" key={index} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="people-dashboard">
      <section className="people-hero">
        <div>
          <span className="people-eyebrow">{isStudentDataset ? 'Student intelligence' : 'Workforce intelligence'}</span>
          <h2>{isStudentDataset ? 'Student readiness across fee risk' : 'AI readiness across your organization'}</h2>
          <p>{isStudentDataset ? 'Search, segment, and review student records with class-section and fee-contact context.' : 'Search, segment, and review people records with tenant-scoped workforce analytics.'}</p>
        </div>
        <div
          className="people-hero-score"
          style={{ ['--people-readiness' as any]: Math.max(0, Math.min(100, model.avgAi)) }}
        >
          <span>{model.avgAi}</span>
          <small>{isStudentDataset ? 'data readiness' : 'AI readiness'}</small>
        </div>
      </section>

      <section className="people-kpi-grid" aria-label="People KPIs">
        <Kpi icon={<UsersRound />} label={isStudentDataset ? 'Total Students' : 'Total Employees'} value={model.total} hint={`${filtered.length} in current view`} />
        <Kpi icon={<Building2 />} label={isStudentDataset ? 'Class Sections' : 'Departments'} value={model.assignedDepartments} hint={`${departments.length} available`} />
        <Kpi icon={<BrainCircuit />} label={isStudentDataset ? 'Data Readiness' : 'AI Readiness'} value={`${model.avgAi}%`} hint="profile completeness" />
        <Kpi icon={<Gauge />} label={isStudentDataset ? 'Class Mapping' : 'Skill Coverage'} value={`${model.skillCoverage}%`} hint="role and department mapped" />
        <Kpi icon={<ShieldAlert />} label="Missing Profiles" value={model.missingProfiles} hint="role data absent" danger={model.missingProfiles > 0} />
        <Kpi icon={<Sparkles />} label="Recently Added" value={model.recent} hint="last 30 days" />
      </section>

      <section className="people-insight-grid">
        <article className="people-insight-card">
          <span>Current state</span>
          <strong>{model.total} active records across {model.assignedDepartments || 0} {isStudentDataset ? 'class sections' : 'staffed departments'}.</strong>
          <p>{model.missingProfiles > 0 ? `${model.missingProfiles} records need role/profile enrichment before AI routing is reliable.` : 'Every visible record has enough profile data for baseline AI routing.'}</p>
        </article>
        <article className="people-insight-card">
          <span>Readiness signal</span>
          <strong>{model.avgAi}% average AI readiness with {model.avgRisk}% average data risk.</strong>
          <p>{model.skillCoverage < 70 ? 'Coverage is below the threshold expected for confident capability matching.' : 'Coverage is strong enough for reliable workforce segmentation.'}</p>
        </article>
        <article className="people-insight-card">
          <span>Operational risk</span>
          <strong>{enriched.filter((row) => row.score.risk >= 50).length} {isStudentDataset ? 'student records' : 'people'} require attention.</strong>
          <p>Risk is computed from missing email, department, employee id, role, phone, and inactive status.</p>
        </article>
      </section>

      <section className="people-workspace">
        <div className="people-toolbar">
          <div className="people-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => onFilter(() => setQuery(event.target.value))} placeholder={isStudentDataset ? 'Search students, guardian email, student id, class...' : 'Search people, email, employee id, department...'} />
          </div>
          <select value={department} onChange={(event) => onFilter(() => setDepartment(event.target.value))} aria-label="Department filter">
            <option value="all">All departments</option>
            {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
          </select>
          <select value={role} onChange={(event) => onFilter(() => setRole(event.target.value))} aria-label="Role filter">
            <option value="all">All roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={status} onChange={(event) => onFilter(() => setStatus(event.target.value))} aria-label="Status filter">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
          <select value={experience} onChange={(event) => onFilter(() => setExperience(event.target.value))} aria-label="Experience filter">
            <option value="all">All experience</option>
            <option value="new">Recently added</option>
            <option value="established">Established</option>
            <option value="long">Long tenured</option>
            <option value="unknown">Unknown tenure</option>
          </select>
          <button className="eb-pill-btn" onClick={onRefresh}>Refresh</button>
        </div>

        <div className="people-table-wrap">
          <table className="people-table">
            <thead>
              <tr>
                <Sortable label={isStudentDataset ? 'Student' : 'Employee'} sortKey="name" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label={isStudentDataset ? 'Class Section' : 'Department'} sortKey="department" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label="Role" sortKey="role" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label="AI Score" sortKey="ai" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label="Risk" sortKey="risk" active={sortKey} dir={sortDir} onSort={updateSort} />
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.person.id}>
                  <td>
                    <button className="people-person-button" onClick={() => onSelect(row.person)}>
                      <Avatar person={row.person} />
                      <span>
                        <strong>{personName(row.person)}</strong>
                        <small>{row.person.employeeId || row.person.id}</small>
                      </span>
                    </button>
                  </td>
                  <td><span className="people-badge people-badge-navy"><Building2 size={13} />{row.departmentName}</span></td>
                  <td><span className="people-badge people-badge-gold"><BriefcaseBusiness size={13} />{row.roleName}</span></td>
                  <td><ScoreBar value={row.score.ai} tone="ai" /></td>
                  <td><ScoreBar value={row.score.risk} tone="risk" /></td>
                  <td>
                    <span className="people-contact"><Mail size={14} />{row.person.email || 'No email'}</span>
                  </td>
                  <td>
                    <div className="people-row-actions">
                      <button className="eb-pill-btn" onClick={() => onSelect(row.person)}>Open</button>
                      <button className="eb-pill-btn" onClick={() => onEdit(row.person)}>Edit</button>
                      <button className="eb-pill-btn" onClick={() => onArchive(row.person)} aria-label={`Archive ${personName(row.person)}`}>
                        <Archive size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="people-empty">
                      <AlertTriangle size={18} />
                      No people match the current filters.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="people-pagination">
          <span>{sorted.length === 0 ? 'No records' : `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length}`}</span>
          <div>
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} aria-label="Rows per page">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
            <button className="eb-pill-btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button className="eb-pill-btn" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, hint, danger }: { icon: ReactNode; label: string; value: ReactNode; hint: string; danger?: boolean }) {
  return (
    <article className="people-kpi" data-danger={danger ? 'true' : undefined}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Avatar({ person }: { person: Person }) {
  const name = personName(person);
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'P';
  return <span className="people-avatar">{person.profilePhoto ? <img src={person.profilePhoto} alt="" /> : initials}</span>;
}

function ScoreBar({ value, tone }: { value: number; tone: 'ai' | 'risk' }) {
  return (
    <span className="people-score" data-tone={tone}>
      <span><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
      <strong>{value}%</strong>
    </span>
  );
}

function Sortable({ label, sortKey, active, dir, onSort }: { label: string; sortKey: SortKey; active: SortKey; dir: 'asc' | 'desc'; onSort: (key: SortKey) => void }) {
  return (
    <th>
      <button className="people-sort" onClick={() => onSort(sortKey)}>
        {label}{active === sortKey ? ` ${dir === 'asc' ? 'up' : 'down'}` : ''}
      </button>
    </th>
  );
}
