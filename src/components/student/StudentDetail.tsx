import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, IndianRupee, Info } from 'lucide-react';
import { api } from '../../api/student';
import type { AcademicRecord, FeeRecord, Page, StudentDetail as Detail } from '../../api/student';
import './StudentList.css';
import { ExploreInGraphButton } from '../graph/ExploreInGraphButton';

interface Props {
  tenantId: string;
  studentId: string;
  onBack: () => void;
  /** Open Graph Explorer centred on this student. Absent renders no button. */
  onExploreInGraph?: (label: string, id: string) => void;
}

function money(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `₹${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * One student, and everything the organization's files say about them.
 *
 * THE CAUTION BANNER IS THE MOST IMPORTANT THING ON THIS PAGE. Lions' exam
 * results run 2018-2021 and its receipts 2025-2026. Rendering "average 62%" next
 * to "paid ₹48,000" without saying so invites a reader — a professor, an
 * administrator — to conclude something about a child that the data cannot
 * support: the marks and the money describe different years of their life. The
 * server computes whether the two ranges overlap and this refuses to present a
 * combined reading when they do not.
 *
 * BOTH RECORD LISTS ARE PAGED FROM THE SERVER. A student with four years across
 * nine subjects and three assessment types has several hundred result rows, and
 * a page of fifty is enough to look at.
 */
export default function StudentDetail({ tenantId, studentId, onBack, onExploreInGraph }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [academic, setAcademic] = useState<Page<AcademicRecord> | null>(null);
  const [fees, setFees] = useState<Page<FeeRecord> | null>(null);
  const [academicPage, setAcademicPage] = useState(1);
  const [feePage, setFeePage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getStudent(tenantId, studentId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setAcademic(data.academicRecords);
        setFees(data.feeRecords);
        setError(null);
      })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Could not load this student.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, studentId]);

  // Page 1 already arrived with the profile, so only later pages are fetched.
  useEffect(() => {
    if (academicPage === 1) return;
    let cancelled = false;
    api.getAcademicRecords(tenantId, studentId, academicPage)
      .then((p) => { if (!cancelled) setAcademic(p); })
      .catch(() => { /* the visible page stays; the profile alert covers failures */ });
    return () => { cancelled = true; };
  }, [tenantId, studentId, academicPage]);

  useEffect(() => {
    if (feePage === 1) return;
    let cancelled = false;
    api.getFeeRecords(tenantId, studentId, feePage)
      .then((p) => { if (!cancelled) setFees(p); })
      .catch(() => { /* as above */ });
    return () => { cancelled = true; };
  }, [tenantId, studentId, feePage]);

  if (loading) return <div className="student-detail"><div className="students-skeleton" style={{ height: 120 }} /></div>;
  if (error) return <div className="students-alert" role="alert">{error}</div>;
  if (!detail) return null;

  const s = detail.student;
  const rel = detail.relationship;
  const initials = (s.studentName || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

  return (
    <div className="student-detail">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="eb-pill-btn" onClick={onBack}>Back to Students</button>
        {/* The graph is where this child's results, fee records and any signals
            raised against their enrolment number are visible together. */}
        <ExploreInGraphButton
          label="Student"
          id={studentId}
          entityName={s.studentName || s.studentRef}
          onExplore={onExploreInGraph}
          className="eb-pill-btn"
        />
      </div>

      <header className="student-hero">
        <span className="student-hero-avatar">{initials || 'S'}</span>
        <div style={{ flex: '1 1 320px' }}>
          <h2>{s.studentName || `Student ${s.studentRef}`}</h2>
          <p>
            Enrollment / GR <strong>{s.studentRef}</strong>
            {s.academicStandard && <> · Academic standard <strong>{s.academicStandard}</strong></>}
            {s.standard && <> · Fee register standard <strong>{s.standard}</strong></>}
            {s.division && <> · Division <strong>{s.division}</strong></>}
            {s.uniqueId && <> · Unique ID <strong>{s.uniqueId}</strong></>}
          </p>
        </div>
        <div className="students-kpis" style={{ flex: '1 1 340px' }}>
          <article className="students-kpi">
            <span>Average</span>
            <strong>{s.avgPercentage === null ? '—' : `${s.avgPercentage.toFixed(1)}%`}</strong>
            <small>
              {s.totalObtained !== null && s.totalMarks !== null
                ? `${s.totalObtained.toLocaleString()} of ${s.totalMarks.toLocaleString()} marks`
                : 'No marks recorded'}
            </small>
          </article>
          <article className="students-kpi">
            <span>Fees paid</span>
            <strong>{money(s.totalPaid)}</strong>
            <small>{s.feeRecords.toLocaleString()} receipt{s.feeRecords === 1 ? '' : 's'}</small>
          </article>
        </div>
      </header>

      {/*
        Shown whenever the two files describe different periods — which is the
        normal case for this organization, not an edge case.
      */}
      {rel.matched && rel.contemporaneous === false && (
        <div className="student-caution">
          <strong><AlertTriangle size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />These two records describe different periods</strong>
          <span>{rel.note}</span>
          <span>
            Exam results {rel.academicYears?.filter(Boolean).join('–') || '—'} ·
            {' '}Receipts {rel.receiptDates?.filter(Boolean).map((d) => String(d).slice(0, 4)).join('–') || '—'}
          </span>
        </div>
      )}

      {!rel.matched && (
        <div className="student-caution">
          <strong><Info size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />Only one file mentions this student</strong>
          <span>{rel.note}</span>
        </div>
      )}

      <section className="student-records">
        <header>
          <h3><BookOpen size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Academic records</h3>
          <small>
            {(academic?.total ?? 0).toLocaleString()} result rows
            {s.subjectsCount > 0 && ` across ${s.subjectsCount} subjects`}
            {s.firstAcademicYear && ` · ${s.firstAcademicYear}–${s.lastAcademicYear}`}
          </small>
        </header>
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr><th>Year</th><th>Standard</th><th>Subject</th><th>Exam</th><th>Obtained</th><th>Total</th><th>Percentage</th></tr>
            </thead>
            <tbody>
              {(academic?.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.year ?? '—'}</td>
                  <td>{r.standard ?? '—'}</td>
                  <td>{r.subject ?? '—'}</td>
                  <td>{r.exam ?? '—'}</td>
                  <td>{r.obtained ?? '—'}</td>
                  <td>{r.total ?? '—'}</td>
                  <td>
                    {r.percentage === null ? '—' : `${r.percentage.toFixed(1)}%`}
                    {r.anomalous && <span className="student-anomaly" title="The source records more marks obtained than the paper was worth"> ANOMALY</span>}
                  </td>
                </tr>
              ))}
              {(academic?.data ?? []).length === 0 && (
                <tr><td colSpan={7}><div className="students-empty">No exam result carries this student&apos;s enrollment number.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={academic?.page ?? 1} total={academic?.total ?? 0} pageSize={academic?.pageSize ?? 50} onPage={setAcademicPage} />
      </section>

      <section className="student-records">
        <header>
          <h3><IndianRupee size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Fee records</h3>
          <small>
            {(fees?.total ?? 0).toLocaleString()} receipts · {money(s.totalPaid)} received
            {' '}— the source has no billed or due amount, so nothing outstanding can be shown.
          </small>
        </header>
        <div className="students-table-wrap">
          <table className="students-table">
            <thead>
              <tr><th>Receipt date</th><th>Receipt no</th><th>Month</th><th>Standard</th><th>Mode</th><th>Collected by</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {(fees?.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.receiptDate ? new Date(r.receiptDate).toLocaleDateString() : '—'}</td>
                  <td className="students-mono">{r.receiptNo ?? '—'}</td>
                  <td>{r.month ?? '—'}</td>
                  <td>{r.standard ?? '—'}</td>
                  <td>{r.paymentMode ?? '—'}</td>
                  <td>{r.collectedBy ?? '—'}</td>
                  <td>{money(r.amount)}</td>
                </tr>
              ))}
              {(fees?.data ?? []).length === 0 && (
                <tr><td colSpan={7}><div className="students-empty">No fee receipt carries this student&apos;s GR number.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={fees?.page ?? 1} total={fees?.total ?? 0} pageSize={fees?.pageSize ?? 50} onPage={setFeePage} />
      </section>
    </div>
  );
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="students-pagination">
      <span>Showing {((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}</span>
      <div>
        <button className="eb-pill-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages.toLocaleString()}</span>
        <button className="eb-pill-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
