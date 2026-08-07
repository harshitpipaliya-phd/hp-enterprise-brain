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
import { Activity, AlertTriangle, Clock3, RefreshCw, Signal as SignalIcon, Sparkles } from 'lucide-react';
import { api } from '../../api/signal';
import './SignalDashboard.css';

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
  metadata: Record<string, unknown>;
  createdDate: string;
  updatedDate?: string | null;
}

type DateWindow = '7' | '30' | '90' | 'all';
type DistributionRow = { name: string; value: number; percent: number };
type TrendRow = { label: string; date: string; total: number } & Record<string, string | number>;

const OPEN_STATUSES = new Set(['new', 'triaged', 'investigating', 'evidenced']);
const CLOSED_STATUSES = new Set(['resolved', 'closed', 'dismissed']);
const RESOLVED_STATUSES = new Set(['resolved', 'closed']);
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];
const PALETTE = ['#2f7f93', '#b88a22', '#bd2f68', '#7b68b4', '#5aa8ba', '#8b6f2f', '#596780', '#2f8f6d'];
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#b91c1c',
  high: '#bd2f68',
  medium: '#a8892f',
  low: '#2f7f93',
  unknown: '#7c8496',
};
const STATUS_COLORS: Record<string, string> = {
  new: '#2f7f93',
  triaged: '#5aa8ba',
  investigating: '#7b68b4',
  evidenced: '#b88a22',
  resolved: '#2f8f6d',
  closed: '#596780',
  dismissed: '#7c8496',
};

function normalizeKey(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text.toLowerCase() : fallback;
}

function displayLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
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
  return value === null ? '-' : `${(value * 100).toFixed(digits)}%`;
}

function formatHours(hours: number | null): string {
  if (hours === null) return '-';
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`;
}

function formatDelta(value: number | null): string {
  if (value === null) return 'no prior baseline';
  if (value === 0) return 'flat vs previous week';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% vs previous week`;
}

function buildTrend(signals: Signal[], dateWindow: DateWindow): { rows: TrendRow[]; keys: string[] } {
  const now = new Date();
  const createdDates = signals.map((s) => parseDate(s.createdDate)).filter((d): d is Date => d !== null);
  const earliest = createdDates.length ? new Date(Math.min(...createdDates.map((d) => d.getTime()))) : now;
  const requestedDays = dateWindow === 'all' ? Math.max(1, Math.ceil(daysBetween(earliest, now)) + 1) : Number(dateWindow);
  const bucketCount = Math.min(dateWindow === '7' ? 7 : 12, Math.max(1, requestedDays));
  const bucketSizeDays = Math.max(1, Math.ceil(requestedDays / bucketCount));
  const start = new Date(now.getTime() - (bucketCount - 1) * bucketSizeDays * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const classifications = Object.entries(countBy(signals, (s) => normalizeKey(s.classification, 'unclassified')))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key);

  const rows: TrendRow[] = Array.from({ length: bucketCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i * bucketSizeDays);
    return {
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: d.toISOString().slice(0, 10),
      total: 0,
      ...Object.fromEntries(classifications.map((key) => [key, 0])),
    };
  });

  signals.forEach((signal) => {
    const created = parseDate(signal.createdDate);
    if (!created || created < start || created > now) return;
    const index = Math.floor(daysBetween(start, created) / bucketSizeDays);
    const row = rows[index];
    if (!row) return;
    const key = normalizeKey(signal.classification, 'unclassified');
    row.total += 1;
    if (classifications.includes(key)) row[key] = Number(row[key] ?? 0) + 1;
  });

  return { rows, keys: classifications };
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

