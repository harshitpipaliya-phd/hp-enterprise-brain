import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  Activity, AlertTriangle, Bell, BellDot, Blocks, BookOpen, CalendarClock, CheckCircle2,
  Clock, Database, ExternalLink, FileInput, Flag, GitMerge, Hourglass, Inbox, KeyRound,
  Layers, ListChecks, Play, Plug, RefreshCw, RotateCcw, ScrollText, ShieldCheck,
  Trash2, Users, Waypoints, XCircle,
} from 'lucide-react';
import type { View } from '../../App';
import { VIEW_META } from '../../shell/viewMeta';
import { visibleViewsForRole } from '../../shell/roleAccess';
import {
  Button, ConfirmationDialog, DataTable, EmptyState, HeaderActions, PageHeader,
  SearchInput, Select, StatusBadge, Switch, TablePagination, Tabs,
} from '../../ui';
import type { BadgeTone, Column, DataTableProps } from '../../ui';
import { useToast } from '../Toast';
import { ApiError } from '../../api/client';
import { api as rolesApi, getPermissionMatrix } from '../../api/roles';
import { api as intelligenceApi } from '../../api/intelligence';
import { esoApi } from '../../api/eso';
import { policyApi } from '../../api/policy';
import { notificationApi } from '../../api/notification';
import { taskApi } from '../../api/task';
import { api as importsApi } from '../../api/imports';
import { knowledgeLibraryApi } from '../../api/knowledgeLibrary';
import { ingestionApi } from '../../api/ingestion';
import { listEntityMappings } from '../../api/entityMappings';
import { listModules } from '../../api/modules';
import { listFeatureFlags, updateFeatureFlag } from '../../api/featureFlags';
import { api as auditApi } from '../../api/observability';
import { api as eventsApi } from '../../api/events';
import { formatDateTime, formatNumber } from '../workspace/intelligenceShared';
// The section, KPI and score-card vocabulary the Intelligence screens share, so
// these pages read as part of the same product rather than a bolted-on admin.
import '../workspace/IntelligenceSuite.css';
import './PlatformServices.css';

/**
 * PLATFORM SERVICES — the eight cross-cutting services, one screen.
 *
 * Modelled on the Platform Services menu in lms_k12, but built on what this
 * API actually serves rather than on the LMS registry it cannot reach. Each
 * panel reads existing endpoints; where the Brain has no equivalent of an LMS
 * console (a workflow designer, per-channel notification rules) the panel
 * shows the real mechanism this product uses instead of an invented one.
 *
 * One file, not eight: the panels share a loader, a frame and a status
 * vocabulary, and splitting them would restate all three.
 */

type Row = Record<string, any>;
type Tone = 'good' | 'warn' | 'crit' | 'info';

interface PanelProps {
  service: View;
  tenantId: string;
  orgName: string;
  /** Bumped by the header's Refresh button; every loader re-runs on change. */
  refreshKey: number;
  onRefresh: () => void;
  canOpen: (view: View) => boolean;
  onNavigate: (view: View) => void;
}

export interface PlatformServicesProps {
  service: View;
  tenantId: string;
  organizationName: string;
  userRole: string | null;
  onNavigate: (view: View) => void;
}

export default function PlatformServices({ service, tenantId, organizationName, userRole, onNavigate }: PlatformServicesProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const Panel = PANELS[service];
  const visible = visibleViewsForRole(userRole);

  return Panel ? (
    <Panel
      service={service}
      tenantId={tenantId}
      orgName={organizationName}
      refreshKey={refreshKey}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      canOpen={(v) => visible.has(v)}
      onNavigate={onNavigate}
    />
  ) : null;
}

/* ============================================================================
   DATA
   ========================================================================== */

function messageOf(e: unknown): string {
  if (e instanceof ApiError && e.status === 403) {
    const required = (e.responseJson as { required?: string } | null)?.required;
    return required
      ? `Your role does not grant “${required}”, which this list requires.`
      : 'Your role does not have access to this list.';
  }
  return e instanceof Error ? e.message : String(e);
}

/** One request's lifecycle. `deps` re-run it; a stale response is discarded. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>(
    { data: null, loading: true, error: null },
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => { if (live) setState({ data, loading: false, error: null }); },
      (e) => { if (live) setState({ data: null, loading: false, error: messageOf(e) }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

const asRows = (data: unknown): Row[] => (Array.isArray(data) ? data : []);

/** Holds its value until typing pauses, so a filter is one request, not one per key. */
function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

// MySQL sends "2026-09-24 13:47:00" and schedule:list "2026-09-24 13:47:00 +00:00";
// neither parses in every browser until the date/time space becomes a T and the
// space before an offset is dropped.
const when = (value: unknown) => (value ? formatDateTime(String(value).replace(' ', 'T').replace(' ', '')) : '—');
const humanize = (s: unknown) => String(s ?? '').replace(/[_.]/g, ' ').trim();
/** A count, or an em dash while it is unknown — never a zero standing in for "not loaded". */
const n = (value: unknown) => (value == null ? '—' : formatNumber(value));

/* ============================================================================
   FRAME — header, KPI strip, sections
   ========================================================================== */

interface Headline { label: string; value: ReactNode; note: ReactNode }

/** The page chrome every service shares: header with scope chips and a headline card. */
function Frame({
  ctx, meta = [], headline, children,
}: {
  ctx: PanelProps;
  meta?: { label: string; title?: string }[];
  headline?: Headline;
  children: ReactNode;
}) {
  const { label, description, icon: Icon } = VIEW_META[ctx.service];
  return (
    <div className="ps-page">
      <PageHeader
        variant="intelligence"
        icon={<Icon />}
        title={label}
        description={description}
        meta={[{ label: ctx.orgName, title: 'Current organization' }, ...meta]}
        actions={(
          <HeaderActions>
            <button type="button" className="u-btn u-btn-secondary" onClick={ctx.onRefresh}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
          </HeaderActions>
        )}
        aside={headline && (
          <div className="intel-score-card ps-score" data-kind={typeof headline.value === 'string' && headline.value.length > 6 ? 'text' : 'number'}>
            <span className="intel-subtle">{headline.label}</span>
            <strong>{headline.value}</strong>
            <p>{headline.note}</p>
          </div>
        )}
      />
      {children}
    </div>
  );
}

