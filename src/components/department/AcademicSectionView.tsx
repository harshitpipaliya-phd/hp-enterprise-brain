import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, ChevronDown, GraduationCap, IndianRupee, Layers, RefreshCw, Users } from 'lucide-react';
import type { Organization } from '../../App';
import { api as deptApi, type AcademicSection, type AcademicSectionsResponse } from '../../api/department';
import { api as studentApi, type Page, type Student } from '../../api/student';
import AcademicStructure from '../student/AcademicStructure';
import './DepartmentList.css';

/**
 * The Departments screen, for a school.
 *
 * WHY THIS EXISTS. Lions holds 7,445 children and ZERO rows in the connected HR
 * system, so the ordinary Departments screen was correctly — and uselessly —
 * empty. The alternative it replaced was worse: rendering every academic
 * dimension the imported files contain (standard, division, batch, quota,
 * subject, exam, academic year) as its own "department", which produced dozens
 * of cards that answered no question a head teacher asks.
 *
 * THESE ARE SECTIONS, NOT DEPARTMENTS, AND THE PAGE SAYS SO. Nothing here
 * creates a row in the HR system. The bands are derived on the server from the
 * standards the students are actually recorded in
 * (App\Domain\School\AcademicSections), so the counts move when the data moves
 * and nothing is stored that could go stale. The header states plainly that the
 * HR system records no departments, so a reader is never left thinking these
 * four cards are HR units.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO SECTIONS, IN A DELIBERATE ORDER.
 *
 *   1. DEPARTMENTS — the four teaching sections. The organizational structure:
 *      few cards, big numbers, clickable, and the thing a head teacher
 *      navigates by.
 *   2. ACADEMIC STRUCTURE — every dimension the imported files are organised
 *      by: academic years, standards, divisions, subjects, exams, batches,
 *      quotas. Unchanged, complete, and rendered by the SAME component the
 *      product already had (components/student/AcademicStructure).
 *
 * WHY BOTH, WHEN ONE USED TO REPLACE THE OTHER. DepartmentApp previously showed
 * the academic structure INSTEAD of the departments screen whenever the HR
 * system was empty, so on Lions the two could never be seen together and the
 * organizational view was unreachable. Nothing is lost by combining them; what
 * changes is the hierarchy, which the styling now states outright — section one
 * is the page, section two is supporting reference material beneath it, behind
 * a disclosure so it does not compete for attention on open.
 *
 * EVERY NUMBER IS THE ORGANIZATION'S OWN. Both endpoints resolve the tenant
 * from the auth token and ignore the URL segment, and the section totals
 * reconcile exactly against the People screen — on Lions, 2,500 + 1,736 + 1,407
 * + 1,697 placed plus 105 unplaced is 7,445. Any student whose grade the source
 * spells in a way the bands cannot read is COUNTED AND NAMED on the Students
 * tile rather than silently dropped, which is what keeps that reconciliation
 * honest rather than merely true today.
 */

interface Props {
  organization: Organization;
  /** How many units the HR system holds. Zero is why this view is showing. */
  hrDepartmentCount: number;
  onBack: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value);
}

