import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Activity, AlertTriangle, ChevronRight, Clock3, FileSearch, Radio, RefreshCw, Scale, Share2, Signal as SignalIcon } from 'lucide-react';
import { api } from '../../api/signal';
import type { View } from '../../App';
import { HeaderActions, PageHeader } from '../../ui';
import './SignalDashboard.css';
import { CHART_PALETTE, SEVERITY_COLOR, STATUS_COLOR } from '../../ui/palette';
import { operationsApi } from '../../api/operations';
import type { LoopMetrics } from '../../api/operations';
import { DistributionPanel } from '../workspace/OperationalIntelligencePanels';


export interface Signal {
  id: string;
  tenantId: string;
  orgId: string;
  source: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  confidence: number | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: 'new' | 'triaged' | 'investigating' | 'evidenced' | 'resolved' | 'closed' | 'dismissed' | string;
  classification: string | null;
  /** Present on rule-derived signals; null on imported rows. */
  ruleKey?: string | null;
  metadata: Record<string, unknown>;
  createdDate: string;
  updatedDate?: string | null;
}

type DateWindow = '7' | '30' | '90' | 'all';
type DistributionRow = { name: string; value: number; percent: number };
type TrendRow = { label: string; date: string; total: number };

const OPEN_STATUSES = new Set(['new', 'triaged', 'investigating', 'evidenced']);
const CLOSED_STATUSES = new Set(['resolved', 'closed', 'dismissed']);
const RESOLVED_STATUSES = new Set(['resolved', 'closed']);
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];
/*
  Colours come from ui/palette, not from here. Three local maps used to live at
  this spot and had already drifted from the ones on Departments — "critical"
  was a different red on each screen. The shared module is the fix; these
  aliases keep the call sites below unchanged.
*/
const PALETTE = CHART_PALETTE;
const SEVERITY_COLORS = SEVERITY_COLOR;
const STATUS_COLORS = STATUS_COLOR;

function normalizeKey(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text.toLowerCase() : fallback;
}