interface Kpi { label: string; value: ReactNode; icon: ReactNode; hint?: string; tone?: Tone }

function Kpis({ label, items }: { label: string; items: Kpi[] }) {
  return (
    <section className="intel-stat-grid ps-kpis" aria-label={label}>
      {items.map((k) => (
        <article key={k.label} className="intel-kpi ps-kpi" data-tone={k.tone}>
          <span className="ps-kpi-icon" aria-hidden="true">{k.icon}</span>
          <div className="ps-kpi-body">
            <span className="intel-kpi-label">{k.label}</span>
            <strong className="intel-kpi-value">{k.value}</strong>
            {k.hint && <small>{k.hint}</small>}
          </div>
        </article>
      ))}
    </section>
  );
}

/** A titled panel: small caps eyebrow, heading, one line on what it holds. */
function Section({
  eyebrow, icon, title, description, actions, children,
}: {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="intel-panel ps-section">
      <div className="intel-section-head">
        <div>
          <span className="intel-eyebrow">{icon}{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="intel-inline-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Opens the screen that owns these records — only for a role that may reach it. */
function OpenLink({ ctx, view, label }: { ctx: PanelProps; view: View; label: string }) {
  return ctx.canOpen(view) ? (
    <Button size="sm" variant="ghost" icon={<ExternalLink size={14} aria-hidden="true" />} onClick={() => ctx.onNavigate(view)}>
      {label}
    </Button>
  ) : null;
}

/**
 * DataTable, a page at a time. The lists here run to hundreds of rows (the event
 * store, the audit log, a tenant's field mappings); one screen-length page and
 * the product's standard pager beats a scroll that buries the section below.
 */
function PagedTable<T>({ rows, ...table }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  // A filter or refresh that shrinks the list must not strand the reader past its end.
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  return (
    <>
      <DataTable<T> {...table} rows={rows.slice((page - 1) * pageSize, page * pageSize)} />
      {!table.loading && !table.error && rows.length > 10 && (
        <TablePagination
          page={Math.min(page, pages)}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}
    </>
  );
}

/** A Section whose body is one table, with the product's standard empty state. */
function TableSection<T>({
  eyebrow, icon, title, description, actions, emptyTitle, emptyText, ...table
}: {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  emptyTitle: string;
  emptyText: string;
} & Omit<DataTableProps<T>, 'empty' | 'caption' | 'compact'>) {
  return (
    <Section eyebrow={eyebrow} icon={icon} title={title} description={description} actions={actions}>
      <PagedTable<T> compact caption={title} empty={<EmptyState title={emptyTitle} description={emptyText} />} {...table} />
    </Section>
  );
}

const GOOD = new Set(['completed', 'approved', 'accepted', 'active', 'success', 'enabled']);
const BAD = new Set(['failed', 'rejected', 'error', 'rolled_back', 'denied']);
const OPEN = new Set(['proposed', 'pending', 'queued', 'processing', 'running', 'previewed', 'completed_with_errors']);

function Status({ value }: { value: unknown }) {
  const s = String(value ?? '').toLowerCase();
  const tone: BadgeTone = GOOD.has(s) ? 'success' : BAD.has(s) ? 'danger' : OPEN.has(s) ? 'warning' : 'neutral';
  return <StatusBadge tone={tone}>{humanize(s) || 'unknown'}</StatusBadge>;
}

function YesNo({ value, yes = 'Yes', no = 'No' }: { value: unknown; yes?: string; no?: string }) {
  const on = value === true || value === 1 || value === '1';
  return <StatusBadge tone={on ? 'success' : 'neutral'} icon={on}>{on ? yes : no}</StatusBadge>;
}

function Stacked({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="ps-stacked">
      <strong>{primary}</strong>
      {secondary && <span>{secondary}</span>}
    </div>
  );
}

const Code = ({ children }: { children: ReactNode }) => <code className="ps-code">{children}</code>;

/* ============================================================================
   RBAC — the enforced role matrix, and the descriptive role catalogue
   ========================================================================== */

function RbacPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const matrix = useLoad(() => getPermissionMatrix(tenantId), [tenantId, refreshKey]);
  const catalogue = useLoad(() => rolesApi.listRoles(tenantId), [tenantId, refreshKey]);
  const roles = matrix.data?.roles ?? [];
  const permissions = matrix.data?.permissions ?? [];
  const governance = permissions.filter((p) => p.includes('.'));

  const matrixColumns: Column<string>[] = [
    { key: 'permission', header: 'Permission', render: (p) => <Code>{p}</Code> },
    ...roles.map((r): Column<string> => ({
      key: r.key,
      header: humanize(r.key),
      render: (p) => (r.permissions.includes(p)
        ? <StatusBadge tone="success">Granted</StatusBadge>
        : <span className="ps-none">—<span className="u-sr-only">Not granted</span></span>),
    })),
  ];

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Enforced on every request', title: 'Read from the API’s own role definitions' }]}
      headline={{
        label: 'Access roles enforced',
        value: n(matrix.data ? roles.length : null),
        note: matrix.data
          ? `${permissions.length} permissions, ${governance.length} of them governance acts beyond ordinary reads and writes.`
          : 'Loading the roles the API checks each request against.',
      }}
    >
      <Kpis label="Access summary" items={[
        { label: 'Access roles', value: n(matrix.data ? roles.length : null), icon: <KeyRound />, tone: 'info' },
        { label: 'Permissions', value: n(matrix.data ? permissions.length : null), icon: <ShieldCheck />, tone: 'good' },
        { label: 'Governance acts', value: n(matrix.data ? governance.length : null), icon: <Layers />, hint: 'Approve, execute, manage', tone: 'warn' },
        { label: 'Catalogued roles', value: n(catalogue.data?.length), icon: <Users />, hint: 'Organizational roles on record' },
      ]} />
      <TableSection<string>
        eyebrow="Enforced access"
        icon={<ShieldCheck size={14} />}
        title="Who may do what"
        description="Each request is checked against the role on the signed-in user’s token. This matrix is read from the API itself, so it is exactly what is enforced."
        columns={matrixColumns}
        rows={permissions}
        rowKey={(p) => p}
        loading={matrix.loading}
        error={matrix.error}
        onRetry={matrix.reload}
        emptyTitle="No permissions reported"
        emptyText="The API returned no permission definitions."
      />
      <TableSection<Row>
        eyebrow="Role catalogue"
        icon={<Users size={14} />}
        title="Organizational roles"
        description="Job and organizational roles recorded for this organization. Descriptive only — access is decided by the matrix above."
        columns={[
          { key: 'name', header: 'Role', render: (r) => <Stacked primary={r.name} secondary={r.description} /> },
          { key: 'code', header: 'Key', render: (r) => <Code>{r.code}</Code> },
          { key: 'category', header: 'Category', render: (r) => humanize(r.category) || '—', secondary: true },
          { key: 'permissions', header: 'Permissions', render: (r) => String(r.permissions.length), align: 'right' },
          { key: 'system', header: 'Type', render: (r) => (r.isSystem ? 'System' : 'Custom'), secondary: true },
          { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
        ]}
        rows={catalogue.data ?? []}
        rowKey={(r) => r.id}
        loading={catalogue.loading}
        error={catalogue.error}
        onRetry={catalogue.reload}
        emptyTitle="No roles catalogued yet"
        emptyText="Organizational roles appear here once they are recorded for this organization."
      />
    </Frame>
  );
}

/* ============================================================================
   WORKFLOW — decision approval, then execution, under policy
   ========================================================================== */

function WorkflowPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const decisions = useLoad(async () => asRows(await intelligenceApi.listDecisions(tenantId)), [tenantId, refreshKey]);
  const executions = useLoad(async () => asRows(await esoApi.listAll(tenantId)), [tenantId, refreshKey]);
  const policies = useLoad(async () => asRows(await policyApi.list(tenantId)), [tenantId, refreshKey]);

  const count = (rows: Row[] | null, ...statuses: string[]) =>
    rows ? rows.filter((r) => statuses.includes(String(r.status))).length : null;
  const waiting = count(decisions.data, 'proposed');

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Decision → Execution → Outcome' }]}
      headline={{
        label: 'Awaiting approval',
        value: n(waiting),
        note: waiting == null ? 'Loading the approval queue.'
          : waiting === 0 ? 'No decision is waiting on a governance approval.'
            : 'Each needs someone holding decision.approve — and not its author.',
      }}
    >
      <Kpis label="Workflow summary" items={[
        { label: 'Awaiting approval', value: n(waiting), icon: <Hourglass />, tone: waiting ? 'warn' : 'good' },
        { label: 'Approved', value: n(count(decisions.data, 'approved', 'accepted')), icon: <CheckCircle2 />, tone: 'good' },
        { label: 'Executions in flight', value: n(count(executions.data, 'queued', 'running')), icon: <Play />, tone: 'info' },
        { label: 'Active policies', value: n(count(policies.data, 'active')), icon: <ShieldCheck />, hint: 'Rules execution must respect' },
      ]} />
      <TableSection<Row>
        eyebrow="Approval gate"
        icon={<Hourglass size={14} />}
        title="Decisions awaiting approval"
        description="Proposed decisions stop here until an approver signs them off."
        actions={<OpenLink ctx={ctx} view="deliberation" label="Review in Deliberation" />}
        columns={[
          { key: 'rationale', header: 'Decision', render: (r) => String(r.rationale ?? '') },
          { key: 'executor', header: 'Executor', render: (r) => humanize(r.executor_type) || '—', secondary: true },
          { key: 'confidence', header: 'Confidence', align: 'right', render: (r) => (r.confidence == null ? '—' : `${Math.round(Number(r.confidence) * 100)}%`) },
          { key: 'created', header: 'Proposed', render: (r) => when(r.created_date) },
        ]}
        rows={(decisions.data ?? []).filter((r) => r.status === 'proposed')}
        rowKey={(r) => String(r.id)}
        loading={decisions.loading}
        error={decisions.error}
        onRetry={decisions.reload}
        emptyTitle="Nothing waiting for approval"
        emptyText="Proposed decisions appear here until someone approves or rejects them."
      />
      <div className="ps-split">
        <TableSection<Row>
          eyebrow="Execution"
          icon={<Play size={14} />}
          title="Recent executions"
          actions={<OpenLink ctx={ctx} view="executions" label="Execution Center" />}
          columns={[
            { key: 'eso', header: 'ESO', render: (r) => <Code>{String(r.eso_id ?? '—')}</Code> },
            { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
            { key: 'started', header: 'Started', render: (r) => when(r.started_date ?? r.created_date) },
          ]}
          rows={(executions.data ?? []).slice(0, 10)}
          rowKey={(r) => String(r.id)}
          loading={executions.loading}
          error={executions.error}
          onRetry={executions.reload}
          emptyTitle="No executions yet"
          emptyText="An approved decision becomes an execution once someone runs its ESO."
        />
        <TableSection<Row>
          eyebrow="Governance"
          icon={<ShieldCheck size={14} />}
          title="Policies"
          actions={<OpenLink ctx={ctx} view="policies" label="Manage policies" />}
          columns={[
            { key: 'name', header: 'Policy', render: (r) => <Stacked primary={r.name} secondary={humanize(r.policy_type)} /> },
            { key: 'rules', header: 'Rules', align: 'right', render: (r) => String(asRows(r.rules).length) },
            { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
          ]}
          rows={policies.data ?? []}
          rowKey={(r) => String(r.id)}
          loading={policies.loading}
          error={policies.error}
          onRetry={policies.reload}
          emptyTitle="No policies yet"
          emptyText="Policies constrain which executor may act, and when."
        />
      </div>
    </Frame>
  );
}

/* ============================================================================
   NOTIFICATION — the signed-in user's inbox
   ========================================================================== */

function NotificationPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const { showToast } = useToast();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  // Always the full list: the counts above must not change when the tab does.
  const list = useLoad(async () => asRows(await notificationApi.list(tenantId)), [tenantId, refreshKey]);
  const all = list.data ?? [];
  const unread = all.filter((r) => !r.read_date);
  const rows = tab === 'unread' ? unread : all;
  const types = new Set(all.map((r) => r.type)).size;

  const act = async (work: Promise<unknown>, done: string) => {
    try { await work; showToast('success', done); list.reload(); } catch (e) { showToast('error', messageOf(e)); }
  };

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Your inbox', title: 'Notifications addressed to you in this organization' }]}
      headline={{
        label: 'Unread',
        value: n(list.data ? unread.length : null),
        note: !list.data ? 'Loading your notifications.'
          : unread.length === 0 ? 'You are all caught up.' : 'Waiting for you in this organization.',
      }}
    >
      <Kpis label="Notification summary" items={[
        { label: 'Received', value: n(list.data ? all.length : null), icon: <Inbox />, hint: 'Newest 200 kept' },
        { label: 'Unread', value: n(list.data ? unread.length : null), icon: <BellDot />, tone: unread.length ? 'warn' : 'good' },
        { label: 'Read', value: n(list.data ? all.length - unread.length : null), icon: <CheckCircle2 />, tone: 'good' },
        { label: 'Kinds', value: n(list.data ? types : null), icon: <Bell />, hint: 'Distinct notification types' },
      ]} />
      <TableSection<Row>
        eyebrow="Inbox"
        icon={<Bell size={14} />}
        title="Notifications"
        description="What the Brain has told you about this organization, newest first."
        actions={(
          <>
            <Tabs tabs={[{ id: 'all', label: 'All' }, { id: 'unread', label: `Unread (${unread.length})` }]} value={tab} onChange={setTab} />
            <Button size="sm" disabled={unread.length === 0} onClick={() => act(notificationApi.markAllRead(tenantId), 'All notifications marked read')}>
              Mark all read
            </Button>
          </>
        )}
        columns={[
          { key: 'title', header: 'Notification', render: (r) => <Stacked primary={r.title} secondary={r.body} /> },
          { key: 'type', header: 'Type', render: (r) => humanize(r.type), secondary: true },
          { key: 'received', header: 'Received', render: (r) => when(r.created_date) },
          {
            key: 'state', header: 'Status', render: (r) => (r.read_date
              ? <StatusBadge icon={false}>Read</StatusBadge>
              : <StatusBadge tone="info">Unread</StatusBadge>),
          },
          {
            key: 'action', header: 'Action', align: 'right', render: (r) => (r.read_date ? null : (
              <Button size="sm" variant="ghost" onClick={() => act(notificationApi.markRead(tenantId, String(r.id)), 'Marked read')}>
                Mark read
              </Button>
            )),
          },
        ]}
        rows={rows}
        rowKey={(r) => String(r.id)}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle={tab === 'unread' ? 'You are all caught up' : 'No notifications yet'}
        emptyText={tab === 'unread' ? 'Every notification here has been read.' : 'Nothing has been sent to you in this organization.'}
      />
    </Frame>
  );
}

/* ============================================================================
   SCHEDULER — the cron schedule, and tasks that can be run now
   ========================================================================== */

/** Plain words for the shapes routes/console.php uses; anything else stays as cron. */
function describeCron(expr: string, tz: string): string {
  const [min, hour, dom, mon, dow] = expr.split(' ');
  const pad = (v: string) => v.padStart(2, '0');
  if ([dom, mon, dow].every((f) => f === '*')) {
    if (min === '*' && hour === '*') return 'Every minute';
    if (/^\d+$/.test(min) && hour === '*') return `Hourly at :${pad(min)}`;
    if (/^\d+$/.test(min) && /^\d+$/.test(hour)) return `Daily at ${pad(hour)}:${pad(min)} ${tz}`;
  }
  return expr;
}

const jobName = (command: unknown) => String(command ?? '').replace(/^.*artisan\s+/, '');

function SchedulerPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const { showToast } = useToast();
  const schedule = useLoad(async () => asRows(await taskApi.schedule()), [refreshKey]);
  const registry = useLoad(async () => asRows(await taskApi.listRegistry()), [refreshKey]);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { status: string; error?: string }>>({});

  const jobs = schedule.data ?? [];
  // schedule:list sorts by next due date, so the first row is the next to fire.
  const next = jobs[0];
  const busy = jobs.filter((j) => j.has_mutex).length;

  const run = async (taskName: string) => {
    setRunning(taskName);
    try {
      const res = await taskApi.runSequence(tenantId, [{ taskName }], true);
      const step = res?.steps?.[0] ?? { status: 'failed', error: 'No result returned' };
      setResults((r) => ({ ...r, [taskName]: step }));
      showToast(step.status === 'completed' ? 'success' : 'error', `${taskName}: ${step.status}`);
    } catch (e) {
      showToast('error', messageOf(e));
    } finally {
      setRunning(null);
    }
  };

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Runs via php artisan schedule:run', title: 'Needs a host cron or Task Scheduler entry every minute' }]}
      headline={{
        label: 'Next to run',
        value: next ? jobName(next.command) : schedule.loading ? '—' : 'Nothing scheduled',
        note: next ? `${next.next_due_date_human} · ${describeCron(String(next.expression), next.timezone)}` : 'No recurring job is declared.',
      }}
    >
      <Kpis label="Scheduler summary" items={[
        { label: 'Recurring jobs', value: n(schedule.data ? jobs.length : null), icon: <CalendarClock />, tone: 'info' },
        { label: 'Running now', value: n(schedule.data ? busy : null), icon: <Activity />, tone: busy ? 'warn' : 'good', hint: 'Holding an overlap lock' },
        { label: 'On-demand tasks', value: n(registry.data?.length), icon: <ListChecks />, hint: 'Runnable from here' },
        { label: 'Write data', value: n(registry.data ? registry.data.filter((t) => t.mutates).length : null), icon: <Database />, hint: 'Of the on-demand tasks' },
      ]} />
      <TableSection<Row>
        eyebrow="Cron"
        icon={<Clock size={14} />}
        title="Recurring jobs"
        description={<>Declared in <Code>routes/console.php</Code>. They fire only while the server runs <Code>php artisan schedule:run</Code> every minute.</>}
        columns={[
          { key: 'command', header: 'Job', render: (r) => <Code>{jobName(r.command)}</Code> },
          { key: 'when', header: 'Schedule', render: (r) => <Stacked primary={describeCron(String(r.expression), r.timezone)} secondary={<Code>{r.expression}</Code>} /> },
          { key: 'next', header: 'Next run', render: (r) => <Stacked primary={r.next_due_date_human} secondary={when(r.next_due_date)} /> },
          { key: 'state', header: 'Status', render: (r) => (r.has_mutex ? <StatusBadge tone="info">Running</StatusBadge> : <StatusBadge icon={false}>Idle</StatusBadge>) },
        ]}
        rows={jobs}
        rowKey={(r) => `${r.command}|${r.expression}`}
        loading={schedule.loading}
        error={schedule.error}
        onRetry={schedule.reload}
        emptyTitle="No recurring jobs"
        emptyText="Nothing is declared in the schedule."
      />
      <TableSection<Row>
        eyebrow="On demand"
        icon={<Play size={14} />}
        title="Tasks you can run now"
        description="Deterministic tasks over existing services. Run one here, or chain several in the Task Orchestrator."
        actions={<OpenLink ctx={ctx} view="tasks" label="Task Orchestrator" />}
        columns={[
          { key: 'name', header: 'Task', render: (r) => <Stacked primary={r.name} secondary={r.description} /> },
          { key: 'category', header: 'Category', render: (r) => humanize(r.category), secondary: true },
          { key: 'mutates', header: 'Writes data', render: (r) => <YesNo value={r.mutates} /> },
          {
            key: 'last', header: 'Last run here', render: (r) => {
              const res = results[r.name];
              return res ? <span title={res.error}><Status value={res.status} /></span> : <span className="ps-none">—</span>;
            },
          },
          {
            key: 'run', header: 'Action', align: 'right', render: (r) => (
              <Button size="sm" icon={<Play size={14} aria-hidden="true" />} loading={running === r.name} disabled={!!running && running !== r.name} onClick={() => run(r.name)}>
                Run now
              </Button>
            ),
          },
        ]}
        rows={registry.data ?? []}
        rowKey={(r) => r.name}
        loading={registry.loading}
        error={registry.error}
        onRetry={registry.reload}
        emptyTitle="No tasks registered"
        emptyText="The API declares no on-demand tasks."
      />
    </Frame>
  );
}

