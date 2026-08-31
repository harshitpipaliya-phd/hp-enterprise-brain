import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Archive, Building2, BriefcaseBusiness, IdCard, Mail, MailX, Search, Sparkles, UserMinus, UsersRound } from 'lucide-react';
import type { Person, PersonDepartment } from './PersonApp';
import { api as signalApi } from '../../api/signal';

interface Props {
  people: Person[];
  departments: PersonDepartment[];
  loading: boolean;
  onSelect: (person: Person) => void;
  onEdit: (person: Person) => void;
  onArchive: (person: Person) => void;
  onRefresh: () => void;
  tenantId: string;
  initialDepartmentId?: string | null;
}

type SortKey = 'name' | 'department' | 'role' | 'status' | 'created';

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

function hasDepartment(person: Person): boolean {
  const id = norm(person.departmentId);
  return id !== '' && id !== '0';
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/**
 * People — "who is in this organization, and whose record is incomplete?"
 *
 * WHAT WAS REMOVED, AND WHY. Every row used to carry two percentage columns,
 * "AI Score" and "Risk", and the page opened on a large ring reading "AI
 * readiness". None of those three numbers existed anywhere outside this file.
 * The AI score was `(5 - missingFieldCount) / 5`; the risk was
 * `missingFieldCount * 18` plus ten if the person was not active. So a student
 * with no phone number on file was published as 80% AI-ready and 18% risky —
 * two confident-looking figures about a person, derived from nothing but which
 * of five columns happened to be blank, with no model behind either.
 *
 * The underlying fact — some records are missing fields — is real and worth
 * showing, so it is still here. It is now reported as what it is: a count of
 * records missing a named field, per field, with no score on top.
 */
export default function PersonList({ people, departments, loading, tenantId, initialDepartmentId, onSelect, onEdit, onArchive, onRefresh }: Props) {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [completeness, setCompleteness] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  /*
    OPEN SIGNALS PER PERSON, IN ONE REQUEST.

    A workforce list that cannot say who the organization has raised something
    about is a phone book. The obvious implementation — a per-person lookup —
    is a request per row and is exactly the N+1 this codebase forbids, so the
    tenant's signals are fetched once and grouped by the person they name.

    Failure is silent and the column simply does not appear: signals are
    additional intelligence about the roster, and a roster that loads fine must
    not be blanked because a secondary endpoint was unavailable.
  */
  const [signalsByPerson, setSignalsByPerson] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    setDepartment(initialDepartmentId || 'all');
    setPage(1);
  }, [initialDepartmentId]);

  useEffect(() => {
    let cancelled = false;

    signalApi.listSignals(tenantId)
      .then((rows: any) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const row of Array.isArray(rows) ? rows : []) {
          if (String(row?.relatedEntityType ?? '').toLowerCase() !== 'person') continue;
          const status = String(row?.status ?? '').toLowerCase();
          if (['resolved', 'closed', 'dismissed'].includes(status)) continue;
          const id = String(row?.relatedEntityId ?? '');
          if (id === '') continue;
          map.set(id, (map.get(id) ?? 0) + 1);
        }
        setSignalsByPerson(map);
      })
      .catch(() => { if (!cancelled) setSignalsByPerson(null); });

    return () => { cancelled = true; };
  }, [tenantId]);

  // The column earns its width only where at least one person has something
  // against them. On a clean roster it is a column of dashes.
  const showsSignals = (signalsByPerson?.size ?? 0) > 0;

  const departmentNames = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => map.set(String(dept.id), dept.name));
    return map;
  }, [departments]);

  const enriched = useMemo(() => people.map((person) => {
    const departmentName = hasDepartment(person)
      ? departmentNames.get(String(person.departmentId)) ?? 'Unknown department'
      : 'Unassigned';
    const roleName = norm(person.designation) || norm(person.employmentType) || 'No role recorded';
    return {
      person,
      departmentName,
      roleName,
      hasRole: Boolean(norm(person.designation) || norm(person.employmentType)),
      hasEmail: Boolean(norm(person.email)),
      inDepartment: hasDepartment(person),
      age: daysSince(person.createdDate),
    };
  }), [people, departmentNames]);

  const roles = useMemo(() => Array.from(new Set(enriched.map((row) => row.roleName))).sort(), [enriched]);

  /**
   * Whether this tenant's people are predominantly students.
   *
   * Real, and load-bearing for the labels: a school's "departments" are class
   * sections and its people are students, and calling them Employees on screen
   * makes the page read as a report about somebody else's organization. The
   * threshold is applied to the tenant's own designations, not assumed.
   */
  const isStudentDataset = useMemo(
    () => enriched.length > 0 && enriched.filter((row) => lower(row.roleName) === 'student').length / enriched.length >= 0.8,
    [enriched],
  );

  const model = useMemo(() => {
    const total = enriched.length;
    return {
      total,
      departmentsRepresented: new Set(enriched.filter((row) => row.inDepartment).map((row) => String(row.person.departmentId))).size,
      withoutDepartment: enriched.filter((row) => !row.inDepartment).length,
      withoutRole: enriched.filter((row) => !row.hasRole).length,
      withoutEmail: enriched.filter((row) => !row.hasEmail).length,
      recent: enriched.filter((row) => row.age !== null && row.age <= 30).length,
    };
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
      if (completeness === 'no-department' && row.inDepartment) return false;
      if (completeness === 'no-role' && row.hasRole) return false;
      if (completeness === 'no-email' && row.hasEmail) return false;
      return true;
    });
  }, [completeness, department, enriched, query, role, status]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const value = (row: typeof a) => {
        if (sortKey === 'name') return personName(row.person);
        if (sortKey === 'department') return row.departmentName;
        if (sortKey === 'role') return row.roleName;
        if (sortKey === 'status') return norm(row.person.status);
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
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const onFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const resetFilters = () => {
    setQuery('');
    setDepartment('all');
    setRole('all');
    setStatus('all');
    setCompleteness('all');
    setPage(1);
  };

  if (loading) {
    return (
      <div className="people-dashboard">
        <div className="people-kpi-grid">
          {Array.from({ length: 6 }).map((_, index) => <div className="people-skeleton people-skeleton-card" key={index} />)}
        </div>
        <div className="people-skeleton people-skeleton-hero" />
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="people-dashboard">
        <div className="people-empty people-empty--page">
          <UsersRound size={26} />
          <strong>No people are recorded for this organization yet</strong>
          <p>
            People come from the connected HR system, or from a file imported through the Ingestion Engine.
            Once they exist, each person&apos;s department, role and recorded activity appear here.
          </p>
        </div>
      </div>
    );
  }

  const unitWord = isStudentDataset ? 'class section' : 'department';

  return (
    <div className="people-dashboard">
      <section className="people-kpi-grid" aria-label="People summary">
        <Kpi
          icon={<UsersRound />}
          label={isStudentDataset ? 'Students' : 'People'}
          value={model.total.toLocaleString()}
          hint={`${filtered.length.toLocaleString()} in current view`}
        />
        <Kpi
          icon={<Building2 />}
          label={isStudentDataset ? 'Class sections in use' : 'Departments in use'}
          value={model.departmentsRepresented.toLocaleString()}
          hint={`${departments.length.toLocaleString()} recorded in total`}
        />
        <Kpi
          icon={<UserMinus />}
          label={`Without a ${unitWord}`}
          value={model.withoutDepartment.toLocaleString()}
          hint={model.withoutDepartment > 0 ? 'Excluded from every rollup' : 'Everyone is assigned'}
          danger={model.withoutDepartment > 0}
        />
        <Kpi
          icon={<IdCard />}
          label="Without a role"
          value={model.withoutRole.toLocaleString()}
          hint={model.withoutRole > 0 ? 'No designation on file' : 'Every record has a role'}
          danger={model.withoutRole > 0}
        />
        <Kpi
          icon={<MailX />}
          label="Without an email"
          value={model.withoutEmail.toLocaleString()}
          hint={model.withoutEmail > 0 ? 'Cannot be contacted from here' : 'Every record has an email'}
          danger={model.withoutEmail > 0}
        />
        <Kpi
          icon={<Sparkles />}
          label="Added recently"
          value={model.recent.toLocaleString()}
          hint="In the last 30 days"
        />
      </section>

      <section className="people-workspace">
        <div className="people-toolbar">
          <div className="people-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => onFilter(() => setQuery(event.target.value))}
              placeholder={isStudentDataset ? 'Search by name, student id, class or email' : 'Search by name, employee id, department or email'}
            />
          </div>
          <select value={department} onChange={(event) => onFilter(() => setDepartment(event.target.value))} aria-label={isStudentDataset ? 'Class section filter' : 'Department filter'}>
            <option value="all">{isStudentDataset ? 'All class sections' : 'All departments'}</option>
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
          <select value={completeness} onChange={(event) => onFilter(() => setCompleteness(event.target.value))} aria-label="Record completeness filter">
            <option value="all">Complete and incomplete</option>
            <option value="no-department">Missing {unitWord}</option>
            <option value="no-role">Missing role</option>
            <option value="no-email">Missing email</option>
          </select>
          <button className="eb-pill-btn" onClick={resetFilters}>Reset</button>
          <button className="eb-pill-btn" onClick={onRefresh}>Refresh</button>
        </div>

        <div className="people-table-wrap">
          <table className="people-table">
            <thead>
              <tr>
                <Sortable label={isStudentDataset ? 'Student' : 'Person'} sortKey="name" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label={isStudentDataset ? 'Class section' : 'Department'} sortKey="department" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label="Role" sortKey="role" active={sortKey} dir={sortDir} onSort={updateSort} />
                <Sortable label="Status" sortKey="status" active={sortKey} dir={sortDir} onSort={updateSort} />
                <th>Contact</th>
                {showsSignals && <th>Open signals</th>}
                <Sortable label="Added" sortKey="created" active={sortKey} dir={sortDir} onSort={updateSort} />
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
                        <small>{row.person.employeeId || `Reference ${row.person.id}`}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {row.inDepartment
                      ? <span className="people-badge people-badge-navy"><Building2 size={13} />{row.departmentName}</span>
                      : <span className="people-missing">Not assigned</span>}
                  </td>
                  <td>
                    {row.hasRole
                      ? <span className="people-badge people-badge-gold"><BriefcaseBusiness size={13} />{row.roleName}</span>
                      : <span className="people-missing">Not recorded</span>}
                  </td>
                  <td><span className="people-status" data-active={lower(row.person.status) === 'active' ? 'true' : 'false'}>{norm(row.person.status) || 'Unknown'}</span></td>
                  <td>
                    {row.hasEmail
                      ? <span className="people-contact"><Mail size={14} />{row.person.email}</span>
                      : <span className="people-missing">No email</span>}
                  </td>
                  {showsSignals && (
                    <td>
                      {(() => {
                        const count = signalsByPerson?.get(String(row.person.id)) ?? 0;
                        return count === 0
                          ? <span className="people-missing">None</span>
                          : (
                            <span className="people-signal-flag" data-level={count > 2 ? 'high' : 'low'}>
                              {count} open
                            </span>
                          );
                      })()}
                    </td>
                  )}
                  <td className="people-date">{formatDate(row.person.createdDate)}</td>
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
                      No one matches the current filters.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="people-pagination">
          <span>{sorted.length === 0 ? 'No records' : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length.toLocaleString()}`}</span>
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

function Sortable({ label, sortKey, active, dir, onSort }: { label: string; sortKey: SortKey; active: SortKey; dir: 'asc' | 'desc'; onSort: (key: SortKey) => void }) {
  const isActive = active === sortKey;
  return (
    <th aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="people-sort" onClick={() => onSort(sortKey)}>
        {label}
        <span aria-hidden="true">{isActive ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );
}
