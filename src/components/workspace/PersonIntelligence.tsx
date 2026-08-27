import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api as personApi } from '../../api/person';
import { api as departmentApi } from '../../api/department';
import { LoadingState, ErrorState } from '../shared/States';
import './PersonProfile.css';
import { ExploreInGraphButton } from '../graph/ExploreInGraphButton';

/**
 * The person profile.
 *
 * WHAT THIS SCREEN IS FOR. One person, everything the installation actually
 * holds about them, and nothing else. It reads a single endpoint —
 * GET /people/{tenantId}/{id}/twin — which is tenant-scoped server-side, so a
 * person from another organization cannot be rendered here even if their id is
 * guessed.
 *
 * THE RULE THAT SHAPES EVERY BRANCH BELOW: A FIELD WITH NO VALUE IS NOT DRAWN.
 * The screen this replaced rendered a fixed set of cards whose contents were
 * `—` for every tenant onboarded so far, alongside empty states that printed the
 * response's own key names ("capabilityScores[] is empty", "No attributed
 * activity in this twin yet"). Both are failures of the same kind: the interface
 * describing its own plumbing rather than the person. Here a section renders
 * only when the API returned something for it, and when it genuinely has nothing
 * the empty state says what is missing and what would fill it, in the reader's
 * words.
 *
 * NOTHING IS COMPUTED HERE THAT THE API DID NOT SEND. Totals, percentages and
 * counts all arrive derived. Recomputing one in a component is a second
 * definition of it, and the two will disagree.
 */

/* ─────────────────────────────── the payload ─────────────────────────────── */

interface Identity {
  id: string;
  externalRef: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  role: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  joinedDate: string | null;
  status: string;
  createdDate: string | null;
  updatedDate: string | null;
  mappedFields: string[];
}

interface LinkRule {
  column: string;
  label: string;
  value: string;
  basis: string;
  records: number;
}

interface DatasetSummary {
  dataset: string;
  label: string;
  records: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

interface RecordRow {
  id: string;
  dataset: string;
  datasetLabel: string;
  reference: string | null;
  occurredAt: string | null;
  closedAt: string | null;
  status: string | null;
  category: string | null;
  subCategory: string | null;
  amount: number | null;
  currency: string | null;
  quantity: number | null;
  location: string | null;
  linkedBy: string[];
  source: { file: string | null; row: number | null; importJobId: string | null; importedAt: string | null };
  detail: Array<{ label: string; value: string }>;
}

interface Invoice {
  reference: string | null;
  period: string | null;
  component: string | null;
  dueDate: string | null;
  net: number;
  paid: number;
  outstanding: number;
  status: string | null;
  daysOverdue: number | null;
  method: string | null;
  paymentDate: string | null;
}

interface Finance {
  currency: string | null;
  records: number;
  covered: number;
  partial: boolean;
  billed: number;
  concession: number;
  net: number;
  paid: number;
  outstanding: number;
  overdue: number;
  collectedPct: number | null;
  statusCounts: Array<{ name: string; count: number }>;
  components: Array<{ name: string; net: number }>;
  methods: Array<{ name: string; count: number }>;
  lastPayment: { date: string; amount: number; method: string | null } | null;
  nextDueDate: string | null;
  invoices: Invoice[];
}

interface Academic {
  studentRef?: string;
  admissionNo?: string;
  grNo?: string;
  class?: string;
  section?: string;
  academicYear?: string;
  department?: string;
  campus?: string;
  feePlan?: string;
  scholarship?: string;
  transport?: string;
  quota?: string;
  attendancePct?: number;
  examAveragePct?: number;
  engagementPct?: number;
  riskBand?: string;
  classesOnRecord?: number;
  sectionsOnRecord?: number;
}

/**
 * The imported datasets that make an organization's people STUDENTS.
 *
 * A set rather than a substring test: 'school_fee' is the dataset the academic
 * panel is actually built from today, and listing the others explicitly is what
 * keeps a future 'school_transport' or an unrelated 'schedule' from silently
 * turning the section on for a tenant that has no roster.
 */
const ACADEMIC_DATASETS = new Set(['school_fee', 'school_exam', 'school_attendance', 'student_roster']);

interface CapabilityScore {
  capabilityId: string;
  capabilityName: string;
  capabilityState: string;
  scores: Record<string, number | null>;
  gaps: Array<{ dimension: string; currentLevel: number | null; targetLevel: number; gap: number }>;
  assessedDate: string | null;
}

interface Intelligence {
  capabilities: CapabilityScore[];
  decisions: { total: number; approved: number; items: Array<{ id: string; status: string | null; rationale: string | null; createdAt: string | null }> };
  executions: Array<{ id: string; esoId: string | null; status: string; completedDate: string | null; createdDate: string | null }>;
  executionSuccessCount: number;
  learnings: number;
  signals: Array<{
    id: string; ruleKey: string | null; title: string | null; classification: string | null;
    severity: string | null; priority: string | null; status: string | null;
    confidence: number | null; source: string | null; createdAt: string | null;
  }>;
  signalCount: number;
  evidenceCount: number;
  cases: Array<{ id: string; title: string | null; status: string | null; createdAt: string | null }>;
  score: { score: number | null; breakdown: Record<string, number | null> };
}

interface Guardian {
  firstName: string | null;
  lastName: string | null;
  relationship: string | null;
  email: string | null;
  phone: string | null;
  isPrimaryContact: boolean;
  origin: string;
}

interface TimelineEvent {
  at: string;
  kind: string;
  title: string;
  detail: string | null;
  source: string;
  amount: number | null;
  currency: string | null;
}

interface Profile {
  person: Identity;
  organization: { id: string; name: string | null; code: string | null; industry: string | null } | null;
  /**
   * The operational datasets this ORGANIZATION has imported — not this person's.
   *
   * It is how the page tells "this person has no academic record" apart from
   * "this organization has never held academic data", which are the same empty
   * panel and opposite findings. Optional so a server that predates it degrades
   * to the older behaviour rather than hiding a section that should be there.
   */
  datasets?: Array<{ dataset: string; label: string; records: number }>;
  linkage: { available: boolean; rules: LinkRule[]; matched: LinkRule[]; records: number; datasets: DatasetSummary[] };
  academic: Academic | null;
  contacts: { guardians: Guardian[] };
  finance: Finance | null;
  activity: { available: boolean; datasets: DatasetSummary[]; records: RecordRow[]; total: number; shown: number };
  intelligence: Intelligence;
  timeline: { events: TimelineEvent[]; total: number; bounded: boolean };
  audit: Array<{ action: string; entityType: string | null; actorName: string | null; createdAt: string | null }>;
}

export interface PersonProfileActions {
  onBack?: () => void;
  backLabel?: string;
  onEdit?: () => void;
  onArchive?: () => void;
  onViewSourceRecord?: () => void;
  /**
   * Open Graph Explorer centred on this person.
   *
   * Optional, and absent by default: a host that has no navigation — a test, an
   * embed — renders no button rather than a dead one.
   */
  onExploreInGraph?: (label: string, id: string) => void;
}

/* ──────────────────────────────── formatting ─────────────────────────────── */

/**
 * MySQL hands back 'YYYY-MM-DD HH:MM:SS'. Passing that to `new Date` is
 * implementation-defined and returns Invalid Date in Safari, which rendered as
 * the literal string "Invalid Date" in the timeline. The T makes it ISO.
 */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value: string | null | undefined): string | null {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
}