/* ============================================================================
   DOCUMENT — what came in, and the knowledge it became
   ========================================================================== */

function DocumentPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const summary = useLoad(() => knowledgeLibraryApi.summary(tenantId), [tenantId, refreshKey]);
  const jobs = useLoad(() => importsApi.listJobs(tenantId), [tenantId, refreshKey]);
  const s = summary.data;
  const list = jobs.data ?? [];
  const failed = list.filter((j) => ['failed', 'completed_with_errors'].includes(j.status)).length;

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Files → Records → Knowledge' }]}
      headline={{
        label: 'Knowledge assets',
        value: n(s?.total),
        note: s ? `${formatNumber(s.withEvidence)} backed by evidence · ${formatNumber(s.stale)} stale.` : 'Loading the knowledge library.',
      }}
    >
      <Kpis label="Document summary" items={[
        { label: 'Files imported', value: n(jobs.data ? list.length : null), icon: <FileInput />, tone: 'info' },
        { label: 'Import problems', value: n(jobs.data ? failed : null), icon: <AlertTriangle />, tone: failed ? 'crit' : 'good', hint: 'Failed or with row errors' },
        { label: 'Recently added', value: n(s?.recentlyAdded), icon: <BookOpen />, hint: 'Knowledge assets' },
        { label: 'Stale', value: n(s?.stale), icon: <Hourglass />, tone: s?.stale ? 'warn' : 'good', hint: 'Past their freshness horizon' },
      ]} />
      <TableSection<Row>
        eyebrow="Intake"
        icon={<FileInput size={14} />}
        title="Imported files"
        description="Every file brought into this organization, and how many of its rows made it in."
        actions={(
          <>
            <OpenLink ctx={ctx} view="knowledgelibrary" label="Knowledge Library" />
            <OpenLink ctx={ctx} view="ingestion" label="Upload a file" />
          </>
        )}
        columns={[
          {
            key: 'source', header: 'Source', render: (r) => (
              <Stacked primary={String(r.sourceRef ?? '').split(/[\\/]/).pop() || humanize(r.importType) || 'Import'} secondary={humanize(r.importType)} />
            ),
          },
          { key: 'entity', header: 'Entity', render: (r) => humanize(r.entityType) || '—' },
          { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
          { key: 'rows', header: 'Rows imported', align: 'right', render: (r) => `${formatNumber(r.successCount)} / ${formatNumber(r.totalRows)}` },
          { key: 'errors', header: 'Errors', align: 'right', render: (r) => formatNumber(r.errorCount), secondary: true },
          { key: 'created', header: 'Started', render: (r) => when(r.createdDate) },
        ]}
        rows={list}
        rowKey={(r) => r.id}
        loading={jobs.loading}
        error={jobs.error}
        onRetry={jobs.reload}
        emptyTitle="No files imported yet"
        emptyText="Upload a spreadsheet or ERP export from Ingestion and it will appear here."
      />
    </Frame>
  );
}