export default function SignalDashboard({ tenantId }: { tenantId: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [dateWindow, setDateWindow] = useState<DateWindow>('90');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSignals = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await api.listSignals(tenantId);
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
    loadSignals();
  }, [tenantId]);

  const filteredSignals = useMemo(() => {
    const now = new Date();
    const from = dateWindow === 'all' ? null : new Date(now.getTime() - Number(dateWindow) * 86_400_000);
    return signals.filter((signal) => {
      const status = normalizeKey(signal.status, 'unknown');
      const severity = normalizeKey(signal.severity, 'unknown');
      const classification = normalizeKey(signal.classification, 'unclassified');
      const created = parseDate(signal.createdDate);
      if (statusFilter && status !== statusFilter) return false;
      if (severityFilter && severity !== severityFilter) return false;
      if (classificationFilter && classification !== classificationFilter) return false;
      if (from && (!created || created < from)) return false;
      return true;
    });
  }, [signals, statusFilter, severityFilter, classificationFilter, dateWindow]);

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
    const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
    const mttrRows = buildMttrByClassification(filteredSignals);
    const mttrHours = mttrRows.length
      ? mttrRows.reduce((sum, row) => sum + row.value, 0) / mttrRows.length
      : null;
    const weeklyGrowth = lastWeek.length === 0 ? null : ((newThisWeek.length - lastWeek.length) / lastWeek.length) * 100;
    const closureRate = filteredSignals.length ? closed.length / filteredSignals.length : null;
    const severityRows = distribution(countBy(filteredSignals, (s) => normalizeKey(s.severity, 'unknown')), SEVERITY_ORDER);
    const statusRows = distribution(countBy(filteredSignals, (s) => normalizeKey(s.status, 'unknown')));
    const classificationRows = distribution(countBy(filteredSignals, (s) => normalizeKey(s.classification, 'unclassified')));
    const sourceRows = distribution(countBy(filteredSignals, (s) => normalizeKey(s.source, 'unknown'))).slice(0, 6);
    const confidenceRows = distribution(countBy(filteredSignals, (s) => {
      const confidence = confidenceValue(s);
      if (confidence === null) return 'unknown';
      if (confidence >= 0.75) return 'high';
      if (confidence >= 0.45) return 'medium';
      return 'low';
    }), ['high', 'medium', 'low', 'unknown']);
    const trend = buildTrend(filteredSignals, dateWindow);
    const dominantClassification = classificationRows[0] ?? null;
    const dominantSeverity = severityRows[0] ?? null;
    const oldestOpen = open.reduce<Signal | null>((oldest, signal) => {
      const created = parseDate(signal.createdDate);
      const oldestCreated = parseDate(oldest?.createdDate);
      if (!created) return oldest;
      return !oldest || !oldestCreated || created < oldestCreated ? signal : oldest;
    }, null);
    const oldestOpenDays = oldestOpen ? daysBetween(parseDate(oldestOpen.createdDate) ?? now, now) : null;

    return {
      open,
      closed,
      highOpen,
      newThisWeek,
      lastWeek,
      avgConfidence,
      mttrRows,
      mttrHours,
      weeklyGrowth,
      closureRate,
      severityRows,
      statusRows,
      classificationRows,
      sourceRows,
      confidenceRows,
      trend,
      dominantClassification,
      dominantSeverity,
      oldestOpenDays,
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

  const generatedInsights = useMemo(() => {
    const insights: Array<{ title: string; body: string; tone: 'state' | 'movement' | 'impact' }> = [];
    insights.push({
      title: 'Current system state',
      body: model.open.length === 0
        ? `No open signals in the current filtered view. ${model.closed.length.toLocaleString()} signals are closed or dismissed.`
        : `${model.open.length.toLocaleString()} open signals remain active; ${model.highOpen.length.toLocaleString()} are high or critical severity.`,
      tone: 'state',
    });
    insights.push({
      title: 'Movement analysis',
      body: model.weeklyGrowth === null
        ? `${model.newThisWeek.length.toLocaleString()} signals arrived this week; there is no previous-week baseline in the current filter.`
        : `Arrivals are ${Math.abs(model.weeklyGrowth).toFixed(1)}% ${model.weeklyGrowth > 0 ? 'higher' : model.weeklyGrowth < 0 ? 'lower' : 'unchanged'} than the previous week.`,
      tone: 'movement',
    });
    insights.push({
      title: 'Consequence analysis',
      body: model.dominantClassification
        ? `${displayLabel(model.dominantClassification.name)} accounts for ${(model.dominantClassification.percent * 100).toFixed(0)}% of the filtered volume, with ${displayLabel(model.dominantSeverity?.name ?? 'unknown')} as the largest severity band.`
        : 'No classification pattern is available for the current filters.',
      tone: 'impact',
    });
    if (model.oldestOpenDays !== null) {
      insights.push({
        title: 'Resolution pressure',
        body: `The oldest open signal has been active for ${model.oldestOpenDays.toFixed(model.oldestOpenDays < 10 ? 1 : 0)} days in the current filter.`,
        tone: model.highOpen.length > 0 ? 'impact' : 'state',
      });
    }
    return insights;
  }, [model]);

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

  const filteredLabel = `${filteredSignals.length.toLocaleString()} of ${signals.length.toLocaleString()} signals`;

  return (
    <div className="signal-intel">
      <header className="signal-intel__header">
        <div>
          <div className="signal-intel__eyebrow">Intelligence Loop</div>
          <h1>Signals</h1>
          <p>What is this organization&apos;s problem-arrival pattern, and is it getting worse?</p>
        </div>
        <div className="signal-intel__actions">
          {/* <span className="signal-intel__live"><span /> API Live</span> */}
          <button className="signal-intel__refresh" onClick={loadSignals} disabled={refreshing} title="Refresh signals">
            <RefreshCw size={15} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="signal-intel__filters" aria-label="Signal filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {filterOptions.statuses.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All severities</option>
          {filterOptions.severities.map((severity) => <option key={severity} value={severity}>{displayLabel(severity)}</option>)}
        </select>
        <select value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}>
          <option value="">All classifications</option>
          {filterOptions.classifications.map((classification) => <option key={classification} value={classification}>{displayLabel(classification)}</option>)}
        </select>
        <select value={dateWindow} onChange={(e) => setDateWindow(e.target.value as DateWindow)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
        <button className="signal-intel__ghost" onClick={clearFilters}>Reset</button>
        <span className="signal-intel__count">{filteredLabel}</span>
      </section>

      {error && <div className="signal-intel__error">{error}</div>}

      {loading ? (
        <div className="signal-intel__loading">Loading signals...</div>
      ) : (
        <>
          <section className="signal-intel__command">
            <div className="signal-intel__pulse">
              <div className="signal-intel__pulse-ring">
                <strong>{model.open.length.toLocaleString()}</strong>
                <span>open</span>
              </div>
              <div className="signal-intel__pulse-copy">
                <div className="signal-intel__eyebrow">Signal Pressure</div>
                <h2>{model.highOpen.length.toLocaleString()} high-severity signals in the active queue</h2>
                <p>{formatDelta(model.weeklyGrowth)}. Average confidence is {formatPercent(model.avgConfidence)} across this filtered view.</p>
              </div>
            </div>
            <div className="signal-intel__metric-strip">
              <KpiCard icon={<SignalIcon size={18} />} label="Open" value={model.open.length.toLocaleString()} hint={`${model.closed.length.toLocaleString()} closed`} tone={model.open.length > 0 ? 'warn' : 'good'} />
              <KpiCard icon={<AlertTriangle size={18} />} label="High Severity" value={model.highOpen.length.toLocaleString()} hint="High and critical open" tone={model.highOpen.length > 0 ? 'crit' : 'good'} />
              <KpiCard icon={<Activity size={18} />} label="New This Week" value={model.newThisWeek.length.toLocaleString()} hint={formatDelta(model.weeklyGrowth)} tone={model.weeklyGrowth !== null && model.weeklyGrowth > 0 ? 'warn' : 'good'} />
              <KpiCard icon={<Clock3 size={18} />} label="MTTR" value={formatHours(model.mttrHours)} hint="Resolved only" tone={model.mttrHours !== null && model.mttrHours > 72 ? 'warn' : 'good'} />
            </div>
          </section>

          <section className="signal-intel__ops-grid">
            <ChartCard title="Detection Timeline" meta={dateWindow === 'all' ? 'all records' : `last ${dateWindow} days`} footer={model.dominantClassification ? `${displayLabel(model.dominantClassification.name)} is the dominant detected pattern.` : 'No detection pattern available.'}>
              {model.trend.rows.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={model.trend.rows}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                    <Line type="monotone" dataKey="total" stroke="#bd2f68" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <div className="signal-intel__triage">
              <div className="signal-intel__card-head">
                <h2>Live Triage Queue</h2>
                <span>{filteredSignals.length.toLocaleString()} signals</span>
              </div>
              <div className="signal-intel__queue">
                {filteredSignals.slice(0, 8).map((signal) => {
                  const severity = normalizeKey(signal.severity, 'unknown');
                  const status = normalizeKey(signal.status, 'unknown');
                  return (
                    <article className="signal-intel__queue-item" key={signal.id}>
                      <span className="signal-intel__severity-dot" style={{ backgroundColor: SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.unknown }} />
                      <div>
                        <strong>{displayLabel(normalizeKey(signal.classification, 'unclassified'))}</strong>
                        <p>{displayLabel(status)} - {formatPercent(confidenceValue(signal))} confidence - {new Date(signal.createdDate).toLocaleString()}</p>
                      </div>
                      <div className="signal-intel__queue-actions">
                        {status === 'new' && <button onClick={() => advance(signal, 'triaged')}>Triage</button>}
                        {!['dismissed', 'resolved', 'closed'].includes(status) && <button onClick={() => advance(signal, 'dismissed')}>Dismiss</button>}
                      </div>
                    </article>
                  );
                })}
                {filteredSignals.length === 0 && <EmptyChart />}
              </div>
            </div>
          </section>

          <section className="signal-intel__analysis-board">
            <div className="signal-intel__insight-stack">
              {generatedInsights.map((insight) => (
                <article className={`signal-intel__summary-card signal-intel__summary-card--${insight.tone}`} key={insight.title}>
                  <div className="signal-intel__summary-label">{insight.tone === 'state' ? 'State' : insight.tone === 'movement' ? 'Movement' : 'Consequence'}</div>
                  <h2>{insight.title}</h2>
                  <p>{insight.body}</p>
                </article>
              ))}
            </div>
            <DistributionCard title="Classification Intelligence" rows={model.classificationRows} colorFor={(_, index) => PALETTE[index % PALETTE.length]} />
            <PieCard title="Severity Mix" rows={model.severityRows} colorFor={(name) => SEVERITY_COLORS[name] ?? SEVERITY_COLORS.unknown} />
            <PieCard title="Response State" rows={model.statusRows} colorFor={(name) => STATUS_COLORS[name] ?? '#7c8496'} />
            <ChartCard title="Resolution Drag" meta="MTTR by classification" footer={model.mttrRows[0] ? `${displayLabel(model.mttrRows[0].name)} is slowest at ${formatHours(model.mttrRows[0].value)}.` : 'No resolved timestamps available.'}>
              {model.mttrRows.length > 0 ? (
                <div className="signal-intel__mttr-list">
                  {model.mttrRows.map((row, index) => (
                    <div className="signal-intel__bar-row" key={row.name}>
                      <span>{displayLabel(row.name)}</span>
                      <div><i style={{ width: `${Math.max(row.percent * 100, 2)}%`, backgroundColor: PALETTE[index % PALETTE.length] }} /></div>
                      <strong>{formatHours(row.value)}</strong>
                    </div>
                  ))}
                </div>
              ) : <EmptyChart />}
            </ChartCard>
          </section>
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
      {footer && <div className="signal-intel__card-foot"><Sparkles size={14} /> {footer}</div>}
    </article>
  );
}

function DistributionCard({ title, rows, colorFor }: { title: string; rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <ChartCard title={title} meta={`${rows.length.toLocaleString()} groups`}>
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
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={2}>
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
  return <div className="signal-intel__empty">No data in the current filter.</div>;
}
