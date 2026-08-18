import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, BookOpen, GraduationCap, IndianRupee, Layers, Link2, Search, UsersRound,
} from 'lucide-react';
import { api } from '../../api/student';
import type { Student, StudentListParams, StudentSummary } from '../../api/student';
import './StudentList.css';

interface Props {
  tenantId: string;
  onSelect: (student: Student) => void;
}

const PAGE_SIZES = [25, 50, 100];

/** Sort keys the server allow-lists. Anything else is ignored server-side. */
type SortKey = 'student_name' | 'student_ref' | 'avg_percentage' | 'academic_records'
  | 'fee_records' | 'total_paid' | 'last_academic_year';

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `₹${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
}

/**
 * Students — one page at a time, from the database.
 *
 * WHY THIS IS NOT PersonList. PersonList receives the whole cohort as a prop and
 * does its filtering, sorting and paging in `useMemo`. That is a reasonable
 * design for a tenant with fifty employees, and it is the reason Lions could not
 * use it: the alternative to this component was sending thousands of students —
 * standing in for 388,401 academic rows — to the browser so it could show
 * twenty-five of them.
 *
 * Every control here is a server parameter. Changing a filter, a sort or a page
 * issues one request that returns one page and a total. The browser never holds
 * more than `pageSize` students, so the screen costs the same whether the school
 * has four hundred students or four hundred thousand records behind them.
 *
 * SEARCH IS DEBOUNCED AND RACE-SAFE. Typing "SHARMA" would otherwise fire six
 * requests whose responses can arrive out of order and leave the list showing
 * results for "SHAR". Each load carries a sequence number and a late response
 * for a superseded query is discarded.
 */
export default function StudentList({ tenantId, onSelect }: Props) {
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [cohort, setCohort] = useState('all');
  const [standard, setStandard] = useState('all');
  const [academicStandard, setAcademicStandard] = useState('all');
  const [division, setDivision] = useState('all');
  const [subject, setSubject] = useState('all');
  const [sort, setSort] = useState<SortKey>('student_name');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounce the box into the value that actually hits the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    let cancelled = false;
    api.getSummary(tenantId)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => { /* the row load reports the failure; one alert is enough */ });
    return () => { cancelled = true; };
  }, [tenantId]);

  const sequence = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const params: StudentListParams = {
        q: query || undefined,
        cohort, standard, academicStandard, division, subject,
        sort, direction, page, pageSize,
      };
      const result = await api.listStudents(tenantId, params);
      // A response for a query the user has already moved on from must not
      // overwrite the current one.
      if (ticket !== sequence.current) return;
      setRows(Array.isArray(result?.data) ? result.data : []);
      setTotal(Number(result?.total ?? 0));
    } catch (e: any) {
      if (ticket !== sequence.current) return;
      setError(e?.message ?? 'Could not load students.');
      setRows([]);
      setTotal(0);
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
  }, [tenantId, query, cohort, standard, academicStandard, division, subject, sort, direction, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const onSort = (key: SortKey) => {
    if (sort === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDirection(key === 'student_name' || key === 'student_ref' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const filter = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(1); };

  const reset = () => {
    setQueryInput(''); setQuery(''); setCohort('all'); setStandard('all');
    setAcademicStandard('all'); setDivision('all'); setSubject('all'); setPage(1);
  };

  const hasFees = Boolean(summary?.datasets?.fees);
  const hasAcademic = Boolean(summary?.datasets?.academic);

  const filters = summary?.filters;
  const dropdowns = useMemo(() => ({
    standards: filters?.standards ?? [],
    academicStandards: filters?.academicStandards ?? [],
    divisions: filters?.divisions ?? [],
    subjects: filters?.subjects ?? [],
  }), [filters]);

  return (
    <div className="students">
      <section className="students-kpis" aria-label="Student summary">
        <Kpi icon={<UsersRound />} label="Students" value={num(summary?.total)}
             hint="One row per enrollment number, derived from the imported files" />
        <Kpi icon={<Link2 />} label="In both files" value={num(summary?.matched)}
             hint="Matched on enrollment number = GR number" />
        <Kpi icon={<BookOpen />} label="Academic records" value={num(summary?.academicRecords)}
             hint={`${num(summary?.academicOnly)} students appear in results only`} />
        {hasFees && (
          <Kpi icon={<IndianRupee />} label="Fees collected" value={money(summary?.totalPaid)}
               hint={`${num(summary?.feeRecords)} receipts · ${num(summary?.feesOnly)} students in fees only`} />
        )}
      </section>

      <section className="students-panel">
        <div className="students-toolbar">
          <div className="students-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by name, enrollment / GR number, standard, division or year"
              aria-label="Search students"
            />
          </div>

          <select value={cohort} onChange={(e) => filter(setCohort)(e.target.value)} aria-label="Cohort filter">
            <option value="all">Every student</option>
            <option value="matched">In both files</option>
            <option value="academicOnly">Academic records only</option>
            <option value="feesOnly">Fee records only</option>
          </select>

          {hasAcademic && dropdowns.academicStandards.length > 0 && (
            <select value={academicStandard} onChange={(e) => filter(setAcademicStandard)(e.target.value)} aria-label="Academic standard filter">
              <option value="all">Any academic standard</option>
              {dropdowns.academicStandards.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {hasFees && dropdowns.standards.length > 0 && (
            <select value={standard} onChange={(e) => filter(setStandard)(e.target.value)} aria-label="Fee-register standard filter">
              <option value="all">Any standard (fee register)</option>
              {dropdowns.standards.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {hasFees && dropdowns.divisions.length > 0 && (
            <select value={division} onChange={(e) => filter(setDivision)(e.target.value)} aria-label="Division filter">
              <option value="all">Any division</option>
              {dropdowns.divisions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/*
            Subject narrows to students who sat at least one paper in it. The
            server answers it with an EXISTS against the result rows rather than
            a join, so a student is never listed twice for having taken the
            subject in four different years.
          */}
          {hasAcademic && dropdowns.subjects.length > 0 && (
            <select value={subject} onChange={(e) => filter(setSubject)(e.target.value)} aria-label="Subject filter">
              <option value="all">Any subject</option>
              {dropdowns.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <button className="eb-pill-btn" onClick={reset}>Reset</button>
          <button className="eb-pill-btn" onClick={load}>Refresh</button>
        </div>

        {error && <div className="students-alert" role="alert">{error}</div>}

        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <Sortable label="Student" k="student_name" sort={sort} dir={direction} onSort={onSort} />
                <Sortable label="Enrollment / GR" k="student_ref" sort={sort} dir={direction} onSort={onSort} />
                <th>Standard</th>
                <Sortable label="Academic years" k="last_academic_year" sort={sort} dir={direction} onSort={onSort} />
                <Sortable label="Average" k="avg_percentage" sort={sort} dir={direction} onSort={onSort} />
                <Sortable label="Academic records" k="academic_records" sort={sort} dir={direction} onSort={onSort} />
                {hasFees && <Sortable label="Receipts" k="fee_records" sort={sort} dir={direction} onSort={onSort} />}
                {hasFees && <Sortable label="Paid" k="total_paid" sort={sort} dir={direction} onSort={onSort} />}
                <th>Present in</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`skeleton-${i}`}><td colSpan={hasFees ? 9 : 7}><div className="students-skeleton" /></td></tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={hasFees ? 9 : 7}>
                    <div className="students-empty">
                      <AlertTriangle size={18} />
                      {total === 0 && !query && cohort === 'all'
                        ? 'No students have been derived from this organization’s datasets yet. Import a dataset, then run students:rebuild.'
                        : 'No student matches the current search and filters.'}
                    </div>
                  </td>
                </tr>
              )}

              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="students-name" onClick={() => onSelect(s)}>
                      <span className="students-avatar">{initials(s.studentName)}</span>
                      <span>
                        <strong>{s.studentName || `Student ${s.studentRef}`}</strong>
                        <small>{s.division ? `Division ${s.division}` : s.batch || '—'}</small>
                      </span>
                    </button>
                  </td>
                  <td className="students-mono">{s.studentRef}</td>
                  <td>
                    {/*
                      Both vocabularies, labelled. The academic export writes
                      "CBSE-2" and the fee register writes "IX" for the same
                      child four years apart; showing one as though it were the
                      other would be a reconciliation nobody performed.
                    */}
                    <div className="students-standards">
                      {s.academicStandard && <span className="students-tag students-tag--academic"><GraduationCap size={12} />{s.academicStandard}</span>}
                      {s.standard && <span className="students-tag students-tag--fee"><IndianRupee size={12} />{s.standard}</span>}
                      {!s.academicStandard && !s.standard && <span className="students-missing">—</span>}
                    </div>
                  </td>
                  <td>
                    {s.firstAcademicYear
                      ? <span className="students-mono">{s.firstAcademicYear === s.lastAcademicYear ? s.firstAcademicYear : `${s.firstAcademicYear}–${s.lastAcademicYear}`}</span>
                      : <span className="students-missing">—</span>}
                  </td>
                  <td>{s.avgPercentage === null ? <span className="students-missing">—</span> : <strong>{pct(s.avgPercentage)}</strong>}</td>
                  <td>{num(s.academicRecords)}{s.subjectsCount > 0 && <small className="students-sub"> · {s.subjectsCount} subjects</small>}</td>
                  {hasFees && <td>{num(s.feeRecords)}</td>}
                  {hasFees && <td>{money(s.totalPaid)}</td>}
                  <td>
                    <span className="students-cohort" data-cohort={s.inAcademic && s.inFees ? 'both' : s.inAcademic ? 'academic' : 'fees'}>
                      {s.inAcademic && s.inFees ? 'Both files' : s.inAcademic ? 'Results only' : 'Fees only'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="students-pagination">
          <span>
            {total === 0 ? 'No students' : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
            {loading && rows.length > 0 && <em> · updating…</em>}
          </span>
          <div>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
            <button className="eb-pill-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {pageCount.toLocaleString()}</span>
            <button className="eb-pill-btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      </section>

      <p className="students-provenance">
        <Layers size={14} aria-hidden="true" />
        Every row is derived from this organization&apos;s own imported files by SQL aggregation. Students are
        identified by enrollment number; the academic and fee files are joined on
        <code> enrollment_no = GR NO.</code> and never by name.
        {summary?.projectedAt && <> Last rebuilt {new Date(summary.projectedAt).toLocaleString()}.</>}
      </p>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'S';
}

function Kpi({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <article className="students-kpi">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Sortable({ label, k, sort, dir, onSort }: {
  label: string; k: SortKey; sort: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void;
}) {
  const active = sort === k;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button className="students-sort" onClick={() => onSort(k)}>
        {label}<span aria-hidden="true">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    </th>
  );
}