/* ============================================================================
   INTEGRATION — source systems, field mappings, modules, feature flags
   ========================================================================== */

function IntegrationPanel(ctx: PanelProps) {
  const { tenantId, refreshKey } = ctx;
  const { showToast } = useToast();
  const sources = useLoad(async () => asRows(await ingestionApi.listSources(tenantId)), [tenantId, refreshKey]);
  const mappings = useLoad(async () => asRows(await listEntityMappings(tenantId)), [tenantId, refreshKey]);
  const modules = useLoad(async () => asRows(await listModules(tenantId)), [tenantId, refreshKey]);
  const flags = useLoad(async () => asRows(await listFeatureFlags(tenantId)), [tenantId, refreshKey]);
  const [saving, setSaving] = useState<string | null>(null);

  const on = (v: unknown) => !!Number(v);
  const systems = new Set((mappings.data ?? []).map((m) => m.source_system)).size;

  const toggleFlag = async (flag: Row, enabled: boolean) => {
    setSaving(String(flag.id));
    try {
      await updateFeatureFlag(tenantId, String(flag.id), { enabled });
      showToast('success', `${flag.flag_name || flag.flag_key} ${enabled ? 'enabled' : 'disabled'}`);
      flags.reload();
    } catch (e) {
      showToast('error', messageOf(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Source systems → Universal model' }]}
      headline={{
        label: 'Connected systems',
        value: n(mappings.data ? systems : null),
        note: mappings.data ? `${formatNumber(mappings.data.filter((m) => on(m.is_active)).length)} active field mappings into the universal model.` : 'Loading field mappings.',
      }}
    >
      <Kpis label="Integration summary" items={[
        { label: 'Data sources', value: n(sources.data?.length), icon: <Plug />, tone: 'info' },
        { label: 'Field mappings', value: n(mappings.data?.length), icon: <GitMerge />, hint: `${systems} source systems` },
        { label: 'Modules enabled', value: modules.data ? `${modules.data.filter((m) => on(m.is_enabled)).length} / ${modules.data.length}` : '—', icon: <Blocks />, tone: 'good' },
        { label: 'Flags on', value: flags.data ? `${flags.data.filter((f) => on(f.enabled)).length} / ${flags.data.length}` : '—', icon: <Flag />, tone: 'warn' },
      ]} />
      <TableSection<Row>
        eyebrow="Inbound"
        icon={<Plug size={14} />}
        title="Data sources"
        description="Where this organization’s records come from."
        actions={<OpenLink ctx={ctx} view="ingestion" label="Ingestion" />}
        columns={[
          { key: 'name', header: 'Source', render: (r) => <Stacked primary={r.display_name} secondary={<Code>{r.source_key}</Code>} /> },
          { key: 'type', header: 'Type', render: (r) => humanize(r.source_type) },
          { key: 'entity', header: 'Maps to', render: (r) => humanize(r.universal_entity) || '—', secondary: true },
          { key: 'synced', header: 'Last synced', render: (r) => when(r.last_synced_at) },
        ]}
        rows={sources.data ?? []}
        rowKey={(r) => String(r.id ?? r.source_key)}
        loading={sources.loading}
        error={sources.error}
        onRetry={sources.reload}
        emptyTitle="No data sources yet"
        emptyText="A source is registered the first time a file is uploaded through Ingestion."
      />
      <TableSection<Row>
        eyebrow="Mapping"
        icon={<GitMerge size={14} />}
        title="Field mappings"
        description="How each source system’s fields land in the universal model."
        columns={[
          { key: 'source', header: 'Source field', render: (r) => <Stacked primary={`${r.source_entity}.${r.source_field}`} secondary={r.source_system} /> },
          { key: 'target', header: 'Maps to', render: (r) => <Code>{`${r.universal_entity}.${r.universal_field}`}</Code> },
          { key: 'type', header: 'Mapping', render: (r) => humanize(r.mapping_type), secondary: true },
          { key: 'active', header: 'Active', render: (r) => <YesNo value={r.is_active} /> },
        ]}
        rows={mappings.data ?? []}
        rowKey={(r) => String(r.id)}
        loading={mappings.loading}
        error={mappings.error}
        onRetry={mappings.reload}
        emptyTitle="No field mappings"
        emptyText="No source field is mapped to the universal model yet."
      />
      <div className="ps-split">
        <TableSection<Row>
          eyebrow="Capabilities"
          icon={<Blocks size={14} />}
          title="Modules"
          columns={[
            { key: 'name', header: 'Module', render: (r) => <Stacked primary={r.name} secondary={r.version ? `v${r.version}` : r.module_key} /> },
            { key: 'core', header: 'Core', render: (r) => <YesNo value={r.is_core} /> },
            { key: 'enabled', header: 'Enabled', render: (r) => <YesNo value={r.is_enabled} yes="Enabled" no="Disabled" /> },
          ]}
          rows={modules.data ?? []}
          rowKey={(r) => String(r.id)}
          loading={modules.loading}
          error={modules.error}
          onRetry={modules.reload}
          emptyTitle="No modules registered"
          emptyText="Modules appear here once they are registered for this organization."
        />
        <TableSection<Row>
          eyebrow="Rollout"
          icon={<Flag size={14} />}
          title="Feature flags"
          columns={[
            { key: 'name', header: 'Flag', render: (r) => <Stacked primary={r.flag_name || r.flag_key} secondary={`${humanize(r.level)} · ${r.rollout_percentage ?? 100}% rollout`} /> },
            {
              key: 'enabled', header: 'Enabled', align: 'right', render: (r) => (
                <Switch
                  label={on(r.enabled) ? 'On' : 'Off'}
                  checked={on(r.enabled)}
                  disabled={saving === String(r.id)}
                  onCheckedChange={(v) => toggleFlag(r, v)}
                />
              ),
            },
          ]}
          rows={flags.data ?? []}
          rowKey={(r) => String(r.id)}
          loading={flags.loading}
          error={flags.error}
          onRetry={flags.reload}
          emptyTitle="No feature flags"
          emptyText="No feature flag is defined for this organization."
        />
      </div>
    </Frame>
  );
}

/* ============================================================================
   AUDIT — the append-only change log
   ========================================================================== */

function AuditPanel(ctx: PanelProps) {
  const { refreshKey } = ctx;
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const query = useDebounced(q);
  const stats = useLoad(() => auditApi.getAuditStats(), [refreshKey]);
  const logs = useLoad(async () => {
    const params: Record<string, string> = { limit: '200' };
    if (query) params.q = query;
    if (action) params.action = action;
    if (entityType) params.entityType = entityType;
    return asRows(await auditApi.getAuditLogs(params));
  }, [refreshKey, query, action, entityType]);

  const byAction = asRows(stats.data?.byAction);
  const byEntity = asRows(stats.data?.byEntity);
  const top = [...byAction].sort((a, b) => Number(b.count) - Number(a.count))[0];
  const denied = byAction.filter((a) => String(a.action).endsWith('.denied')).reduce((t, a) => t + Number(a.count), 0);

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Append-only', title: 'Audit records are never edited or deleted' }]}
      headline={{
        label: 'Records kept',
        value: n(stats.data?.total),
        note: top ? `Most frequent: ${humanize(top.action)} (${formatNumber(top.count)}).` : 'Nothing has been recorded yet.',
      }}
    >
      <Kpis label="Audit summary" items={[
        { label: 'Records', value: n(stats.data?.total), icon: <ScrollText />, tone: 'info' },
        { label: 'Distinct actions', value: n(stats.data ? byAction.length : null), icon: <Activity /> },
        { label: 'Entity types', value: n(stats.data ? byEntity.length : null), icon: <Layers /> },
        { label: 'Access denied', value: n(stats.data ? denied : null), icon: <XCircle />, tone: denied ? 'crit' : 'good', hint: 'Requests refused by role' },
      ]} />
      <Section
        eyebrow="Change log"
        icon={<ScrollText size={14} />}
        title="Audit trail"
        description={`Who changed what, and when — newest first${logs.data ? `, ${formatNumber(logs.data.length)} shown` : ''}.`}
      >
        <div className="ps-filters">
          <div className="ps-filters-grow">
            <SearchInput value={q} onValueChange={setQ} placeholder="Search entity, actor or action…" aria-label="Search the audit log" />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
            <option value="">All actions</option>
            {byAction.map((a) => <option key={a.action} value={a.action}>{humanize(a.action)} ({a.count})</option>)}
          </Select>
          <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Filter by entity type">
            <option value="">All entity types</option>
            {byEntity.map((e) => <option key={e.entity_type} value={e.entity_type}>{e.entity_type} ({e.count})</option>)}
          </Select>
        </div>
        <PagedTable<Row>
          compact
          caption="Audit trail"
          columns={[
            { key: 'when', header: 'When', render: (r) => when(r.created_at) },
            { key: 'action', header: 'Action', render: (r) => <Code>{r.action}</Code> },
            { key: 'entity', header: 'Entity', render: (r) => <Stacked primary={r.entity_type} secondary={r.entity_id} /> },
            { key: 'actor', header: 'Actor', render: (r) => String(r.actor_name || r.actor_id || 'System') },
            { key: 'source', header: 'Source', render: (r) => humanize(r.source) || '—', secondary: true },
            { key: 'status', header: 'Result', render: (r) => <Status value={r.status} /> },
          ]}
          rows={logs.data ?? []}
          rowKey={(r) => String(r.id)}
          loading={logs.loading}
          error={logs.error}
          onRetry={logs.reload}
          empty={<EmptyState title="No matching records" description="No audit record matches these filters." />}
        />
      </Section>
    </Frame>
  );
}

/* ============================================================================
   EVENT BUS — the event store, its dead letters, and its consumers
   ========================================================================== */

type BusTab = 'events' | 'dlq' | 'consumers';

function EventBusPanel(ctx: PanelProps) {
  const { refreshKey } = ctx;
  const { showToast } = useToast();
  const [tab, setTab] = useState<BusTab>('events');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [discard, setDiscard] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const eventType = useDebounced(type);

  const stats = useLoad(() => eventsApi.getStats(), [refreshKey]);
  const events = useLoad(async () => {
    const params: Record<string, string> = { limit: '200' };
    if (status) params.status = status;
    if (eventType) params.type = eventType;
    return asRows(await eventsApi.listEvents(params));
  }, [refreshKey, status, eventType]);
  const dlq = useLoad(async () => asRows(await eventsApi.getDLQ()), [refreshKey]);
  const consumers = useLoad(async () => asRows(await eventsApi.getConsumers()), [refreshKey]);

  const act = async (work: () => Promise<unknown>, done: string, after: () => void) => {
    setBusy(true);
    try { await work(); showToast('success', done); after(); stats.reload(); } catch (e) { showToast('error', messageOf(e)); } finally { setBusy(false); }
  };

  const s = stats.data;
  const failed = Number(s?.failed ?? 0);
  const dead = Number(s?.deadLetterCount ?? 0);
  const settled = s && s.total ? Math.round((Number(s.completed) / Number(s.total)) * 100) : null;

  return (
    <Frame
      ctx={ctx}
      meta={[{ label: 'Outbox → Consumers', title: 'Drained every minute by brain:process-events' }]}
      headline={{
        label: 'Delivered',
        value: settled == null ? '—' : `${settled}%`,
        note: !s ? 'Loading the event backbone.'
          : !s.total ? 'No event has been published yet.'
            : `${formatNumber(s.completed)} of ${formatNumber(s.total)} events settled by every consumer.`,
      }}
    >
      <Kpis label="Event bus summary" items={[
        { label: 'Pending', value: n(s?.pending), icon: <Hourglass />, tone: 'warn', hint: s ? `${formatNumber(s.processing)} processing` : undefined },
        { label: 'Completed', value: n(s?.completed), icon: <CheckCircle2 />, tone: 'good' },
        { label: 'Failed', value: n(s?.failed), icon: <XCircle />, tone: failed ? 'crit' : 'good' },
        { label: 'Dead letters', value: n(s?.deadLetterCount), icon: <AlertTriangle />, tone: dead ? 'crit' : 'good', hint: 'Out of retries' },
      ]} />
      <Section
        eyebrow="Backbone"
        icon={<Waypoints size={14} />}
        title={tab === 'events' ? 'Event stream' : tab === 'dlq' ? 'Dead letters' : 'Consumers'}
        description={tab === 'events' ? 'Every event published, newest first. Replay re-queues a copy for every consumer.'
          : tab === 'dlq' ? 'Events a consumer gave up on after its last retry.'
            : 'The workers that drain the outbox, and how far each has read.'}
        actions={(
          <>
            <Tabs<BusTab>
              tabs={[
                { id: 'events', label: 'Event stream' },
                { id: 'dlq', label: `Dead letters${dlq.data ? ` (${dlq.data.length})` : ''}` },
                { id: 'consumers', label: 'Consumers' },
              ]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'events' && (
              <Button size="sm" icon={<RotateCcw size={14} aria-hidden="true" />} disabled={failed === 0 || busy}
                onClick={() => act(eventsApi.retryFailed, 'Failed events re-queued', events.reload)}>
                Retry failed
              </Button>
            )}
          </>
        )}
      >
        {tab === 'events' && (
          <>
            <div className="ps-filters">
              <div className="ps-filters-grow">
                <SearchInput value={type} onValueChange={setType} placeholder="Event type, e.g. DecisionReached" aria-label="Filter by event type" />
              </div>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                {['pending', 'processing', 'completed', 'failed'].map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
              </Select>
            </div>
            <PagedTable<Row>
              compact
              caption="Event stream"
              columns={[
                { key: 'type', header: 'Event', render: (r) => <Code>{r.type}</Code> },
                { key: 'entity', header: 'Entity', render: (r) => <Stacked primary={r.entity_type || '—'} secondary={r.entity_id} /> },
                { key: 'status', header: 'Status', render: (r) => <span title={r.failure_reason ?? undefined}><Status value={r.status} /></span> },
                { key: 'retries', header: 'Retries', align: 'right', render: (r) => String(r.retry_count ?? 0), secondary: true },
                { key: 'created', header: 'Published', render: (r) => when(r.created_at) },
                {
                  key: 'replay', header: 'Action', align: 'right', render: (r) => (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => eventsApi.replayEvent(String(r.id)), `Replay of ${r.type} queued`, events.reload)}>
                      Replay
                    </Button>
                  ),
                },
              ]}
              rows={events.data ?? []}
              rowKey={(r) => String(r.id)}
              loading={events.loading}
              error={events.error}
              onRetry={events.reload}
              empty={<EmptyState title="No events" description={status || eventType ? 'No event matches these filters.' : 'Nothing has been published on the backbone yet.'} />}
            />
          </>
        )}

        {tab === 'dlq' && (
          <PagedTable<Row>
            compact
            caption="Dead letters"
            columns={[
              { key: 'type', header: 'Event', render: (r) => <Stacked primary={<Code>{r.event_type}</Code>} secondary={r.consumer_name} /> },
              { key: 'error', header: 'Error', render: (r) => String(r.error_message ?? '') },
              { key: 'retries', header: 'Attempts', align: 'right', render: (r) => `${r.retry_count}/${r.max_retries}` },
              { key: 'created', header: 'Failed', render: (r) => when(r.created_at), secondary: true },
              {
                key: 'actions', header: 'Action', align: 'right', render: (r) => (
                  <div className="ps-row-actions">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => eventsApi.retryDLQ(String(r.id)), 'Dead letter re-queued', dlq.reload)}>
                      Retry
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={14} aria-hidden="true" />} disabled={busy} onClick={() => setDiscard(r)}>
                      Discard
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={dlq.data ?? []}
            rowKey={(r) => String(r.id)}
            loading={dlq.loading}
            error={dlq.error}
            onRetry={dlq.reload}
            empty={<EmptyState title="No dead letters" description="No event has exhausted its retries." />}
          />
        )}

        {tab === 'consumers' && (
          <PagedTable<Row>
            compact
            caption="Consumers"
            columns={[
              { key: 'name', header: 'Consumer', render: (r) => <Code>{r.consumer_name}</Code> },
              { key: 'status', header: 'Status', render: (r) => <Status value={r.status} /> },
              { key: 'last', header: 'Last processed', render: (r) => when(r.last_processed_at) },
              { key: 'event', header: 'Last event', render: (r) => String(r.last_processed_event_id ?? '—'), secondary: true },
            ]}
            rows={consumers.data ?? []}
            rowKey={(r) => String(r.id ?? r.consumer_name)}
            loading={consumers.loading}
            error={consumers.error}
            onRetry={consumers.reload}
            empty={<EmptyState title="No consumers" description="No consumer has registered with the event bus." />}
          />
        )}
      </Section>

      <ConfirmationDialog
        open={!!discard}
        title="Discard this dead letter?"
        description={discard ? `The ${discard.event_type} event will not be retried again. This cannot be undone.` : undefined}
        confirmLabel="Discard"
        destructive
        loading={busy}
        onCancel={() => setDiscard(null)}
        onConfirm={() => discard && act(() => eventsApi.deleteDLQ(String(discard.id)), 'Dead letter discarded', () => { setDiscard(null); dlq.reload(); })}
      />
    </Frame>
  );
}

const PANELS: Partial<Record<View, ComponentType<PanelProps>>> = {
  rbac: RbacPanel,
  workflow: WorkflowPanel,
  notifications: NotificationPanel,
  scheduler: SchedulerPanel,
  documents: DocumentPanel,
  integrations: IntegrationPanel,
  audit: AuditPanel,
  eventbus: EventBusPanel,
};
