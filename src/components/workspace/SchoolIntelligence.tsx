import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, BarChart3, BookOpen, CalendarRange, GraduationCap,
  IndianRupee, Link2, ShieldCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { api } from '../../api/student';
import '../student/StudentList.css';
import './SchoolIntelligence.css';

/**
 * School intelligence — what this organization's academic and fee files say.
 *
 * EVERY NUMBER ON THIS PANEL IS A SQL AGGREGATE over the tenant's own rows,
 * computed by AcademicIntelligenceService and cached against a fingerprint of
 * the source data. No language model is called to render this screen, and none
 * contributed to any figure, ranking or category on it. The panel says so at the
 * bottom, next to the numbers, rather than in documentation nobody reads.
 *
 * IT RENDERS NOTHING WHEN THE ORGANIZATION HAS NO DATASETS. An organization
 * whose intelligence comes from the ERP sees the workspace exactly as before.
 *
 * WHAT IT REFUSES TO SHOW. There is no outstanding balance, no overdue figure,
 * no collection rate and no "students at risk" score, because the fee export
 * contains money received and nothing owed — a rate needs a denominator the
 * source does not have. The absent measures are listed explicitly so their
 * absence reads as a property of the data rather than a missing feature.
 */
export default function SchoolIntelligence({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getIntelligence(tenantId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) return <div className="students-skeleton" style={{ height: 96, marginBottom: 24 }} />;

  const academic = data?.academic;
  const fees = data?.fees;
  const cohorts = data?.cohorts;
  const relationship = data?.relationship;

  // Nothing to say for an organization without school datasets.
  if (!academic && !fees) return null;

  return (
    <section className="school-intel">
      <header className="school-intel__header">
        <span className="intel-eyebrow"><GraduationCap size={14} /> School intelligence</span>
        <h2>What this organization&apos;s academic and fee records show</h2>
        <p>
          Derived by SQL aggregation over {formatNumber(academic?.records)} exam-result rows
          {fees && <> and {formatNumber(fees.receipts)} fee receipts</>} belonging to this organization.
        </p>
      </header>

      {/*
        The non-contemporaneity warning leads, because everything below is read
        in its light. Two files four years apart cannot describe one present.
      */}
      {relationship?.available && relationship.contemporaneous === false && (
        <div className="school-intel__caution">
          <CalendarRange size={16} aria-hidden="true" />
          <div>
            <strong>The academic and fee records cover different periods</strong>
            <p>
              Exam results run {(relationship.academicYears ?? []).filter(Boolean).join('–') || '—'};
              receipts run {(relationship.feeYears ?? []).filter(Boolean).join('–') || '—'}.
              {' '}{relationship.caution}
            </p>
          </div>
        </div>
      )}

      <div className="school-intel__kpis">
        <Kpi icon={<GraduationCap />} label="Students" value={formatNumber(cohorts?.total)}
             hint="One per enrollment number across both files" />
        <Kpi icon={<Link2 />} label="In both files" value={formatNumber(cohorts?.matched)}
             hint={`${formatNumber(cohorts?.academicOnly)} results only · ${formatNumber(cohorts?.feesOnly)} fees only`} />
        {academic && (
          <Kpi icon={<BarChart3 />} label="Overall average" value={academic.avgPercentage === null ? '—' : `${Number(academic.avgPercentage).toFixed(1)}%`}
               hint="Marks obtained ÷ marks available, across every paper" />
        )}
        {fees && (
          <Kpi icon={<IndianRupee />} label="Fees collected" value={money(fees.totalCollected)}
               hint={`Average receipt ${money(fees.averageReceipt)}`} />
        )}
      </div>

      <div className="school-intel__grid">
        {academic && (
          <>
            <Panel icon={<TrendingUp />} title="Highest averages"
                   note="Students with at least ten recorded papers, across every year on file.">
              <PerformerList rows={academic.topPerformers} />
            </Panel>

            <Panel icon={<TrendingDown />} title="Lowest averages"
                   note="Same threshold. A single-paper result is not ranked as a school-wide outcome.">
              <PerformerList rows={academic.lowPerformers} />
            </Panel>

            <Panel icon={<BookOpen />} title="Subject performance" note="Weighted by marks available, not by paper count.">
              <Bars rows={(academic.bySubject ?? []).slice(0, 12)} labelKey="subject" valueKey="avgPct" suffix="%" secondary={(r: any) => `${formatNumber(r.records)} papers`} />
            </Panel>

            <Panel icon={<GraduationCap />} title="Standard-wise performance" note="Each standard as the academic export names it.">
              <Bars rows={academic.byStandard ?? []} labelKey="standard" valueKey="avgPct" suffix="%" secondary={(r: any) => `${formatNumber(r.records)} papers`} />
            </Panel>

            <Panel icon={<CalendarRange />} title="Year-wise performance" note="Averages by academic year.">
              <Bars rows={academic.byYear ?? []} labelKey="syear" valueKey="avgPct" suffix="%" secondary={(r: any) => `${formatNumber(r.records)} papers`} />
            </Panel>

            <Panel icon={<BarChart3 />} title="Exam-type performance" note="Written papers, projects and activities compared.">
              <Bars rows={academic.byExam ?? []} labelKey="exam" valueKey="avgPct" suffix="%" secondary={(r: any) => `${formatNumber(r.records)} papers`} />
            </Panel>

            <Panel icon={<AlertTriangle />} title="Data quality" note={academic.anomalies?.note}>
              <dl className="school-intel__facts">
                <Fact label="Marks obtained exceed the paper total" value={formatNumber(academic.anomalies?.obtainedExceedsTotal)} />
                <Fact label="Rows with no paper total" value={formatNumber(academic.anomalies?.missingTotal)} />
                <Fact label="Rows with no marks obtained" value={formatNumber(academic.anomalies?.missingObtained)} />
              </dl>
              {(academic.anomalies?.examples ?? []).length > 0 && (
                <ul className="school-intel__examples">
                  {academic.anomalies.examples.map((e: any) => (
                    <li key={e.naturalKey}>
                      <code>{e.studentRef}</code> {e.subject} · {e.exam} — {e.obtained} of {e.total}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}

        {fees && (
          <>
            <Panel icon={<IndianRupee />} title="Payment mode" note="How the money actually arrived.">
              <Bars rows={fees.byMode ?? []} labelKey="mode" valueKey="collected" money
                    secondary={(r: any) => `${formatNumber(r.receipts)} receipts`} />
            </Panel>

            <Panel icon={<CalendarRange />} title="Collection by month" note="Receipt dates as recorded on the register.">
              <Bars rows={fees.byMonth ?? []} labelKey="period" valueKey="collected" money
                    secondary={(r: any) => `${formatNumber(r.receipts)} receipts`} />
            </Panel>

            <Panel icon={<GraduationCap />} title="Collection by standard" note="Standard as the FEE REGISTER records it — a different vocabulary from the academic export.">
              <Bars rows={fees.byStandard ?? []} labelKey="standard" valueKey="collected" money
                    secondary={(r: any) => `${formatNumber(r.students)} students`} />
            </Panel>

            <Panel icon={<ShieldCheck />} title="Not derivable from this source"
                   note="Named rather than silently omitted, so the gap reads as a property of the file.">
              <dl className="school-intel__facts">
                {Object.entries(fees.notDerivable ?? {}).map(([key, why]) => (
                  <div key={key} className="school-intel__fact school-intel__fact--wide">
                    <dt>{humanise(key)}</dt>
                    <dd>{String(why)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </>
        )}
      </div>

      <p className="students-provenance">
        <ShieldCheck size={14} aria-hidden="true" />
        {data?.derivation?.method} {data?.derivation?.llm} {data?.derivation?.scope}
      </p>
    </section>
  );
}

function formatNumber(v: unknown): string {
  return v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString();
}

function money(v: unknown): string {
  return v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
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

function Panel({ icon, title, note, children }: { icon: ReactNode; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="school-intel__panel">
      <header>
        <span>{icon}</span>
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
      </header>
      <div className="school-intel__body">{children}</div>
    </section>
  );
}

function PerformerList({ rows }: { rows: any[] }) {
  if (!rows?.length) return <p className="school-intel__empty">Not enough recorded papers to rank anyone.</p>;
  return (
    <ol className="school-intel__ranked">
      {rows.map((r) => (
        <li key={r.id}>
          <span>
            <strong>{r.studentName || r.studentRef}</strong>
            <small>{r.studentRef}{r.standard && ` · ${r.standard}`}{r.years && ` · ${r.years}`}</small>
          </span>
          <b>{r.avgPercentage === null ? '—' : `${Number(r.avgPercentage).toFixed(1)}%`}</b>
        </li>
      ))}
    </ol>
  );
}

/**
 * A labelled bar per row, scaled to the largest value in the set.
 *
 * Deliberately not a charting library: these are one-dimensional comparisons
 * where the number matters more than the shape, and the number is always
 * printed. The bar is an aid to scanning, never the only way to read the value.
 */
function Bars({ rows, labelKey, valueKey, suffix = '', money: asMoney = false, secondary }: {
  rows: any[]; labelKey: string; valueKey: string; suffix?: string; money?: boolean; secondary?: (r: any) => string;
}) {
  if (!rows?.length) return <p className="school-intel__empty">No rows.</p>;
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);

  return (
    <div className="school-intel__bars">
      {rows.map((r, i) => {
        const value = Number(r[valueKey]) || 0;
        return (
          <div className="school-intel__bar" key={`${r[labelKey] ?? i}`}>
            <span className="school-intel__bar-label" title={String(r[labelKey] ?? '')}>{r[labelKey] ?? '—'}</span>
            <span className="school-intel__bar-track">
              <span className="school-intel__bar-fill" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
            </span>
            <b>{asMoney ? money(value) : `${value.toFixed(1)}${suffix}`}</b>
            {secondary && <small>{secondary(r)}</small>}
          </div>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="school-intel__fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