function displayLabel(value: string): string {
  return value.replace(/[_.]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * What to call a signal on screen.
 *
 * A signal has no title column. Imported rows carry the mapped source title in
 * `metadata.title`; rule-derived findings carry only their classification, which
 * is a machine token like `attendance_below_threshold`. The screen previously
 * showed the raw classification for both, so every imported row — the majority
 * of this installation's signals — displayed as its category rather than as
 * itself, and thousands of rows in the queue read identically.
 */
function signalTitle(signal: Signal): string {
  // An imported row carries the title its source column held.
  const title = signal.metadata?.title;
  if (typeof title === 'string' && title.trim()) return title.trim();

  // A rule-derived finding carries no title, but its rule key describes what was
  // found — `people_without_department` — where its classification only names the
  // bucket the finding falls into: `workforce`. Preferring the classification, as
  // this did, meant sixteen unrelated findings all displayed as "Workforce".
  const rule = signal.ruleKey ?? (typeof signal.metadata?.rule === 'string' ? signal.metadata.rule : null);
  if (rule) return displayLabel(String(rule));

  const classification = String(signal.classification ?? '').trim();
  if (classification && classification.toUpperCase() !== 'UNDETERMINED') return displayLabel(classification);
  return 'Untitled signal';
}

/** Who or what this signal is about, in words rather than as a foreign key. */
function signalSubject(signal: Signal): string | null {
  const owner = signal.metadata?.owner;
  if (typeof owner === 'string' && owner.trim()) return owner.trim();

  const ref = signal.metadata?.externalRef;
  if (typeof ref === 'string' && ref.trim()) return ref.trim();

  if (signal.relatedEntityType) {
    const type = displayLabel(String(signal.relatedEntityType));
    // The id alone tells the reader nothing, but "Person 4417" at least names
    // the kind of thing, and is the only handle this row carries.
    return signal.relatedEntityId ? `${type} ${signal.relatedEntityId}` : type;
  }

  return null;
}

/** Where it came from, and whether a rule found it or a file carried it in. */
function signalOrigin(signal: Signal): { label: string; detail: string } {
  const rule = signal.ruleKey ?? (typeof signal.metadata?.rule === 'string' ? signal.metadata.rule : null);
  return {
    label: displayLabel(String(signal.source ?? 'unknown')),
    detail: rule ? 'Found by a detection rule' : 'Came in with an imported file',
  };
}

/** How many source rows a rule-derived signal covers, when it says so. */
function affectedCount(signal: Signal): number | null {
  const value = Number(signal.metadata?.affectedCount);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * WHAT A SIGNAL MEANS, as opposed to what a signal says.
 *
 * A row in this table already carried what was noticed, how severe it is and
 * who raised it. What it could not answer is the set of questions a reader
 * actually has next — is this one occurrence or a hundred, is it getting worse,
 * what do the occurrences have in common, and how sure is the system.
 *
 * EVERY FIELD BELOW IS DERIVED FROM THE SIGNAL SET ALREADY IN HAND. Nothing is
 * fetched, nothing is inferred by a model, and nothing is stated that the rows
 * do not support: `cause` is the attribute the recurrences literally share, and
 * it is null when they share nothing. That distinction is the whole point — a
 * confident-sounding root cause invented from one occurrence would be worse
 * than no root cause at all.
 */
interface SignalIntelligence {
  /** Occurrences of the same finding in the loaded window, this one included. */
  frequency: number;
  /** Recurrences in the last 7 days against the 7 before them. */
  trend: { recent: number; previous: number; direction: 'up' | 'down' | 'flat'; changePercent: number | null };
  /** The attribute every recurrence shares, or null when they share none. */
  cause: { label: string; value: string; share: number } | null;
  /** As the detector recorded it, 0–1. Null on an imported row that carries none. */
  confidence: number | null;
  /** Source rows this finding covers, where the detector counted them. */
  affected: number | null;
  /** Why this one is worth opening before the others. */
  attention: { level: 'now' | 'soon' | 'watch'; reason: string };
}

/** The identity two occurrences of the same finding share. */
function signalKind(signal: Signal): string {
  const rule = signal.ruleKey ?? (typeof signal.metadata?.rule === 'string' ? signal.metadata.rule : null);
  return String(rule ?? signal.classification ?? signal.source ?? 'unknown').toLowerCase();
}

/**
 * The attribute a group of recurrences has in common.
 *
 * Checked in the order a reader finds useful — the unit first, because "every
 * one of these is in Field Operations" is the most actionable shape a recurring
 * signal takes, then the named owner, then the category. A candidate qualifies
 * only when it covers a clear majority AND the group is big enough for a
 * majority to mean anything; two signals sharing an owner is a coincidence, not
 * a cause.
 */
function sharedAttribute(group: Signal[]): SignalIntelligence['cause'] {
  if (group.length < 3) return null;

  const candidates: Array<[label: string, read: (s: Signal) => string]> = [
    ['Department', (x) => String(x.metadata?.department ?? x.metadata?.unit ?? '')],
    ['Owner', (x) => String(x.metadata?.owner ?? '')],
    ['Area', (x) => String(x.metadata?.area ?? x.metadata?.zone ?? '')],
    ['Category', (x) => String(x.metadata?.category ?? x.classification ?? '')],
    ['Entity type', (x) => String(x.relatedEntityType ?? '')],
  ];

  for (const [label, read] of candidates) {
    const counts = new Map<string, number>();

    for (const item of group) {
      const value = read(item).trim();
      if (value === '' || value.toLowerCase() === 'undetermined') continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    let best: [string, number] | null = null;
    for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;

    if (best && best[1] / group.length >= 0.6) {
      return { label, value: best[0], share: best[1] / group.length };
    }
  }

  return null;
}

function analyseSignal(signal: Signal, byKind: Map<string, Signal[]>): SignalIntelligence {
  const group = byKind.get(signalKind(signal)) ?? [signal];
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;

  let recent = 0;
  let previous = 0;

  for (const item of group) {
    const at = parseDate(item.createdDate)?.getTime();
    if (at === undefined) continue;
    const age = now - at;
    if (age <= week) recent += 1;
    else if (age <= week * 2) previous += 1;
  }

  const direction = recent > previous ? 'up' : recent < previous ? 'down' : 'flat';
  const changePercent = previous > 0 ? ((recent - previous) / previous) * 100 : null;

  const severity = normalizeKey(signal.severity, 'unknown');
  const affected = affectedCount(signal);
  const confidence = typeof signal.confidence === 'number' ? signal.confidence : null;

  /*
    THE RANKING, and it is deliberately made of three things a reader can check
    rather than one opaque number. Severity says how bad one occurrence is,
    frequency says how many there are, and the trend says whether waiting makes
    it worse. Anything that is severe AND rising is "now" whatever else is true.
  */
  const attention: SignalIntelligence['attention'] =
    (severity === 'critical' || severity === 'high') && direction === 'up'
      ? { level: 'now', reason: `${displayLabel(severity)} severity and rising — ${recent} in the last 7 days against ${previous} the week before.` }
      : severity === 'critical'
        ? { level: 'now', reason: 'Critical severity. One occurrence is enough to act on.' }
        : group.length >= 10
          ? { level: 'soon', reason: `Recurs often — ${group.length} occurrences of this same finding in the loaded window.` }
          : severity === 'high'
            ? { level: 'soon', reason: 'High severity, and not currently rising.' }
            : direction === 'up' && group.length >= 3
              ? { level: 'soon', reason: `Rising: ${recent} in the last 7 days against ${previous} the week before.` }
              : { level: 'watch', reason: group.length > 1
                ? `${displayLabel(severity)} severity, ${group.length} occurrences, not rising.`
                : `${displayLabel(severity)} severity, a single occurrence.` };

  return {
    frequency: group.length,
    trend: { recent, previous, direction, changePercent },
    cause: sharedAttribute(group),
    confidence,
    affected,
    attention,
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  d.setDate(diff);
  return d;
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 86_400_000);
}

function confidenceValue(signal: Signal): number | null {
  if (signal.confidence === null || signal.confidence === undefined) return null;
  const raw = Number(signal.confidence);
  if (!Number.isFinite(raw)) return null;
  return raw > 1 ? Math.min(raw / 100, 1) : Math.max(raw, 0);
}

function countBy(signals: Signal[], pick: (signal: Signal) => string): Record<string, number> {
  return signals.reduce<Record<string, number>>((acc, signal) => {
    const key = pick(signal);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function distribution(counts: Record<string, number>, order?: string[]): DistributionRow[] {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value, percent: total > 0 ? value / total : 0 }))
    .sort((a, b) => {
      const ai = order?.indexOf(a.name) ?? -1;
      const bi = order?.indexOf(b.name) ?? -1;
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return b.value - a.value;
    });
}

function formatPercent(value: number | null, digits = 0): string {
  return value === null ? '—' : `${(value * 100).toFixed(digits)}%`;
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`;
}

function formatWhen(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDelta(value: number | null): string {
  if (value === null) return 'no previous week to compare with';
  if (value === 0) return 'the same as the previous week';
  return `${Math.abs(value).toFixed(0)}% ${value > 0 ? 'more' : 'fewer'} than the previous week`;
}

function buildTrend(signals: Signal[], dateWindow: DateWindow): TrendRow[] {
  const now = new Date();
  const createdDates = signals.map((s) => parseDate(s.createdDate)).filter((d): d is Date => d !== null);
  const earliest = createdDates.length ? new Date(Math.min(...createdDates.map((d) => d.getTime()))) : now;
  const requestedDays = dateWindow === 'all' ? Math.max(1, Math.ceil(daysBetween(earliest, now)) + 1) : Number(dateWindow);
  const bucketCount = Math.min(dateWindow === '7' ? 7 : 12, Math.max(1, requestedDays));
  const bucketSizeDays = Math.max(1, Math.ceil(requestedDays / bucketCount));
  const start = new Date(now.getTime() - (bucketCount - 1) * bucketSizeDays * 86_400_000);
  start.setHours(0, 0, 0, 0);

  const rows: TrendRow[] = Array.from({ length: bucketCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i * bucketSizeDays);
    return {
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: d.toISOString().slice(0, 10),
      total: 0,
    };
  });

  signals.forEach((signal) => {
    const created = parseDate(signal.createdDate);
    if (!created || created < start || created > now) return;
    const index = Math.floor(daysBetween(start, created) / bucketSizeDays);
    if (rows[index]) rows[index].total += 1;
  });

  return rows;
}

function buildMttrByClassification(signals: Signal[]): DistributionRow[] {
  const grouped: Record<string, { totalHours: number; count: number }> = {};
  signals.forEach((signal) => {
    const status = normalizeKey(signal.status, 'unknown');
    if (!RESOLVED_STATUSES.has(status)) return;
    const created = parseDate(signal.createdDate);
    const updated = parseDate(signal.updatedDate);
    if (!created || !updated) return;
    const key = normalizeKey(signal.classification, 'unclassified');
    grouped[key] ??= { totalHours: 0, count: 0 };
    grouped[key].totalHours += Math.max(0, updated.getTime() - created.getTime()) / 3_600_000;
    grouped[key].count += 1;
  });

  const max = Math.max(...Object.values(grouped).map((row) => row.totalHours / row.count), 0);
  return Object.entries(grouped)
    .map(([name, row]) => {
      const value = row.totalHours / row.count;
      return { name, value, percent: max > 0 ? value / max : 0 };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

const PAGE_SIZE = 25;

/**
 * The most signals fetched in one request — the server's own `limit` ceiling.
 *
 * Sits at the maximum on purpose: every count, trend and distribution on this
 * screen is derived from the fetched set, so a smaller page would change the
 * NUMBERS and not just the list. What it removes is the unbounded read.
 * Truncation is surfaced below rather than hidden.
 */
const SIGNAL_FETCH_LIMIT = 5000;

export default function SignalDashboard({ tenantId, onNavigate, onExploreInGraph }: { tenantId: string; onNavigate?: (view: View) => void; onExploreInGraph?: (label: string, id: string) => void }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [dateWindow, setDateWindow] = useState<DateWindow>('90');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  /* Which row has its intelligence open. One at a time: the panel is tall, and
     two of them open at once pushes the second off screen anyway. */
  const [openSignalId, setOpenSignalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
    THE DETECTOR'S OWN MEASUREMENTS, which the list above never had.

    A signal row can say WHAT fired and WHEN; only the detector knows WHAT IT
    MEASURED — the share that breached, the area that over-indexed, the
    subscribers who came back. Every rule writes that into its metadata and the
    signals endpoint dropped it, so the screen could report that something
    happened and never what. This second request carries it, plus the
    distributions the strip cannot show.

    LOADED SEPARATELY AND ALLOWED TO FAIL: the queue is the screen, and this is
    the analysis around it.
  */
  const [loop, setLoop] = useState<LoopMetrics | null>(null);

  /**
   * The window is a server-side predicate now.
   *
   * It used to fetch every signal the tenant had and then drop the ones outside
   * the window in the browser. On the school tenant that is 15,002 rows
   * transferred to display 90 days of them, on every visit.
   */
  const loadSignals = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // `limit` alongside `since`, because a date window is no protection when
      // an entire tenant's signals were created inside it — which is exactly
      // the Lions case: 10,430 signals all written on one day came back as
      // 8.69 MB over 4,542 ms to render 25 rows. The cap is the server's own
      // maximum, so every chart below still aggregates over the same set.
      const params: Record<string, string> = { limit: String(SIGNAL_FETCH_LIMIT) };
      if (dateWindow !== 'all') {
        const since = new Date(Date.now() - Number(dateWindow) * 86_400_000);
        params.since = since.toISOString();
      }
      const data = await api.listSignals(tenantId, params);
      operationsApi.getLoop(tenantId).then(setLoop).catch(() => setLoop(null));
      setSignals(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load signals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void loadSignals();
  }, [tenantId, dateWindow]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, severityFilter, classificationFilter, dateWindow]);

  const filteredSignals = useMemo(() => signals.filter((signal) => {
    if (statusFilter && normalizeKey(signal.status, 'unknown') !== statusFilter) return false;
    if (severityFilter && normalizeKey(signal.severity, 'unknown') !== severityFilter) return false;
    if (classificationFilter && normalizeKey(signal.classification, 'unclassified') !== classificationFilter) return false;
    return true;
  }), [signals, statusFilter, severityFilter, classificationFilter]);

  const model = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const open = filteredSignals.filter((s) => OPEN_STATUSES.has(normalizeKey(s.status, 'unknown')));
    const closed = filteredSignals.filter((s) => CLOSED_STATUSES.has(normalizeKey(s.status, 'unknown')));
    const highOpen = open.filter((s) => ['high', 'critical'].includes(normalizeKey(s.severity, 'unknown')));
    const newThisWeek = filteredSignals.filter((s) => {
      const created = parseDate(s.createdDate);
      return created !== null && created >= thisWeekStart;
    });
    const lastWeek = filteredSignals.filter((s) => {
      const created = parseDate(s.createdDate);
      return created !== null && created >= lastWeekStart && created < thisWeekStart;
    });
    const confidences = filteredSignals.map(confidenceValue).filter((v): v is number => v !== null);
    const mttrRows = buildMttrByClassification(filteredSignals);

    return {
      open,
      closed,
      highOpen,
      newThisWeek,
      avgConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null,
      mttrRows,
      mttrHours: mttrRows.length ? mttrRows.reduce((sum, row) => sum + row.value, 0) / mttrRows.length : null,
      weeklyGrowth: lastWeek.length === 0 ? null : ((newThisWeek.length - lastWeek.length) / lastWeek.length) * 100,
      severityRows: distribution(countBy(filteredSignals, (s) => normalizeKey(s.severity, 'unknown')), SEVERITY_ORDER),
      statusRows: distribution(countBy(filteredSignals, (s) => normalizeKey(s.status, 'unknown'))),
      classificationRows: distribution(countBy(filteredSignals, (s) => normalizeKey(s.classification, 'unclassified'))),
      trend: buildTrend(filteredSignals, dateWindow),
    };
  }, [filteredSignals, dateWindow]);

  const filterOptions = useMemo(() => ({
    statuses: Object.keys(countBy(signals, (s) => normalizeKey(s.status, 'unknown'))).sort(),
    severities: Object.keys(countBy(signals, (s) => normalizeKey(s.severity, 'unknown'))).sort((a, b) => {
      const ai = SEVERITY_ORDER.indexOf(a);
      const bi = SEVERITY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }),
    classifications: Object.keys(countBy(signals, (s) => normalizeKey(s.classification, 'unclassified'))).sort(),
  }), [signals]);

  const clearFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setClassificationFilter('');
    setDateWindow('90');
  };

  const advance = async (signal: Signal, status: Signal['status']) => {
    await api.changeStatus(tenantId, signal.id, status);
    await loadSignals();
  };

  const windowLabel = dateWindow === 'all' ? 'all time' : `the last ${dateWindow} days`;
  /*
    Occurrences grouped by what they ARE, computed once for the whole loaded
    set rather than per row.

    Grouped over `signals`, not `filteredSignals`, deliberately: "this finding
    has occurred 34 times" is a fact about the organization, and it must not
    change because the reader ticked a severity filter. The filters decide what
    is listed; they do not get to rewrite what the listed rows mean.
  */
  const signalsByKind = useMemo(() => {
    const map = new Map<string, Signal[]>();
    for (const signal of signals) {
      const key = signalKind(signal);
      const bucket = map.get(key);
      if (bucket) bucket.push(signal);
      else map.set(key, [signal]);
    }
    return map;
  }, [signals]);

  const visible = filteredSignals.slice(0, visibleCount);

  return (
    <div className="signal-intel">
      <PageHeader
        variant="intelligence"
        icon={<Radio />}
        title="Operational Signals"
        description={<>What changed, what was detected, and what requires organizational attention.</>}
        actions={(
          <HeaderActions>
            <button
              type="button"
              className="u-btn u-btn-secondary"
              onClick={loadSignals}
              disabled={refreshing}
              title="Refresh signals"
            >
              <RefreshCw size={15} aria-hidden="true" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </HeaderActions>
        )}
      />

      <section className="signal-intel__filters" aria-label="Signal filters">
        <select value={dateWindow} onChange={(e) => setDateWindow(e.target.value as DateWindow)} aria-label="Time window">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {filterOptions.statuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} aria-label="Severity filter">
          <option value="">All severities</option>
          {filterOptions.severities.map((severity) => <option key={severity} value={severity}>{displayLabel(severity)}</option>)}
        </select>
        <select value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)} aria-label="Category filter">
          <option value="">All categories</option>
          {filterOptions.classifications.map((classification) => <option key={classification} value={classification}>{displayLabel(classification)}</option>)}
        </select>
        <button className="signal-intel__ghost" onClick={clearFilters}>Reset</button>
        <span className="signal-intel__count">
          {filteredSignals.length.toLocaleString()} signal{filteredSignals.length === 1 ? '' : 's'} in {windowLabel}
          {/* A capped read must never look like a complete one. When the server
              returned exactly the limit there is almost certainly more behind
              it, and every figure on this screen describes the fetched set. */}
          {signals.length >= SIGNAL_FETCH_LIMIT && (
            <> — showing the newest {SIGNAL_FETCH_LIMIT.toLocaleString()}; narrow the window to see the rest</>
          )}
        </span>
      </section>

      {error && <div className="signal-intel__error">{error}</div>}

      {loading ? (
        <div className="signal-intel__loading">Loading signals…</div>
      ) : signals.length === 0 ? (
        <div className="signal-intel__empty signal-intel__empty--page">
          <SignalIcon size={26} />
          <strong>No signals in {windowLabel}</strong>
          <p>
            Signals are raised when a detection rule matches this organization&apos;s data, or when a file is
            imported through the Ingestion Engine. Widen the time window, or import data, and they will appear here.
          </p>
        </div>
      ) : (
        <>
          <section className="signal-intel__metric-strip">
            <KpiCard
              icon={<SignalIcon size={18} />}
              label="Open"
              value={model.open.length.toLocaleString()}
              hint={`${model.closed.length.toLocaleString()} closed or dismissed`}
              tone={model.open.length > 0 ? 'warn' : 'good'}
            />
            <KpiCard
              icon={<AlertTriangle size={18} />}
              label="High severity and open"
              value={model.highOpen.length.toLocaleString()}
              hint="Needs attention first"
              tone={model.highOpen.length > 0 ? 'crit' : 'good'}
            />
            <KpiCard
              icon={<Activity size={18} />}
              label="Raised this week"
              value={model.newThisWeek.length.toLocaleString()}
              hint={formatDelta(model.weeklyGrowth)}
              tone={model.weeklyGrowth !== null && model.weeklyGrowth > 0 ? 'warn' : 'good'}
            />
            <KpiCard
              icon={<Clock3 size={18} />}
              label="Typical time to resolve"
              value={formatHours(model.mttrHours)}
              hint={model.mttrHours === null ? 'Nothing resolved yet in this window' : 'Across resolved signals only'}
              tone={model.mttrHours !== null && model.mttrHours > 72 ? 'warn' : 'good'}
            />
          </section>

          {/*
            SIGNAL INTELLIGENCE — the shape of the queue, not just its length.

            Severity, classification and grounding are three different questions
            about the same set of signals and the strip above can answer none of
            them: "12 open" says nothing about whether they are twelve variations
            of one fault or twelve unrelated ones, nor whether any of them cites a
            record that can be checked.

            Rendered from the same tenant-scoped aggregate the organization
            screen reads, so the two cannot disagree about how many signals exist.
          */}
          {loop?.signals.supported && (
            <>
              <section className="signal-intel__metric-strip">
                <KpiCard
                  icon={<FileSearch size={18} />}
                  label="Grounded in evidence"
                  value={`${loop.signals.grounded ?? 0} of ${loop.signals.total}`}
                  hint={(loop.signals.ungrounded ?? 0) > 0
                    ? `${loop.signals.ungrounded} cite no source record and cannot be verified`
                    : 'Every signal cites at least one observed record'}
                  tone={(loop.signals.ungrounded ?? 0) > 0 ? 'warn' : 'good'}
                />
                <KpiCard
                  icon={<Scale size={18} />}
                  label="Under investigation"
                  value={String(loop.signals.underInvestigation ?? 0)}
                  hint={`${loop.cases.total} investigation${loop.cases.total === 1 ? '' : 's'} opened in total`}
                  tone={(loop.signals.underInvestigation ?? 0) > 0 ? 'good' : 'warn'}
                />
                <KpiCard
                  icon={<Activity size={18} />}
                  label="Distinct rules fired"
                  value={String(loop.signals.distinctRules ?? 0)}
                  hint={loop.signals.averageConfidence !== null && loop.signals.averageConfidence !== undefined
                    ? `Average detector confidence ${(loop.signals.averageConfidence * 100).toFixed(0)}%`
                    : 'Detector confidence is not recorded'}
                  tone="good"
                />
                <KpiCard
                  icon={<Clock3 size={18} />}
                  label="Resolution rate"
                  value={loop.signals.resolutionRate !== null && loop.signals.resolutionRate !== undefined
                    ? `${(loop.signals.resolutionRate * 100).toFixed(0)}%`
                    : 'Not measurable'}
                  hint={`${loop.signals.resolved ?? 0} resolved, ${loop.signals.open ?? 0} still open`}
                  tone={(loop.signals.resolutionRate ?? 0) >= 0.5 ? 'good' : 'warn'}
                />
              </section>

              <div className="opsi-grid-2">
                <DistributionPanel
                  title="Severity"
                  rows={(loop.signals.bySeverity ?? []).map((r) => ({ name: r.label, records: r.count, share: r.share }))}
                  empty="No signal carries a severity."
                />
                <DistributionPanel
                  title="What the detectors are finding"
                  rows={(loop.signals.byClassification ?? []).map((r) => ({ name: r.label, records: r.count, share: r.share }))}
                  empty="No signal carries a classification."
                />
              </div>

              {/*
                WHAT EACH DETECTOR ACTUALLY MEASURED.

                Republished verbatim from the rule's own metadata — not
                recomputed, not rephrased, and not generated. A signal that
                recorded no measurements shows none rather than a placeholder.
              */}
              <section className="signal-intel__queue-panel">
                <div className="signal-intel__card-head">
                  <h2>What each detection measured</h2>
                  <span>from the rule&apos;s own metadata</span>
                </div>
                <ul className="signal-intel__findings">
                  {(loop.signals.signals ?? [])
                    .filter((entry) => entry.measurements.length > 0 || entry.scope.length > 0)
                    .slice(0, 10)
                    .map((entry) => (
                      <li key={entry.id} data-severity={entry.severity}>
                        <div className="signal-intel__finding-head">
                          <strong>{entry.title}</strong>
                          <span className="signal-intel__pill">{entry.severity}</span>
                          <span className="signal-intel__muted">
                            {entry.evidenceCount > 0
                              ? `${entry.evidenceCount} supporting record${entry.evidenceCount === 1 ? '' : 's'}`
                              : 'No supporting record cited'}
                          </span>
                          {entry.caseCount > 0 && <span className="signal-intel__muted">under investigation</span>}
                        </div>
                        {entry.measurements.length > 0 && (
                          <dl className="signal-intel__measures">
                            {entry.measurements.map((m) => (
                              <Fragment key={m.key}>
                                <dt>{m.label}</dt>
                                <dd>
                                  {m.format === 'ratio' && typeof m.value === 'number'
                                    ? `${(m.value * 100).toFixed(1)}%`
                                    : typeof m.value === 'number'
                                      ? m.value.toLocaleString()
                                      : String(m.value)}
                                </dd>
                              </Fragment>
                            ))}
                          </dl>
                        )}
                        {entry.scope.length > 0 && (
                          <p className="signal-intel__scope">
                            Concentrated in:{' '}
                            {entry.scope.map((item) => (
                              <span key={`${item.group}-${item.name}`}>
                                {item.name}{item.count !== null ? ` (${item.count})` : ''}
                              </span>
                            ))}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            </>
          )}

          <section className="signal-intel__queue-panel">
            <div className="signal-intel__card-head">
              <h2>Signal queue</h2>
              <span>newest first</span>
            </div>
            <div className="signal-intel__table-wrap">
              <table className="signal-intel__table">
                <thead>
                  <tr>
                    <th>What was noticed</th>
                    <th>Severity</th>
                    <th>Attention</th>
                    <th>Recurrence</th>
                    <th>Status</th>
                    <th>Concerns</th>
                    <th>When</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((signal) => {
                    const severity = normalizeKey(signal.severity, 'unknown');
                    const status = normalizeKey(signal.status, 'unknown');
                    const origin = signalOrigin(signal);
                    const subject = signalSubject(signal);
                    const affected = affectedCount(signal);
                    const intel = analyseSignal(signal, signalsByKind);
                    const isOpen = openSignalId === String(signal.id);
                    return (
                      <Fragment key={signal.id}>
                      <tr data-open={isOpen}>
                        <td>
                          {/* The title is the disclosure control: the row already
                              has four buttons, and a fifth labelled "expand"
                              beside a heading nobody can click reads as an
                              oversight rather than as a design. */}
                          <button
                            type="button"
                            className="signal-intel__disclose"
                            aria-expanded={isOpen}
                            onClick={() => setOpenSignalId(isOpen ? null : String(signal.id))}
                          >
                            <ChevronRight size={13} className="signal-intel__chevron" />
                            <strong className="signal-intel__title">{signalTitle(signal)}</strong>
                          </button>
                          <small>
                            {displayLabel(normalizeKey(signal.classification, 'uncategorised'))}
                            {affected !== null ? ` · ${affected.toLocaleString()} records affected` : ''}
                          </small>
                        </td>
                        <td>
                          <span
                            className="signal-intel__pill"
                            style={{
                              color: SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.unknown,
                              backgroundColor: `${SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.unknown}1f`,
                            }}
                          >
                            {displayLabel(severity)}
                          </span>
                        </td>
                        <td>
                          <span className="signal-intel__attention" data-level={intel.attention.level}>
                            {intel.attention.level === 'now' ? 'Act now' : intel.attention.level === 'soon' ? 'Soon' : 'Watch'}
                          </span>
                        </td>
                        <td className="signal-intel__recurrence">
                          <strong>{intel.frequency > 1 ? `${intel.frequency.toLocaleString()}×` : 'Once'}</strong>
                          <small data-direction={intel.trend.direction}>
                            {intel.trend.direction === 'up' ? '▲ rising' : intel.trend.direction === 'down' ? '▼ easing' : '— steady'}
                          </small>
                        </td>
                        <td>
                          <span className="signal-intel__pill" style={{ color: STATUS_COLORS[status] ?? 'var(--content-secondary)', backgroundColor: `${STATUS_COLORS[status] ?? 'var(--content-tertiary)'}1f` }}>
                            {displayLabel(status)}
                          </span>
                        </td>
                        <td>{subject ?? <span className="signal-intel__muted">Not recorded</span>}</td>
                        <td className="signal-intel__when">{formatWhen(signal.createdDate)}</td>
                        <td>
                          <div className="signal-intel__row-actions">
                            {status === 'new' && <button onClick={() => advance(signal, 'triaged')}>Triage</button>}
                            {!['dismissed', 'resolved', 'closed'].includes(status) && <button onClick={() => advance(signal, 'dismissed')}>Dismiss</button>}
                            {onNavigate && (
                              <button onClick={() => onNavigate('evidence')} title="Open the Evidence screen">
                                <FileSearch size={13} /> Evidence
                              </button>
                            )}
                            {/* The graph is where this signal's evidence, the
                                case it opened and the recommendation it led to
                                are visible as one chain. */}
                            {onExploreInGraph && (
                              <button
                                onClick={() => onExploreInGraph('Signal', String(signal.id))}
                                title="Open Graph Explorer centred on this signal"
                              >
                                <Share2 size={13} /> Graph
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="signal-intel__detail-row">
                          <td colSpan={8}>
                            <div className="signal-intel__detail">
                              <dl>
                                <div>
                                  <dt>How often</dt>
                                  <dd>
                                    {intel.frequency === 1
                                      ? 'A single occurrence in the loaded window.'
                                      : `${intel.frequency.toLocaleString()} occurrences of this same finding in the loaded window.`}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Direction</dt>
                                  <dd>
                                    {intel.trend.previous === 0 && intel.trend.recent === 0
                                      ? 'Nothing in the last fortnight — this is an older finding.'
                                      : `${intel.trend.recent} in the last 7 days against ${intel.trend.previous} the week before` +
                                        (intel.trend.changePercent === null
                                          ? '.'
                                          : ` — ${intel.trend.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(intel.trend.changePercent))}%.`)}
                                  </dd>
                                </div>
                                <div>
                                  <dt>What the occurrences share</dt>
                                  <dd>
                                    {/* NOT A ROOT CAUSE, AND IT DOES NOT CLAIM TO BE.
                                        It is the attribute the recurrences literally have
                                        in common, with the proportion stated so a reader
                                        can judge it. Where they share nothing, that is
                                        said plainly rather than dressed up. */}
                                    {intel.cause
                                      ? `${intel.cause.label}: ${intel.cause.value} — ${Math.round(intel.cause.share * 100)}% of occurrences. Worth checking first.`
                                      : intel.frequency < 3
                                        ? 'Too few occurrences to look for a pattern.'
                                        : 'No department, owner, area or category is common to most of these.'}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Raised by</dt>
                                  <dd>{origin.label} — {origin.detail.toLowerCase()}</dd>
                                </div>
                                <div>
                                  <dt>Confidence</dt>
                                  <dd>
                                    {intel.confidence === null
                                      ? 'The source recorded none for this signal.'
                                      : `${Math.round(intel.confidence * 100)}% as recorded by the detector.`}
                                  </dd>
                                </div>
                                <div>
                                  <dt>Scale</dt>
                                  <dd>
                                    {intel.affected === null
                                      ? 'The detector did not record how many rows this covers.'
                                      : `${intel.affected.toLocaleString()} source records are covered by this finding.`}
                                  </dd>
                                </div>
                              </dl>
                              <p className="signal-intel__why" data-level={intel.attention.level}>
                                <strong>
                                  {intel.attention.level === 'now' ? 'Act now' : intel.attention.level === 'soon' ? 'Look at this soon' : 'Worth watching'}
                                </strong>
                                {' — '}{intel.attention.reason}
                              </p>
                              {onNavigate && (
                                <div className="signal-intel__chain">
                                  <span>Follow it through:</span>
                                  <button type="button" onClick={() => onNavigate('evidence')}>Evidence</button>
                                  <ChevronRight size={12} />
                                  <button type="button" onClick={() => onNavigate('deliberation')}>Case</button>
                                  <ChevronRight size={12} />
                                  <button type="button" onClick={() => onNavigate('decisionintel')}>Decision</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={8}><div className="signal-intel__empty">No signals match the current filters.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibleCount < filteredSignals.length && (
              <div className="signal-intel__more">
                <span>Showing {visible.length.toLocaleString()} of {filteredSignals.length.toLocaleString()}</span>
                <button className="signal-intel__ghost" onClick={() => setVisibleCount((n) => n + PAGE_SIZE * 4)}>Show more</button>
              </div>
            )}
          </section>

          <section className="signal-intel__analysis-board">
            <ChartCard
              title="When signals were raised"
              meta={windowLabel}
              footer={model.classificationRows[0] ? `${displayLabel(model.classificationRows[0].name)} is the most common category, at ${(model.classificationRows[0].percent * 100).toFixed(0)}% of this window.` : undefined}
            >
              {model.trend.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={model.trend}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                    <Line type="monotone" dataKey="total" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <DistributionCard title="By category" rows={model.classificationRows} colorFor={(_, index) => PALETTE[index % PALETTE.length]} />
            <PieCard title="By severity" rows={model.severityRows} colorFor={(name) => SEVERITY_COLORS[name] ?? SEVERITY_COLORS.unknown} />
            <PieCard title="By status" rows={model.statusRows} colorFor={(name) => STATUS_COLORS[name] ?? 'var(--content-tertiary)'} />

            {model.mttrRows.length > 0 && (
              <ChartCard
                title="Slowest to resolve"
                meta="average, by category"
                footer={`${displayLabel(model.mttrRows[0].name)} takes longest, at ${formatHours(model.mttrRows[0].value)}.`}
              >
                <div className="signal-intel__mttr-list">
                  {model.mttrRows.map((row, index) => (
                    <div className="signal-intel__bar-row" key={row.name}>
                      <span>{displayLabel(row.name)}</span>
                      <div><i style={{ width: `${Math.max(row.percent * 100, 2)}%`, backgroundColor: PALETTE[index % PALETTE.length] }} /></div>
                      <strong>{formatHours(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </ChartCard>
            )}
          </section>

          <p className="signal-intel__footnote">
            Average stated confidence across this window is {formatPercent(model.avgConfidence)}. Imported rows are
            recorded at full confidence because they report what the source said, not whether it was right.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'good' | 'warn' | 'crit' }) {
  return (
    <article className="signal-intel__kpi" data-tone={tone}>
      <div className="signal-intel__kpi-icon">{icon}</div>
      <div className="signal-intel__kpi-label">{label}</div>
      <div className="signal-intel__kpi-value">{value}</div>
      <div className="signal-intel__kpi-hint">{hint}</div>
    </article>
  );
}

function ChartCard({ title, meta, footer, children }: { title: string; meta: string; footer?: string; children: ReactNode }) {
  return (
    <article className="signal-intel__card">
      <div className="signal-intel__card-head">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      <div className="signal-intel__chart">{children}</div>
      {footer && <div className="signal-intel__card-foot">{footer}</div>}
    </article>
  );
}

function DistributionCard({ title, rows, colorFor }: { title: string; rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <ChartCard title={title} meta={`${rows.length.toLocaleString()} group${rows.length === 1 ? '' : 's'}`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <div className="signal-intel__distribution">
          {rows.slice(0, 8).map((row, index) => (
            <div className="signal-intel__dist-row" key={row.name}>
              <div>
                <span style={{ backgroundColor: colorFor(row.name, index) }} />
                <strong>{displayLabel(row.name)}</strong>
              </div>
              <div className="signal-intel__dist-track"><i style={{ width: `${row.percent * 100}%`, backgroundColor: colorFor(row.name, index) }} /></div>
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
    <ChartCard title={title} meta={`${rows.reduce((sum, row) => sum + row.value, 0).toLocaleString()} signals`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {rows.map((row, index) => <Cell key={row.name} fill={colorFor(row.name, index)} />)}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }}
              formatter={(value: unknown) => [Number(value ?? 0), 'Signals']}
              labelFormatter={(value: unknown) => displayLabel(String(value ?? ''))}
            />
            <Legend formatter={(value) => displayLabel(String(value))} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function EmptyChart() {
  return <div className="signal-intel__empty">Not enough data in this window to draw this.</div>;
}