export default function AcademicSectionView({ organization, hrDepartmentCount, onBack }: Props) {
  const [data, setData] = useState<AcademicSectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<AcademicSection | null>(null);
  /*
    Closed on open. The academic dimensions are a long list — Lions has twelve
    standards, eleven divisions, nine subjects, several exam types and hundreds
    of batch spellings — and unrolling all of it above the fold would bury the
    four department cards this page exists to lead with. It is one click away
    and nothing about it is hidden: the header says exactly what is inside.
  */
  const [structureOpen, setStructureOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    deptApi.getSections(organization.tenantId)
      .then((rows) => { if (!cancelled) { setData(rows); setError(null); } })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Unable to load sections.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organization.tenantId]);

  const totals = useMemo(() => {
    const sections = data?.sections ?? [];
    return {
      sections: sections.length,
      students: data?.totals.students ?? 0,
      unplaced: data?.totals.unplaced ?? 0,
      fees: sections.reduce((sum, s) => sum + s.feesCollected, 0),
      largest: Math.max(...sections.map((s) => s.students), 1),
    };
  }, [data]);

  if (loading) return <div className="dept-intel__loading">Loading sections…</div>;
  if (error) return <div className="dept-intel__empty dept-intel__empty--page"><strong>{error}</strong></div>;

  if (openSection) {
    return (
      <SectionDetail
        organization={organization}
        section={openSection}
        onBack={() => setOpenSection(null)}
      />
    );
  }

  return (
    <div className="dept-intel">
      <header className="dept-intel__header">
        <div>
          <h1>Departments</h1>
          <p>
            {organization.name} records no departments in its HR system. Its {totals.students.toLocaleString()}{' '}
            students are grouped below into the school&apos;s teaching sections, by the standard each child
            is recorded in.
          </p>
        </div>
        <div className="dept-intel__actions">
          <button className="dept-intel__ghost" onClick={onBack}>Back to Organization</button>
        </div>
      </header>

      <section className="dept-intel__kpis">
        <Kpi icon={<Layers size={18} />} label="Sections" value={totals.sections.toLocaleString()}
          hint="Teaching sections in use" />
        {/* The unplaced figure is on the tile, not in a footnote. It is what
            makes this total reconcile with the People screen, and hiding it
            would leave the four cards quietly summing to less. */}
        <Kpi icon={<GraduationCap size={18} />} label="Students" value={totals.students.toLocaleString()}
          hint={totals.unplaced > 0
            ? `${(totals.students - totals.unplaced).toLocaleString()} in a section · ${totals.unplaced.toLocaleString()} with no recorded standard`
            : 'Every student is placed in a section'} />
        <Kpi icon={<Building2 size={18} />} label="HR departments" value={hrDepartmentCount.toLocaleString()}
          hint="Units in the connected HR system" />
        <Kpi icon={<IndianRupee size={18} />} label="Fees collected" value={formatCurrency(totals.fees)}
          hint="Across all sections" />
      </section>

      {/* ── SECTION 1 — Departments ─────────────────────────────────────── */}
      <section className="dept-intel__directory">
        <div className="dept-intel__table-head">
          <div>
            <span className="dept-intel__kicker">Organizational structure</span>
            <h2>Departments</h2>
            <p>Select a department to see its students, results and fees.</p>
          </div>
          <span>{totals.sections.toLocaleString()} departments</span>
        </div>
        <div className="dept-intel__directory-grid">
          {(data?.sections ?? []).map((section) => (
            <article className="dept-intel__unit-card" key={section.id}>
              <div className="dept-intel__unit-head">
                <button className="dept-intel__link" onClick={() => setOpenSection(section)}>{section.name}</button>
                <span className="dept-intel__badge dept-intel__badge--good">Active</span>
              </div>
              <div className="dept-intel__unit-meta">
                <span>{section.standards}</span>
              </div>

              {/* One bar per card, scaled against the largest section, so the
                  relative size of the sections is readable without a chart. */}
              <div className="dept-intel__section-bar" aria-hidden="true">
                <i style={{ width: `${Math.max((section.students / totals.largest) * 100, 3)}%` }} />
              </div>

              <div className="dept-intel__unit-stats">
                <div>
                  <strong>{section.students.toLocaleString()}</strong>
                  <span>students</span>
                </div>
                <div>
                  <strong>{section.averagePercentage === null ? '—' : `${section.averagePercentage}%`}</strong>
                  <span>average result</span>
                </div>
                <div>
                  <strong>{formatCurrency(section.feesCollected)}</strong>
                  <span>fees collected</span>
                </div>
              </div>

              <div className="dept-intel__row-actions">
                <button onClick={() => setOpenSection(section)}>Open</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/*
        ── SECTION 2 — Academic structure ────────────────────────────────────

        Deliberately below, deliberately quieter, and deliberately closed on
        open: it is reference material about how the imported FILES are
        organised, not the organization's own structure. Nothing is removed —
        every dimension the product already computed (academic years, standards,
        divisions, subjects, exams, batches, quotas) is rendered by the same
        component as before, against the same cached, tenant-scoped endpoint.
      */}
      <section className="dept-intel__academic">
        <button
          type="button"
          className="dept-intel__academic-head"
          aria-expanded={structureOpen}
          onClick={() => setStructureOpen((open) => !open)}
        >
          <div>
            <span className="dept-intel__kicker">Supporting data</span>
            <h2>Academic structure</h2>
            <p>
              Every dimension {organization.name}&apos;s imported files are organised by — academic years,
              standards, divisions, subjects, exams and batches — with the records and students behind each.
            </p>
          </div>
          <span className="dept-intel__academic-toggle" data-open={structureOpen}>
            {structureOpen ? 'Hide' : 'Show'} <ChevronDown size={15} />
          </span>
        </button>

        {structureOpen && (
          <div className="dept-intel__academic-body">
            <AcademicStructure tenantId={organization.tenantId} />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * One section: its students, and the academic and fee totals behind them.
 *
 * The list is filtered BY THE SERVER on the same grade definition the card was
 * counted with (`?section=secondary`), so the "1,407 students" on the card and
 * the "1,407" above the table are the same query. Paged, because a section can
 * hold thousands of children and no screen in this product downloads a cohort.
 */
function SectionDetail({ organization, section, onBack }: {
  organization: Organization;
  section: AcademicSection;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Page<Student> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    studentApi.listStudents(organization.tenantId, { section: section.id, page, pageSize: 25 })
      .then((result) => { if (!cancelled) setRows(result); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organization.tenantId, section.id, page]);

  const pageCount = rows ? Math.max(1, Math.ceil(rows.total / rows.pageSize)) : 1;

  return (
    <div className="dept-intel">
      <header className="dept-intel__header">
        <div>
          <h1>{section.name}</h1>
          <p>{section.standards} · {section.students.toLocaleString()} students in {organization.name}.</p>
        </div>
        <div className="dept-intel__actions">
          <button className="dept-intel__ghost" onClick={onBack}>
            <ArrowLeft size={15} /> All sections
          </button>
        </div>
      </header>

      <section className="dept-intel__kpis">
        <Kpi icon={<Users size={18} />} label="Students" value={section.students.toLocaleString()}
          hint={`${section.studentsInBothFiles.toLocaleString()} in both the results and fee files`} />
        <Kpi icon={<GraduationCap size={18} />} label="Average result"
          value={section.averagePercentage === null ? '—' : `${section.averagePercentage}%`}
          hint={`${section.academicRecords.toLocaleString()} academic records`} />
        <Kpi icon={<IndianRupee size={18} />} label="Fees collected" value={formatCurrency(section.feesCollected)}
          hint={`${section.feeRecords.toLocaleString()} receipts · ${section.studentsWithFees.toLocaleString()} students`} />
        <Kpi icon={<Layers size={18} />} label="Standards" value={section.standards.replace(/^Standards\s*/, '')}
          hint="Grades taught in this section" />
      </section>

      <section className="dept-intel__directory">
        <div className="dept-intel__table-head">
          <div>
            <h2>Students</h2>
            <p>Only children recorded in {section.standards.toLowerCase()}.</p>
          </div>
          <span>{(rows?.total ?? 0).toLocaleString()} total</span>
        </div>

        {loading && !rows ? (
          <div className="dept-intel__empty">Loading students…</div>
        ) : (rows?.data.length ?? 0) === 0 ? (
          <div className="dept-intel__empty">No students are recorded in this section.</div>
        ) : (
          <>
            <div className="dept-intel__table-scroll">
              <table className="dept-intel__table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Enrolment</th>
                    <th>Standard</th>
                    <th className="num">Average</th>
                    <th className="num">Records</th>
                    <th className="num">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows?.data.map((student) => (
                    <tr key={student.id}>
                      <td>{student.studentName}</td>
                      <td className="mono">{student.studentRef}</td>
                      <td>{student.academicStandard ?? student.standard ?? '—'}</td>
                      <td className="num">{student.avgPercentage === null ? '—' : `${student.avgPercentage}%`}</td>
                      <td className="num">{(student.academicRecords + student.feeRecords).toLocaleString()}</td>
                      <td className="num">{student.totalPaid === null ? '—' : formatCurrency(student.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="dept-intel__pager">
              <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {page} of {pageCount.toLocaleString()}</span>
              <button disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
                {loading ? <RefreshCw size={14} /> : null} Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <article className="dept-intel__kpi" data-tone="state">
      <div className="dept-intel__kpi-icon">{icon}</div>
      <div className="dept-intel__kpi-label">{label}</div>
      <div className="dept-intel__kpi-value">{value}</div>
      <div className="dept-intel__kpi-hint">{hint}</div>
    </article>
  );
}