function fmtDateTime(value: string | null | undefined): string | null {
  const date = parseDate(value);
  return date ? date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
}

/** Currency as the record itself stored it. No default currency is assumed. */
function money(value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined) return '—';
  const code = (currency ?? '').trim();
  if (/^[A-Za-z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code.toUpperCase(), maximumFractionDigits: 0 }).format(value);
    } catch {
      // An ISO-shaped code the runtime does not know. Fall through to plain
      // number plus the code rather than throwing inside a render.
    }
  }
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return code === '' ? formatted : `${code} ${formatted}`;
}

function pct(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : `${value}%`;
}

function initials(person: Identity): string {
  const name = person.displayName ?? '';
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function badgeClass(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (!s) return 'eb-badge';
  if (/(paid|complete|approved|success|resolved|closed|low)/.test(s) && !/unpaid|partially/.test(s)) return 'eb-badge eb-badge-success';
  if (/(overdue|fail|reject|critical|high|breach)/.test(s)) return 'eb-badge eb-badge-danger';
  if (/(partial|pending|progress|due|medium|open|new)/.test(s)) return 'eb-badge eb-badge-warning';
  return 'eb-badge';
}

/* ───────────────────────────── small primitives ──────────────────────────── */

function Panel({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <div className="eb-panel">
      <div className="eb-panel-head">
        <span className="eb-panel-title">{title}</span>
        {tag && <span className="eb-panel-tag">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * An empty state that names the thing that is missing and what would produce it.
 *
 * Never the response key, never the table. A reader who sees this needs to know
 * whether to wait, to import something, or to stop looking.
 */
function Empty({ headline, explain }: { headline: string; explain: string }) {
  return (
    <div className="pp-empty">
      <strong>{headline}</strong>
      <p>{explain}</p>
    </div>
  );
}

/** A definition list that skips every row whose value is absent. */
function Fields({ rows }: { rows: Array<[string, ReactNode | null | undefined, boolean?]> }) {
  const present = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (present.length === 0) return null;
  return (
    <dl className="pp-fields">
      {present.map(([label, value, mono]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd className={mono ? 'pp-mono' : undefined}>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="pp-stat">
      <div className="pp-stat-label">{label}</div>
      <div className="pp-stat-value">{value}</div>
      {hint && <div className="pp-stat-hint">{hint}</div>}
    </div>
  );
}

/* ──────────────────────────────── the screen ─────────────────────────────── */

type Tab = 'overview' | 'finance' | 'records' | 'intelligence' | 'timeline';

export default function PersonIntelligence({
  tenantId,
  personId,
  onBack,
  backLabel = 'Back',
  onEdit,
  onArchive,
  onViewSourceRecord,
  onExploreInGraph,
}: { tenantId: string; personId: string } & PersonProfileActions) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [openRecord, setOpenRecord] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    personApi.getProfile(tenantId, personId)
      .then((data: Profile) => setProfile(data))
      .catch((e: any) => setError(e?.message ?? 'Could not load this person.'))
      .finally(() => setLoading(false));
  }, [tenantId, personId]);

  // Re-runs whenever the person or the organization changes, so navigating from
  // one person straight to another cannot leave the previous one on screen.
  useEffect(() => { load(); }, [load]);

  // A person with no fee records is not a school student, and a fees tab that
  // can only ever be empty is noise. Tabs follow the data.
  const tabs = useMemo(() => {
    if (!profile) return [] as Array<{ key: Tab; label: string; count?: number }>;
    return [
      { key: 'overview' as Tab, label: 'Overview' },
      ...(profile.finance ? [{ key: 'finance' as Tab, label: 'Fees & payments', count: profile.finance.records }] : []),
      { key: 'records' as Tab, label: 'Records', count: profile.activity.total },
      { key: 'intelligence' as Tab, label: 'Intelligence', count: profile.intelligence.signalCount + profile.intelligence.capabilities.length },
      { key: 'timeline' as Tab, label: 'Timeline', count: profile.timeline.total },
    ];
  }, [profile]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === tab)) setTab('overview');
  }, [tabs, tab]);

  if (loading && !profile) return <LoadingState label="Loading person profile..." />;
  if (error && !profile) return <ErrorState message={error} />;
  if (!profile) return null;

  const { person, organization, academic, contacts, finance, activity, intelligence, linkage, timeline } = profile;
  const name = person.displayName ?? `Person ${person.id}`;
  const currency = finance?.currency ?? null;

  /*
    WHETHER THIS ORGANIZATION KEEPS ACADEMIC DATA AT ALL.

    A telecoms or healthcare tenant has no student roster and never will, so an
    "Academic record — none for this person" panel on every one of its engineers
    is a permanent empty section that says nothing. A school with an imported
    roster is the opposite case: there the same empty panel is a real finding
    about that student, and it stays.

    Derived from what the tenant has actually imported rather than from its
    industry label, because the industry field is free text an administrator
    typed and the datasets are what the product can see.
  */
  const academicDatasets = (profile.datasets ?? []).filter((d) => ACADEMIC_DATASETS.has(d.dataset) && d.records > 0);
  const showsAcademicSection = academic !== null || academicDatasets.length > 0;

  return (
    <div className="pp eb-fade-in">
      <div className="pp-actions">
        {onBack && <button className="eb-pill-btn" onClick={onBack}>{'← '}{backLabel}</button>}
        <span className="pp-actions-spacer" />
        <ExploreInGraphButton
          label="Person"
          id={personId}
          entityName={name}
          onExplore={onExploreInGraph}
          className="eb-pill-btn"
        />
        {onEdit && <button className="eb-pill-btn" onClick={onEdit}>Edit contact details</button>}
        {onViewSourceRecord && <button className="eb-pill-btn" onClick={onViewSourceRecord}>Source record</button>}
        <button className="eb-pill-btn" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        {onArchive && <button className="eb-pill-btn" onClick={onArchive}>Archive</button>}
      </div>

      {error && <div className="pp-alert" role="alert">Could not refresh this person: {error}. The details below are from the last successful load.</div>}

      <header className="pp-head">
        <div>
          <div className="eb-eyebrow">Person profile{organization?.name ? ` · ${organization.name}` : ''}</div>
          <h1>{name}</h1>
          <div className="pp-head-meta">
            {person.role && <span className="eb-badge eb-badge-info">{person.role}</span>}
            {person.jobTitle && <span className="eb-badge">{person.jobTitle}</span>}
            {person.departmentName && <span className="eb-badge">{person.departmentName}</span>}
            {person.externalRef && <span className="eb-badge">Ref {person.externalRef}</span>}
            {academic?.academicYear && <span className="eb-badge">Academic year {academic.academicYear}</span>}
          </div>
        </div>
        <span className="pp-avatar" aria-hidden="true">{initials(person)}</span>
      </header>

      {tabs.length > 1 && (
        <div className="pp-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className="pp-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'overview' && (
        <>
          <Highlights profile={profile} />
          <Standing profile={profile} tenantId={tenantId} />

          <div className="pp-grid">
            <Panel title="Profile">
              <Fields
                rows={[
                  ['Full name', name],
                  ['Reference', person.externalRef, true],
                  ['Role', person.role],
                  ['Job title', person.jobTitle],
                  [person.role?.toLowerCase() === 'student' ? 'Class section' : 'Department', person.departmentName],
                  ['Email', person.email && <a href={`mailto:${person.email}`}>{person.email}</a>],
                  ['Phone', person.phone],
                  ['Gender', person.gender],
                  ['Joined', fmtDate(person.joinedDate)],
                  ['Organization', organization?.name],
                  ['Record created', fmtDateTime(person.createdDate)],
                  ['Last updated', fmtDateTime(person.updatedDate)],
                ]}
              />
              <p className="pp-note" style={{ margin: '16px 0 0' }}>
                These are the fields this organization’s source system holds for a person. Fields it does
                not hold are not shown rather than shown blank.
              </p>
            </Panel>

            {!showsAcademicSection ? null : academic ? (
              <Panel title="Academic record">
                <Fields
                  rows={[
                    ['Student reference', academic.studentRef, true],
                    ['Admission number', academic.admissionNo, true],
                    ['GR number', academic.grNo, true],
                    ['Class', academic.class],
                    ['Section', academic.section],
                    ['Academic year', academic.academicYear],
                    ['Department', academic.department],
                    ['Campus', academic.campus],
                    ['Fee plan', academic.feePlan],
                    ['Scholarship', academic.scholarship],
                    ['Quota', academic.quota],
                    ['Transport enrolled', academic.transport],
                    ['Attendance', pct(academic.attendancePct)],
                    ['Term average', pct(academic.examAveragePct)],
                    ['Learning platform engagement', pct(academic.engagementPct)],
                    ['Risk band on record', academic.riskBand && <span className={badgeClass(academic.riskBand)}>{academic.riskBand}</span>],
                  ]}
                />
                {(academic.classesOnRecord ?? 0) > 1 && (
                  <p className="pp-note" style={{ margin: '16px 0 0' }}>
                    This student appears under {academic.classesOnRecord} different classes across their records.
                    The values above are from the most recent one.
                  </p>
                )}
              </Panel>
            ) : (
              <Panel title="Academic record">
                <Empty
                  headline="No academic record for this person."
                  explain={`Class, section and academic year come from this organization's imported student records — ${academicDatasets.reduce((sum, d) => sum + d.records, 0).toLocaleString()} of them. None reference this person.`}
                />
              </Panel>
            )}
          </div>

          <div className="pp-grid">
            <Panel title="Contacts">
              {contacts.guardians.length === 0 ? (
                <Empty
                  headline="No additional contacts on record."
                  explain="Guardian and next-of-kin details are read from the guardian register and from imported student records. Neither holds a contact for this person."
                />
              ) : (
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead>
                      <tr><th>Name</th><th>Relationship</th><th>Contact</th><th>Source</th></tr>
                    </thead>
                    <tbody>
                      {contacts.guardians.map((g, i) => (
                        <tr key={i}>
                          <td>
                            {[g.firstName, g.lastName].filter(Boolean).join(' ') || '—'}
                            {g.isPrimaryContact && <span className="eb-badge eb-badge-info" style={{ marginLeft: 6 }}>Primary</span>}
                          </td>
                          <td>{g.relationship ?? '—'}</td>
                          <td>
                            {g.email && <div><a href={`mailto:${g.email}`}>{g.email}</a></div>}
                            {g.phone && <div>{g.phone}</div>}
                            {!g.email && !g.phone && '—'}
                          </td>
                          <td className="pp-timeline-source">
                            {g.origin === 'guardian_register' ? 'Guardian register' : 'Imported student record'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="How records are attached">
              {linkage.matched.length === 0 ? (
                <Empty
                  headline="No imported records reference this person."
                  explain={
                    linkage.rules.length === 0
                      ? 'Attaching records to a person needs either a reference number or a name in their source record. This person has neither.'
                      : 'Imported records name the person they concern by reference or by name. Nothing imported for this organization carries either of this person’s.'
                  }
                />
              ) : (
                <>
                  <p className="pp-note">
                    Records are attached to a person only by an exact match on a value stored in the record
                    itself. Nothing is attached by similarity.
                  </p>
                  <div className="pp-table-wrap">
                    <table className="pp-table">
                      <thead><tr><th>Match</th><th>Value</th><th className="pp-num">Records</th></tr></thead>
                      <tbody>
                        {linkage.rules.map((rule) => (
                          <tr key={rule.column}>
                            <td>{rule.label}<div className="pp-timeline-source">{rule.basis}</div></td>
                            <td className="pp-mono">{rule.value}</td>
                            <td className="pp-num">{rule.records.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>
          </div>
        </>
      )}

      {tab === 'finance' && finance && (
        <>
          <dl className="pp-money">
            <div><dt>Total billed</dt><dd>{money(finance.billed, currency)}</dd></div>
            <div><dt>Concession</dt><dd>{money(finance.concession, currency)}</dd></div>
            <div><dt>Net payable</dt><dd>{money(finance.net, currency)}</dd></div>
            <div><dt>Amount paid</dt><dd>{money(finance.paid, currency)}</dd></div>
            <div><dt>Outstanding</dt><dd>{money(finance.outstanding, currency)}</dd></div>
            <div><dt>Of which overdue</dt><dd>{money(finance.overdue, currency)}</dd></div>
          </dl>

          <div className="pp-grid">
            <Panel title="Payment position">
              <Fields
                rows={[
                  ['Invoices on record', finance.records.toLocaleString()],
                  ['Collected', pct(finance.collectedPct)],
                  ['Last payment', finance.lastPayment
                    ? `${money(finance.lastPayment.amount, currency)} on ${fmtDate(finance.lastPayment.date)}${finance.lastPayment.method ? ` by ${finance.lastPayment.method}` : ''}`
                    : null],
                  ['Earliest unpaid due date', fmtDate(finance.nextDueDate)],
                  ['Payment status', finance.statusCounts.length > 0 && (
                    <span className="pp-chips">
                      {finance.statusCounts.map((s) => (
                        <span key={s.name} className={badgeClass(s.name)}>{s.name} · {s.count}</span>
                      ))}
                    </span>
                  )],
                  ['Payment methods used', finance.methods.length > 0 && (
                    <span className="pp-chips">
                      {finance.methods.map((m) => <span key={m.name} className="eb-badge">{m.name} · {m.count}</span>)}
                    </span>
                  )],
                ]}
              />
              {finance.partial && (
                <p className="pp-note" style={{ margin: '16px 0 0' }}>
                  The figures above cover the {finance.covered.toLocaleString()} most recent of{' '}
                  {finance.records.toLocaleString()} invoices for this person.
                </p>
              )}
            </Panel>

            <Panel title="Fee components">
              {finance.components.length === 0 ? (
                <Empty
                  headline="No fee components recorded."
                  explain="Imported invoices for this person do not name what each charge was for."
                />
              ) : (
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead><tr><th>Component</th><th className="pp-num">Net</th></tr></thead>
                    <tbody>
                      {finance.components.map((c) => (
                        <tr key={c.name}><td>{c.name}</td><td className="pp-num">{money(c.net, currency)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Invoices and payments">
            {finance.invoices.length === 0 ? (
              <Empty
                headline="No payment records found for this person."
                explain="Fee records are created when a fee export is imported for this organization. None of the imported rows reference this person."
              />
            ) : (
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th>Reference</th><th>Period</th><th>Component</th><th>Due</th>
                      <th className="pp-num">Net</th><th className="pp-num">Paid</th><th className="pp-num">Outstanding</th>
                      <th>Status</th><th>Paid on</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.invoices.map((inv, i) => (
                      <tr key={`${inv.reference}-${i}`}>
                        <td className="pp-mono">{inv.reference ?? '—'}</td>
                        <td>{inv.period ?? '—'}</td>
                        <td>{inv.component ?? '—'}</td>
                        <td>
                          {fmtDate(inv.dueDate) ?? '—'}
                          {inv.daysOverdue !== null && (
                            <div className="pp-timeline-source">
                              {inv.daysOverdue} {inv.daysOverdue === 1 ? 'day' : 'days'} late
                            </div>
                          )}
                        </td>
                        <td className="pp-num">{money(inv.net, currency)}</td>
                        <td className="pp-num">{money(inv.paid, currency)}</td>
                        <td className="pp-num">{money(inv.outstanding, currency)}</td>
                        <td>{inv.status ? <span className={badgeClass(inv.status)}>{inv.status}</span> : '—'}</td>
                        <td>
                          {fmtDate(inv.paymentDate) ?? '—'}
                          {inv.method && <div className="pp-timeline-source">{inv.method}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'records' && (
        <>
          {activity.datasets.length > 0 && (
            <div className="pp-stats">
              {activity.datasets.map((d) => (
                <Stat
                  key={d.dataset}
                  label={d.label}
                  value={d.records.toLocaleString()}
                  hint={d.firstSeen && d.lastSeen ? `${fmtDate(d.firstSeen)} – ${fmtDate(d.lastSeen)}` : null}
                />
              ))}
            </div>
          )}

          <Panel title="Imported records">
            {activity.records.length === 0 ? (
              <Empty
                headline="No imported records reference this person."
                explain="Records arrive through the Ingestion screen. Once an import contains this person’s reference or name, its rows appear here."
              />
            ) : (
              <>
                {activity.total > activity.shown && (
                  <p className="pp-note">
                    Showing the {activity.shown} most recent of {activity.total.toLocaleString()} records
                    attached to this person.
                  </p>
                )}
                <div className="pp-table-wrap">
                  <table className="pp-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Record</th><th>Type</th><th>Status</th>
                        <th className="pp-num">Amount</th><th>Attached as</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {activity.records.map((r) => (
                        <tr key={r.id}>
                          <td>{fmtDate(r.occurredAt) ?? '—'}</td>
                          <td>
                            <div>{r.category ?? r.datasetLabel}</div>
                            {r.reference && <div className="pp-mono pp-timeline-source">{r.reference}</div>}
                            {openRecord === r.id && r.detail.length > 0 && (
                              <div className="pp-record-detail" style={{ marginTop: 10 }}>
                                {r.detail.map((d) => (
                                  <span key={d.label}><b>{d.label}</b><span>{d.value}</span></span>
                                ))}
                                {r.source.file && (
                                  <span><b>Imported from</b><span>{r.source.file}{r.source.row ? ` row ${r.source.row}` : ''}</span></span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>{r.datasetLabel}</td>
                          <td>{r.status ? <span className={badgeClass(r.status)}>{r.status}</span> : '—'}</td>
                          <td className="pp-num">{r.amount === null ? '—' : money(r.amount, r.currency)}</td>
                          <td className="pp-timeline-source">{r.linkedBy.join(', ') || '—'}</td>
                          <td>
                            {r.detail.length > 0 && (
                              <button
                                className="pp-disclosure"
                                aria-expanded={openRecord === r.id}
                                onClick={() => setOpenRecord(openRecord === r.id ? null : r.id)}
                              >
                                {openRecord === r.id ? 'Hide' : 'Details'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Panel>
        </>
      )}

      {tab === 'intelligence' && <IntelligenceTab intelligence={intelligence} personName={name} />}

      {tab === 'timeline' && (
        <Panel title="Timeline">
          {timeline.events.length === 0 ? (
            <Empty
              headline="No dated events for this person yet."
              explain="The timeline is built from their source record, the records attached to them, and anything the intelligence loop has recorded about them. None of those carries a date for this person."
            />
          ) : (
            <>
              {(timeline.total > timeline.events.length || timeline.bounded) && (
                <p className="pp-note">
                  Showing the {timeline.events.length} most recent events
                  {timeline.bounded ? ', drawn from the most recent records attached to this person' : ''}.
                </p>
              )}
              <div className="pp-timeline">
                {timeline.events.map((event, i) => (
                  <div key={`${event.at}-${i}`} className="eb-timeline-item">
                    <span className="eb-timeline-rail">
                      <span className="eb-timeline-dot" />
                      {i < timeline.events.length - 1 && <span className="eb-timeline-line" />}
                    </span>
                    <span className="pp-timeline-date">{fmtDate(event.at)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div className="eb-timeline-text">
                        {event.title}
                        {event.amount !== null && (
                          <span className="pp-mono" style={{ marginInlineStart: 8, color: 'var(--content-primary)' }}>
                            {money(event.amount, event.currency)}
                          </span>
                        )}
                      </div>
                      {event.detail && <div className="eb-timeline-meta">{event.detail}</div>}
                    </span>
                    <span className="pp-timeline-source">{event.source}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}

/* ─────────────────────────────── overview strip ──────────────────────────── */

/**
 * The tiles at the top of the overview.
 *
 * Built by pushing only what exists. The screen this replaced hard-coded five
 * tiles — Individual Score, Capabilities, Decisions, Approved, Learning — and
 * every one of them read `—` or `0` for every tenant, because those four tables
 * have never been written to in this installation. A tile with nothing in it is
 * not a neutral piece of furniture; it reads as a measured zero.
 */
/**
 * WHERE THIS PERSON STANDS — the part of a profile a database record cannot be.
 *
 * The rest of this screen reports facts about one person: their row, their
 * attached records, their invoices. None of it answers the two questions a
 * manager opening a profile actually has — what is this person good at, and
 * what needs attention — because neither is visible without something to
 * compare against.
 *
 * THE COMPARISON IS THE DEPARTMENT'S OWN AVERAGES, fetched from the same twin
 * the Departments screen reads, so the two screens can never disagree about
 * what a unit's average is. Where the department has no assessments the panel
 * still works: a strength then means "strongest of this person's own assessed
 * capabilities" and says so, rather than silently comparing against nothing.
 *
 * NOTHING IS SCORED THAT WAS NOT MEASURED. A person with no capability
 * assessment gets no strengths and no gaps — not empty ones — and the panel
 * says which import would produce them.
 */
/** A payload field that should be a list, treated as one whatever arrives. */
function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function Standing({ profile, tenantId }: { profile: Profile; tenantId: string }) {
  const { intelligence, person } = profile;
  const [departmentAverages, setDepartmentAverages] = useState<Record<string, number> | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unit = person.departmentId;
    if (!unit) { setDepartmentAverages(null); return; }

    departmentApi.getTwin(tenantId, String(unit))
      .then((twin: any) => {
        if (cancelled) return;
        const averages: Record<string, number> = {};
        for (const cell of asArray(twin?.capabilityHeatmap)) {
          const level = Number(cell?.averageLevel);
          if (cell?.capabilityId && Number.isFinite(level)) averages[String(cell.capabilityId)] = level;
        }
        setDepartmentAverages(averages);
        setDepartmentName(twin?.department?.name ? String(twin.department.name) : null);
      })
      // A failed peer lookup degrades the panel to "own capabilities only".
      // It must never blank a profile that is otherwise complete.
      .catch(() => { if (!cancelled) setDepartmentAverages(null); });

    return () => { cancelled = true; };
  }, [tenantId, person.departmentId]);

  const scored = intelligence.capabilities
    .map((capability) => {
      const values = Object.values(capability.scores).filter((v): v is number => typeof v === 'number');
      const level = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
      const peer = departmentAverages?.[capability.capabilityId] ?? null;
      return { capability, level, peer, delta: level !== null && peer !== null ? level - peer : null };
    })
    .filter((row) => row.level !== null);

  if (scored.length === 0 && intelligence.signals.length === 0) {
    return null;
  }

  const ranked = [...scored].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  // "Strong" is relative to the unit where there is a unit to be relative to,
  // and relative to this person's own spread where there is not.
  const strengths = ranked.filter((r) => (r.delta !== null ? r.delta >= 0.5 : (r.level ?? 0) >= 3.5)).slice(0, 3);
  const weak = [...ranked].reverse()
    .filter((r) => (r.delta !== null ? r.delta <= -0.5 : (r.level ?? 0) < 2.5))
    .slice(0, 3);

  const gaps = intelligence.capabilities
    .flatMap((c) => c.gaps.map((g) => ({ ...g, capabilityName: c.capabilityName })))
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const openSignals = intelligence.signals.filter(
    (sig) => !['resolved', 'closed', 'dismissed'].includes(String(sig.status ?? '').toLowerCase()),
  );

  const ownAverage = scored.length > 0
    ? scored.reduce((sum, r) => sum + (r.level ?? 0), 0) / scored.length
    : null;
  const peerAverage = scored.filter((r) => r.peer !== null).length > 0
    ? scored.filter((r) => r.peer !== null).reduce((sum, r) => sum + (r.peer as number), 0)
      / scored.filter((r) => r.peer !== null).length
    : null;

  return (
    <Panel title="Where this person stands">
      <div className="pp-standing">
        <div>
          <h4>Strengths</h4>
          {strengths.length === 0 ? (
            <p className="pp-note">
              {scored.length === 0
                ? 'No capability has been assessed for this person, so nothing can be called a strength yet.'
                : 'Nothing assessed stands clearly above the rest.'}
            </p>
          ) : (
            <ul>
              {strengths.map((row) => (
                <li key={row.capability.capabilityId}>
                  <strong>{row.capability.capabilityName}</strong>
                  <small>
                    {(row.level as number).toFixed(1)} of 5
                    {row.delta !== null && ` — ${row.delta.toFixed(1)} above the ${departmentName ?? 'department'} average`}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4>Attention areas</h4>
          {weak.length === 0 && gaps.length === 0 && openSignals.length === 0 ? (
            <p className="pp-note">
              Nothing assessed falls behind, and no unresolved signal names this person.
            </p>
          ) : (
            <ul>
              {weak.map((row) => (
                <li key={row.capability.capabilityId}>
                  <strong>{row.capability.capabilityName}</strong>
                  <small>
                    {(row.level as number).toFixed(1)} of 5
                    {row.delta !== null && ` — ${Math.abs(row.delta).toFixed(1)} below the ${departmentName ?? 'department'} average`}
                  </small>
                </li>
              ))}
              {gaps.map((gap) => (
                <li key={`${gap.capabilityName}-${gap.dimension}`}>
                  <strong>{gap.capabilityName} · {gap.dimension}</strong>
                  <small>
                    At {gap.currentLevel ?? 0} against a target of {gap.targetLevel} — a gap of {gap.gap}.
                  </small>
                </li>
              ))}
              {openSignals.length > 0 && (
                <li>
                  <strong>{openSignals.length} unresolved {openSignals.length === 1 ? 'signal' : 'signals'}</strong>
                  <small>{openSignals.slice(0, 2).map((sig) => sig.title || sig.ruleKey || 'Untitled').join(' · ')}</small>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <h4>Compared with</h4>
          {ownAverage === null ? (
            <p className="pp-note">A comparison needs at least one assessed capability.</p>
          ) : (
            <dl className="pp-compare">
              <div>
                <dt>This person</dt>
                <dd>{ownAverage.toFixed(1)} / 5</dd>
              </div>
              {peerAverage !== null && (
                <div>
                  <dt>{departmentName ?? 'Their department'}</dt>
                  <dd>{peerAverage.toFixed(1)} / 5</dd>
                </div>
              )}
              <div>
                <dt>Assessed capabilities</dt>
                <dd>{scored.length}</dd>
              </div>
            </dl>
          )}
          {/*
            THE SCORE, WITH ITS ARITHMETIC SHOWN.

            The profile score used to appear as a bare number in a tile, which
            is exactly the "unexplained number" this screen is not allowed to
            print. Its own breakdown is published beside it, so listing the
            parts costs nothing and makes the total checkable.
          */}
          {intelligence.score.score !== null && (
            <div className="pp-score-breakdown">
              <h5>Profile score {intelligence.score.score}</h5>
              <ul>
                {Object.entries(intelligence.score.breakdown)
                  .filter(([, value]) => value !== null)
                  .map(([label, value]) => (
                    <li key={label}><span>{label.replace(/[._]/g, ' ')}</span><strong>{value}</strong></li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Highlights({ profile }: { profile: Profile }) {
  const { finance, academic, activity, intelligence, person } = profile;
  const currency = finance?.currency ?? null;
  const tiles: Array<{ label: string; value: string; hint?: string | null }> = [];

  if (finance) {
    tiles.push({
      label: 'Outstanding',
      value: money(finance.outstanding, currency),
      hint: finance.overdue > 0 ? `${money(finance.overdue, currency)} overdue` : 'Nothing overdue',
    });
    if (finance.collectedPct !== null) {
      tiles.push({ label: 'Fees collected', value: `${finance.collectedPct}%`, hint: `${money(finance.paid, currency)} of ${money(finance.net, currency)}` });
    }
    tiles.push({ label: 'Invoices', value: finance.records.toLocaleString(), hint: finance.lastPayment ? `Last paid ${fmtDate(finance.lastPayment.date)}` : 'No payment recorded' });
  }

  if (academic?.attendancePct !== undefined) {
    tiles.push({ label: 'Attendance', value: `${academic.attendancePct}%`, hint: 'As recorded on the latest fee record' });
  }
  if (academic?.examAveragePct !== undefined) {
    tiles.push({ label: 'Term average', value: `${academic.examAveragePct}%`, hint: 'As recorded on the latest fee record' });
  }

  if (!finance && activity.total > 0) {
    tiles.push({ label: 'Records attached', value: activity.total.toLocaleString(), hint: activity.datasets.map((d) => d.label).join(', ') });
  }

  if (intelligence.signalCount > 0) {
    tiles.push({ label: 'Signals', value: String(intelligence.signalCount), hint: `${intelligence.evidenceCount} pieces of evidence` });
  }
  if (intelligence.capabilities.length > 0) {
    tiles.push({ label: 'Capabilities assessed', value: String(intelligence.capabilities.length), hint: intelligence.score.score !== null ? `Profile score ${intelligence.score.score}` : null });
  }
  if (intelligence.decisions.total > 0) {
    tiles.push({ label: 'Decisions', value: String(intelligence.decisions.total), hint: `${intelligence.decisions.approved} approved` });
  }

  if (tiles.length === 0) {
    return (
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Empty
          headline={`Nothing measurable has been recorded for ${person.displayName ?? 'this person'} yet.`}
          explain="Their source record exists, but no imported records reference them and the intelligence loop has produced nothing about them. Importing data that carries their reference is what fills this page."
        />
      </div>
    );
  }

  return (
    <div className="pp-stats">
      {tiles.map((t) => <Stat key={t.label} {...t} />)}
    </div>
  );
}

/* ───────────────────────────── intelligence tab ──────────────────────────── */

const KASBA = [
  { key: 'knowledge', letter: 'K', name: 'Knowledge' },
  { key: 'ability', letter: 'A', name: 'Ability' },
  { key: 'skill', letter: 'S', name: 'Skill' },
  { key: 'behaviour', letter: 'B', name: 'Behaviour' },
  { key: 'attitude', letter: 'A', name: 'Attitude' },
] as const;

function scoreColor(value: number | null): string {
  if (value === null) return 'var(--conf-none)';
  if (value >= 4) return 'var(--conf-verified)';
  if (value >= 3) return 'var(--conf-high)';
  if (value >= 2) return 'var(--conf-med)';
  return 'var(--conf-low)';
}

function IntelligenceTab({ intelligence, personName }: { intelligence: Intelligence; personName: string }) {
  const nothing =
    intelligence.capabilities.length === 0 &&
    intelligence.signalCount === 0 &&
    intelligence.decisions.total === 0 &&
    intelligence.executions.length === 0 &&
    intelligence.learnings === 0;

  if (nothing) {
    return (
      <Panel title="Intelligence">
        <Empty
          headline={`No intelligence has been generated for ${personName} yet.`}
          explain={
            'This section fills as the organizational intelligence loop runs against this person: when a capability is assigned to them and assessed, when a detection rule names them as the subject of a signal, or when they record a decision or run an execution. None of those has happened for this person.'
          }
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel title="Capability profile">
        {intelligence.capabilities.length === 0 ? (
          <Empty
            headline="No capability assessments are available for this person yet."
            explain="A capability has to be assigned to a person and then assessed against the five KASBA dimensions before a profile can be shown."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {intelligence.capabilities.map((c) => (
              <div key={c.capabilityId} style={{ padding: 14, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{c.capabilityName}</strong>
                  <span className="pp-mono" style={{ color: scoreColor(c.scores.overall ?? null) }}>
                    {c.scores.overall !== null && c.scores.overall !== undefined ? `${c.scores.overall} / 5` : 'Not yet assessed'}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
                  {KASBA.map((dim) => {
                    const value = c.scores[dim.key] ?? null;
                    return (
                      <div key={dim.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="pp-mono" style={{ width: 76, color: 'var(--content-secondary)' }}>{dim.name}</span>
                        <span className="eb-bar-track" style={{ flex: 1 }}>
                          <span className="eb-bar-fill" style={{ width: `${((value ?? 0) / 5) * 100}%`, background: scoreColor(value) }} />
                        </span>
                        <span className="pp-mono" style={{ width: 40, textAlign: 'right' }}>
                          {value === null ? 'n/a' : value.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {c.assessedDate && (
                  <div className="pp-timeline-source" style={{ marginTop: 10 }}>Last assessed {fmtDate(c.assessedDate)}</div>
                )}
                {c.gaps.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--feedback-warning-content)' }}>
                    {c.gaps.map((g, i) => (
                      <div key={i}>
                        {g.dimension}: {g.currentLevel === null ? 'not assessed' : g.currentLevel} against a target of {g.targetLevel}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="pp-grid" style={{ marginTop: 'var(--space-4)' }}>
        <Panel title="Signals about this person">
          {intelligence.signals.length === 0 ? (
            <Empty
              headline="No signals name this person."
              explain="A signal names one person only when a detection rule found exactly one affected record. Organization-wide findings are recorded against the organization instead."
            />
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Signal</th><th>Severity</th><th>Status</th><th>Detected</th></tr></thead>
                <tbody>
                  {intelligence.signals.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div>{s.title ?? 'Signal'}</div>
                        {s.classification && <div className="pp-timeline-source">{s.classification}</div>}
                      </td>
                      <td>{s.severity ? <span className={badgeClass(s.severity)}>{s.severity}</span> : '—'}</td>
                      <td>{s.status ?? '—'}</td>
                      <td>{fmtDate(s.createdAt) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {intelligence.evidenceCount > 0 && (
            <p className="pp-note" style={{ margin: '14px 0 0' }}>
              {intelligence.evidenceCount.toLocaleString()} pieces of evidence support these signals.
            </p>
          )}
        </Panel>

        <Panel title="Cases">
          {intelligence.cases.length === 0 ? (
            <Empty
              headline="No cases have been opened from this person’s signals."
              explain="A case is opened when a signal is escalated for investigation."
            />
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Case</th><th>Status</th><th>Opened</th></tr></thead>
                <tbody>
                  {intelligence.cases.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title ?? c.id}</td>
                      <td>{c.status ? <span className={badgeClass(c.status)}>{c.status}</span> : '—'}</td>
                      <td>{fmtDate(c.createdAt) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="pp-grid" style={{ marginTop: 'var(--space-4)' }}>
        <Panel title="Decisions">
          {intelligence.decisions.total === 0 ? (
            <Empty
              headline="This person has not recorded any decisions."
              explain="Decisions are attributed to whoever recorded them in the decision register."
            />
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Rationale</th><th>Status</th><th>Recorded</th></tr></thead>
                <tbody>
                  {intelligence.decisions.items.map((d) => (
                    <tr key={d.id}>
                      <td>{d.rationale ?? '—'}</td>
                      <td>{d.status ? <span className={badgeClass(d.status)}>{d.status}</span> : '—'}</td>
                      <td>{fmtDate(d.createdAt) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Execution history">
          {intelligence.executions.length === 0 ? (
            <Empty
              headline="No executions have been recorded for this person."
              explain="Executions appear here when this person runs an executable standard operation."
            />
          ) : (
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead><tr><th>Operation</th><th>Status</th><th>Completed</th></tr></thead>
                <tbody>
                  {intelligence.executions.map((e) => (
                    <tr key={e.id}>
                      <td className="pp-mono">{e.esoId ?? e.id}</td>
                      <td><span className={badgeClass(e.status)}>{e.status}</span></td>
                      <td>{fmtDate(e.completedDate) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
