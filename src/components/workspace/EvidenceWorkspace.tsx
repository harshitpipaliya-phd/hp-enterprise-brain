import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Archive, Brain, Clock3, Database, FileCheck2, Link2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../../api/intelligence';
import { api as signalApi } from '../../api/signal';
import { aiApi } from '../../api/ai';
import { useToast } from '../Toast';
import type { View } from '../../App';
import './EvidenceWorkspace.css';

interface Evidence {
  id: string;
  signalId?: string | null;
  source?: string | null;
  evidenceType?: string | null;
  content?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
  confidence?: number | string | null;
  observedDate?: string | null;
  createdDate?: string | null;
  status?: string | null;
}

interface SignalRecord {
  id: string;
  status?: string | null;
  severity?: string | null;
  classification?: string | null;
  createdDate?: string | null;
}

type DateWindow = '30' | '90' | '180' | 'all';
type FreshnessBand = 'Fresh' | 'Recent' | 'Aging' | 'Stale';
type DistributionRow = { name: string; value: number; percent: number };
type TrendRow = { label: string; date: string; count: number };

/**
 * The most rows this screen will pull in one request.
 *
 * The server caps `limit` at 5000, and this sits at that ceiling deliberately:
 * every chart and distribution on this screen is computed over the fetched set,
 * so a smaller page would quietly change the numbers rather than just the list
 * length. What it prevents is the unbounded case — the Lions tenant returned
 * 10,430 rows as 8.95 MB in 6,258 ms, all of it to render 25 visible rows.
 *
 * The response is not silently truncated: when the count comes back at the
 * limit the screen says so, so a partial view is never mistaken for the whole
 * ledger.
 */
const EVIDENCE_FETCH_LIMIT = 5000;

const HALF_LIFE_DAYS = 90;
const FRESHNESS_ORDER: FreshnessBand[] = ['Fresh', 'Recent', 'Aging', 'Stale'];
const FRESHNESS_COLORS: Record<FreshnessBand, string> = {
  Fresh: 'var(--chart-1)',
  Recent: 'var(--chart-1)',
  Aging: 'var(--chart-4)',
  Stale: 'var(--chart-3)',
};
const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'var(--chart-1)',
  medium: 'var(--chart-4)',
  low: 'var(--chart-3)',
  unknown: 'var(--content-tertiary)',
};
const PALETTE = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-2)', 'var(--content-tertiary)', 'var(--chart-6)'];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function evidenceDate(item: Evidence): Date | null {
  return parseDate(item.observedDate) ?? parseDate(item.createdDate) ?? parseDate(String(item.provenance?.ts ?? ''));
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 86_400_000);
}

function confidenceValue(item: Evidence): number | null {
  const raw = Number(item.confidence ?? item.provenance?.confidence);
  if (!Number.isFinite(raw)) return null;
  return raw > 1 ? Math.min(raw / 100, 1) : Math.max(raw, 0);
}

function freshnessScore(item: Evidence, now = new Date()): number | null {
  const observed = evidenceDate(item);
  if (!observed) return null;
  const ageDays = daysBetween(observed, now);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

function freshnessBand(score: number | null): FreshnessBand {
  if (score === null) return 'Stale';
  if (score >= 0.9) return 'Fresh';
  if (score >= 0.7) return 'Recent';
  if (score >= 0.4) return 'Aging';
  return 'Stale';
}

function normalized(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text.toLowerCase() : fallback;
}

function displayLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPercent(value: number | null, digits = 0): string {
  return value === null ? '-' : `${(value * 100).toFixed(digits)}%`;
}

function formatDays(value: number | null): string {
  if (value === null) return '-';
  if (value < 1) return '<1d';
  return `${value.toFixed(value < 10 ? 1 : 0)}d`;
}

function countBy(items: Evidence[], pick: (item: Evidence) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = pick(item);
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

/**
 * What this evidence says, in a sentence a person can read.
 *
 * THE BUG THIS FIXES. The fallback branch was `JSON.stringify(content)`, so any
 * evidence row whose content object had no `note`/`text`/`summary`/`description`
 * key rendered as a raw JSON blob in the middle of the card —
 * `{"observedAt":"2026-03-01","source":"school_fee","amount":"12000"}`. Every
 * row ingestion produces takes that branch when the source had no free-text
 * column, which is most of them.
 *
 * Now the same object is read out as its own fields. Keys are humanised, the
 * bookkeeping ones that repeat information already on the card are dropped, and
 * the result is capped so one unusually wide row cannot push the card open.
 */
const CONTENT_NOISE_KEYS = new Set(['source', 'observedat', 'observed_at', 'ts', 'confidence', 'hash']);

function contentText(item: Evidence): string {
  const content = item.content ?? {};
  const preferred = content.note ?? content.text ?? content.summary ?? content.description;
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim();
  if (preferred !== undefined && preferred !== null && typeof preferred !== 'object') return String(preferred);

  const pairs = Object.entries(content)
    .filter(([key, value]) =>
      !CONTENT_NOISE_KEYS.has(key.toLowerCase())
      && value !== null
      && value !== undefined
      && value !== ''
      && typeof value !== 'object')
    .slice(0, 6)
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`);

  return pairs.length > 0 ? pairs.join(' · ') : 'No readable detail was recorded with this evidence.';
}

/** `observedAt` / `student_ref` → `Observed at` / `Student ref`. */
function humanizeKey(key: string): string {
  const words = key.replace(/[_.]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : key;
}

function buildTrend(items: Evidence[], dateWindow: DateWindow): TrendRow[] {
  const now = new Date();
  const dates = items.map(evidenceDate).filter((date): date is Date => date !== null);
  const earliest = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : now;
  const requestedDays = dateWindow === 'all' ? Math.max(1, Math.ceil(daysBetween(earliest, now)) + 1) : Number(dateWindow);
  const bucketCount = Math.min(12, Math.max(1, requestedDays));
  const bucketSizeDays = Math.max(1, Math.ceil(requestedDays / bucketCount));
  const start = new Date(now.getTime() - (bucketCount - 1) * bucketSizeDays * 86_400_000);
  start.setHours(0, 0, 0, 0);

  const rows = Array.from({ length: bucketCount }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i * bucketSizeDays);
    return {
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: date.toISOString().slice(0, 10),
      count: 0,
    };
  });

  items.forEach((item) => {
    const observed = evidenceDate(item);
    if (!observed || observed < start || observed > now) return;
    const index = Math.floor(daysBetween(start, observed) / bucketSizeDays);
    if (rows[index]) rows[index].count += 1;
  });

  return rows;
}

export default function EvidenceWorkspace({ tenantId, onNavigate }: { tenantId: string; onNavigate?: (view: View) => void }) {
  const { showToast } = useToast();
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ signalId: '', source: 'internal', content: '', confidence: '0.7' });
  const [submitting, setSubmitting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [groundingFilter, setGroundingFilter] = useState('');
  const [dateWindow, setDateWindow] = useState<DateWindow>('180');

  const load = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Ask the server for the window the screen actually shows, instead of
      // downloading the tenant's entire evidence ledger and filtering it in the
      // browser. `since` mirrors the date selector; `limit` is the safety net
      // for a tenant whose whole ledger falls inside that window — which is
      // exactly the Lions case, where every row was created on one day.
      const params: Record<string, string> = { limit: String(EVIDENCE_FETCH_LIMIT) };
      if (dateWindow !== 'all') {
        params.since = new Date(Date.now() - Number(dateWindow) * 86_400_000).toISOString();
      }

      const [data, signalData] = await Promise.all([
        api.listEvidence(tenantId, params),
        signalApi.listSignals(tenantId, { limit: String(EVIDENCE_FETCH_LIMIT) }),
      ]);
      setEvidence(Array.isArray(data) ? data : []);
      setSignals(Array.isArray(signalData) ? signalData : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load evidence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // dateWindow is a dependency because it is now part of the REQUEST, not just
  // a client-side filter — widening the window has to go back to the server.
  useEffect(() => {
    setLoading(true);
    load();
  }, [tenantId, dateWindow]);

  const enriched = useMemo(() => {
    const now = new Date();
    return evidence.map((item) => {
      const observed = evidenceDate(item);
      const freshness = freshnessScore(item, now);
      const confidence = confidenceValue(item);
      const ageDays = observed ? daysBetween(observed, now) : null;
      return {
        item,
        observed,
        ageDays,
        freshness,
        band: freshnessBand(freshness),
        confidence,
        source: normalized(item.source, 'unknown'),
        type: normalized(item.evidenceType, 'unknown'),
        grounded: Boolean(item.signalId),
        quality: confidence === null || freshness === null ? null : confidence * freshness,
      };
    });
  }, [evidence]);

  const filteredEvidence = useMemo(() => {
    const now = new Date();
    const from = dateWindow === 'all' ? null : new Date(now.getTime() - Number(dateWindow) * 86_400_000);
    return enriched.filter((row) => {
      if (sourceFilter && row.source !== sourceFilter) return false;
      if (typeFilter && row.type !== typeFilter) return false;
      if (freshnessFilter && row.band !== freshnessFilter) return false;
      if (groundingFilter === 'grounded' && !row.grounded) return false;
      if (groundingFilter === 'ungrounded' && row.grounded) return false;
      if (from && (!row.observed || row.observed < from)) return false;
      return true;
    });
  }, [enriched, sourceFilter, typeFilter, freshnessFilter, groundingFilter, dateWindow]);

  const model = useMemo(() => {
    const rows = filteredEvidence;
    const items = rows.map((row) => row.item);
    const confidences = rows.map((row) => row.confidence).filter((value): value is number => value !== null);
    const freshnessScores = rows.map((row) => row.freshness).filter((value): value is number => value !== null);
    const ages = rows.map((row) => row.ageDays).filter((value): value is number => value !== null);
    const qualityScores = rows.map((row) => row.quality).filter((value): value is number => value !== null);
    const grounded = rows.filter((row) => row.grounded);
    const ungrounded = rows.filter((row) => !row.grounded);
    const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const bandCounts = FRESHNESS_ORDER.reduce<Record<string, number>>((acc, band) => {
      acc[band] = rows.filter((row) => row.band === band).length;
      return acc;
    }, {});
    const confidenceRows = distribution(countBy(items, (item) => {
      const value = confidenceValue(item);
      if (value === null) return 'unknown';
      if (value >= 0.75) return 'high';
      if (value >= 0.45) return 'medium';
      return 'low';
    }), ['high', 'medium', 'low', 'unknown']);
    const sourceRows = distribution(countBy(items, (item) => normalized(item.source, 'unknown'))).slice(0, 8);
    const typeRows = distribution(countBy(items, (item) => normalized(item.evidenceType, 'unknown'))).slice(0, 8);
    const sourceQualityRows = sourceRows.map((source) => {
      const sourceMatches = rows.filter((row) => row.source === source.name);
      const quality = avg(sourceMatches.map((row) => row.quality).filter((value): value is number => value !== null));
      return { ...source, quality };
    });
    const trend = buildTrend(items, dateWindow);
    const decayPoints = rows
      .filter((row) => row.ageDays !== null && row.freshness !== null)
      .map((row) => ({
        age: Number(row.ageDays?.toFixed(1)),
        freshness: Number(row.freshness?.toFixed(3)),
        confidence: row.confidence ?? 0,
        source: row.source,
        band: row.band,
      }));
    const staleOrAging = rows.filter((row) => row.band === 'Aging' || row.band === 'Stale');
    const lowQuality = rows.filter((row) => row.quality !== null && row.quality < 0.4);
    const dominantSource = sourceRows[0] ?? null;
    const coveredSignalIds = new Set(rows.map((row) => row.item.signalId).filter(Boolean).map(String));
    const openSignals = signals.filter((signal) => !['resolved', 'closed', 'dismissed'].includes(normalized(signal.status, 'unknown')));
    const highSeverityOpenSignals = openSignals.filter((signal) => ['critical', 'high'].includes(normalized(signal.severity, 'unknown')));
    const evidenceDensity = coveredSignalIds.size > 0 ? rows.length / coveredSignalIds.size : null;
    const signalCoverage = signals.length > 0 ? coveredSignalIds.size / signals.length : null;
    const openSignalCoverage = openSignals.length > 0
      ? openSignals.filter((signal) => coveredSignalIds.has(signal.id)).length / openSignals.length
      : null;
    const sourceConcentration = dominantSource && rows.length > 0 ? dominantSource.value / rows.length : null;
    const staleGrounded = rows.filter((row) => row.grounded && row.band === 'Stale');

    return {
      total: rows.length,
      avgConfidence: avg(confidences),
      avgFreshness: avg(freshnessScores),
      avgAge: avg(ages),
      avgQuality: avg(qualityScores),
      grounded,
      ungrounded,
      bandRows: distribution(bandCounts, FRESHNESS_ORDER),
      confidenceRows,
      sourceRows,
      typeRows,
      sourceQualityRows,
      trend,
      decayPoints,
      staleOrAging,
      lowQuality,
      dominantSource,
      coveredSignalIds,
      openSignals,
      highSeverityOpenSignals,
      evidenceDensity,
      signalCoverage,
      openSignalCoverage,
      sourceConcentration,
      staleGrounded,
    };
  }, [filteredEvidence, dateWindow, signals]);

  const filterOptions = useMemo(() => ({
    sources: Object.keys(countBy(evidence, (item) => normalized(item.source, 'unknown'))).sort(),
    types: Object.keys(countBy(evidence, (item) => normalized(item.evidenceType, 'unknown'))).sort(),
  }), [evidence]);

  const insights = useMemo(() => {
    const groundedRate = model.total ? model.grounded.length / model.total : null;
    /*
      The card labels used to read "Layer 1 - State", "Layer 2 - Movement",
      "Layer 3 - Consequence". Those are the names of an internal reading model,
      not of anything on this screen; an administrator has no way to know that
      Layer 2 is where freshness lives. Each card is now titled by what it is
      about.
    */
    return [
      {
        label: 'What is here',
        title: 'Evidence in view',
        body: model.total === 0
          ? 'No evidence records match the current filters.'
          : `${model.total.toLocaleString()} records, with ${formatPercent(model.avgConfidence)} average stated confidence. ${formatPercent(groundedRate)} of them are attached to a signal.`,
        tone: 'state',
      },
      {
        label: 'How old it is',
        title: 'Freshness',
        body: model.avgAge === null
          ? 'None of these records carry an observation date, so their age cannot be measured.'
          : `The average record was observed ${formatDays(model.avgAge)} ago. Evidence is treated as half as strong every 90 days, which puts average freshness at ${formatPercent(model.avgFreshness)}.`,
        tone: 'movement',
      },
      {
        label: 'What it proves',
        title: 'Unattached evidence',
        body: model.ungrounded.length > 0
          ? `${model.ungrounded.length.toLocaleString()} records are not attached to any signal. Until they are, nothing can cite them as support.`
          : 'Every record in view is attached to a signal.',
        tone: model.ungrounded.length > 0 ? 'impact' : 'state',
      },
      {
        label: 'How strong it is',
        title: 'Weak support',
        body: model.lowQuality.length > 0
          ? `${model.lowQuality.length.toLocaleString()} records are either low-confidence, or old enough that their freshness has decayed. Both weaken anything built on them.`
          : `Average strength is ${formatPercent(model.avgQuality)} once confidence is weighted by how recently each was observed.`,
        tone: model.lowQuality.length > 0 ? 'impact' : 'movement',
      },
      {
        label: 'What is covered',
        title: 'Signals with evidence',
        body: signals.length === 0
          ? 'No signals exist for this organization, so there is nothing for evidence to cover yet.'
          : `${model.coveredSignalIds.size.toLocaleString()} of ${signals.length.toLocaleString()} signals have at least one evidence record. Among still-open signals, ${formatPercent(model.openSignalCoverage)} are covered.`,
        tone: model.openSignalCoverage !== null && model.openSignalCoverage >= 0.75 ? 'state' : 'impact',
      },
    ] as Array<{ label: string; title: string; body: string; tone: 'state' | 'movement' | 'impact' }>;
  }, [model, signals.length]);

  const summarizeWithAI = async (item: Evidence) => {
    setSummarizingId(item.id);
    try {
      const result = await aiApi.summarizeEvidence(contentText(item), item.id);
      if ('summary' in result) {
        showToast('info', result.summary);
      } else {
        showToast(result.providerConfigured ? 'error' : 'warning', result.error);
      }
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Unable to summarize evidence.');
    } finally {
      setSummarizingId(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.collectEvidence({
        tenantId,
        signalId: form.signalId || undefined,
        source: form.source,
        content: { note: form.content },
        provenance: { source: form.source, ts: new Date().toISOString(), confidence: Number(form.confidence) },
        confidence: Number(form.confidence),
      });
      setForm({ signalId: '', source: 'internal', content: '', confidence: '0.7' });
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to collect evidence.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSourceFilter('');
    setTypeFilter('');
    setFreshnessFilter('');
    setGroundingFilter('');
    setDateWindow('180');
  };

  const visibleLabel = `${model.total.toLocaleString()} of ${evidence.length.toLocaleString()} records`;

  return (
    <div className="evidence-intel">
      <header className="evidence-intel__header">
        <span className="eb-page-kicker">Intelligence Loop</span>
        <h1>Evidence &amp; Provenance</h1>
        <p>What supports each signal this organization has raised — where it came from, when it was observed, and how firmly it is held.</p>
        <div className="evidence-intel__actions">
          <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : '+ Add evidence'}</button>
          <button className="evidence-intel__refresh" onClick={load} disabled={refreshing} title="Refresh evidence">
            <RefreshCw size={15} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {showForm && (
        <form onSubmit={submit} className="evidence-intel__form">
          <input placeholder="Signal ID" value={form.signalId} onChange={(e) => setForm({ ...form, signalId: e.target.value })} />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="internal">Internal</option>
            <option value="market_report">Market Report</option>
            <option value="competitor_data">Competitor Data</option>
            <option value="news">News</option>
            <option value="regulatory">Regulatory</option>
          </select>
          <textarea placeholder="What does this evidence show?" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
          <label>
            Confidence: {form.confidence}
            <input type="range" min="0" max="1" step="0.05" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
        </form>
      )}

      <section className="evidence-intel__filters" aria-label="Evidence filters">
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {filterOptions.sources.map((source) => <option key={source} value={source}>{displayLabel(source)}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {filterOptions.types.map((type) => <option key={type} value={type}>{displayLabel(type)}</option>)}
        </select>
        <select value={freshnessFilter} onChange={(e) => setFreshnessFilter(e.target.value)}>
          <option value="">All freshness bands</option>
          {FRESHNESS_ORDER.map((band) => <option key={band} value={band}>{band}</option>)}
        </select>
        <select value={groundingFilter} onChange={(e) => setGroundingFilter(e.target.value)}>
          <option value="">Grounded and ungrounded</option>
          <option value="grounded">Grounded</option>
          <option value="ungrounded">Ungrounded</option>
        </select>
        <select value={dateWindow} onChange={(e) => setDateWindow(e.target.value as DateWindow)}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="all">All time</option>
        </select>
        <button className="evidence-intel__ghost" onClick={clearFilters}>Reset</button>
        <span className="evidence-intel__count">{visibleLabel}</span>
      </section>

      {error && <div className="evidence-intel__error">{error}</div>}

      <section className="evidence-intel__kpis">
        <Kpi icon={<Database size={18} />} label="Records" value={model.total.toLocaleString()} hint={visibleLabel} tone="state" />
        <Kpi icon={<ShieldCheck size={18} />} label="Average confidence" value={formatPercent(model.avgConfidence)} hint="As stated by the source" tone={model.avgConfidence !== null && model.avgConfidence >= 0.75 ? 'good' : 'warn'} />
        <Kpi icon={<FileCheck2 size={18} />} label="Recently observed" value={(model.bandRows.find((row) => row.name === 'Fresh')?.value ?? 0).toLocaleString()} hint="Within the last two weeks" tone="good" />
        <Kpi icon={<Clock3 size={18} />} label="Getting old" value={(model.bandRows.find((row) => row.name === 'Aging')?.value ?? 0).toLocaleString()} hint="Roughly 2 to 4 months ago" tone="warn" />
        <Kpi icon={<Archive size={18} />} label="Out of date" value={(model.bandRows.find((row) => row.name === 'Stale')?.value ?? 0).toLocaleString()} hint="Older than about four months" tone={(model.bandRows.find((row) => row.name === 'Stale')?.value ?? 0) > 0 ? 'crit' : 'good'} />
        <Kpi icon={<Link2 size={18} />} label="Attached to a signal" value={formatPercent(model.total ? model.grounded.length / model.total : null)} hint={`${model.ungrounded.length.toLocaleString()} not attached`} tone={model.ungrounded.length > 0 ? 'warn' : 'good'} />
        <Kpi icon={<Brain size={18} />} label="Overall strength" value={formatPercent(model.avgQuality)} hint="Confidence, weighted by how recent" tone={model.avgQuality !== null && model.avgQuality >= 0.5 ? 'good' : 'warn'} />
      </section>

      <section className="evidence-intel__summary">
        {insights.map((insight) => (
          <article className={`evidence-intel__summary-card evidence-intel__summary-card--${insight.tone}`} key={insight.title}>
            <div className="evidence-intel__summary-label">{insight.label}</div>
            <h2>{insight.title}</h2>
            <p>{insight.body}</p>
          </article>
        ))}
      </section>

      {loading ? (
        <div className="evidence-intel__loading">Loading evidence...</div>
      ) : (
        <>
          <section className="evidence-intel__grid evidence-intel__grid--wide-left">
            <ChartCard title="Freshness Decay" meta={`0.5 ^ (age / ${HALF_LIFE_DAYS} days)`} footer="Every evidence item is plotted against the same freshness curve used by reasoning.">
              {model.decayPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 12, right: 24, bottom: 18, left: 6 }}>
                    <CartesianGrid stroke="var(--border-subtle)" />
                    <XAxis type="number" dataKey="age" name="Age" unit="d" tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="freshness" name="Freshness" domain={[0, 1]} tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} formatter={(value: unknown, name: unknown) => [Number(value ?? 0), String(name)]} />
                    <Scatter data={model.decayPoints}>
                      {model.decayPoints.map((point, index) => <Cell key={`${point.age}-${index}`} fill={FRESHNESS_COLORS[point.band]} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Freshness Bands" meta={`${model.total.toLocaleString()} records`} footer={`${model.staleOrAging.length.toLocaleString()} records are aging or stale in the current view.`}>
              <HorizontalBars rows={model.bandRows} colorFor={(name) => FRESHNESS_COLORS[name as FreshnessBand] ?? 'var(--content-tertiary)'} />
            </ChartCard>
          </section>

          <section className="evidence-intel__grid evidence-intel__grid--thirds">
            <PieCard title="Confidence Distribution" rows={model.confidenceRows} colorFor={(name) => CONFIDENCE_COLORS[name] ?? CONFIDENCE_COLORS.unknown} />
            <DistributionCard title="Source Distribution" rows={model.sourceRows} colorFor={(_, index) => PALETTE[index % PALETTE.length]} />
            <DistributionCard title="Evidence Type Mix" rows={model.typeRows} colorFor={(_, index) => PALETTE[(index + 2) % PALETTE.length]} />
          </section>

          <section className="evidence-intel__grid evidence-intel__grid--two">
            <ChartCard title="Evidence Collected Over Time" meta={dateWindow === 'all' ? 'all available records' : `last ${dateWindow} days`} footer={`Dominant source: ${model.dominantSource ? displayLabel(model.dominantSource.name) : 'none'}.`}>
              {model.trend.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={model.trend}>
                    <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                    <Line type="monotone" dataKey="count" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Source Reliability" meta="quality by source" footer="Reliability is derived from average confidence multiplied by freshness for records from each source.">
              {model.sourceQualityRows.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={model.sourceQualityRows} layout="vertical" margin={{ left: 12, right: 28 }}>
                    <CartesianGrid stroke="var(--border-subtle)" horizontal={false} />
                    <XAxis type="number" domain={[0, 1]} hide />
                    <YAxis type="category" dataKey="name" width={112} tickFormatter={displayLabel} tick={{ fill: 'var(--content-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} formatter={(value: unknown) => [formatPercent(Number(value ?? 0)), 'Quality']} labelFormatter={(value: unknown) => displayLabel(String(value ?? ''))} />
                    <Bar dataKey="quality" radius={[0, 5, 5, 0]} fill="var(--chart-1)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </section>

          <section className="evidence-intel__review">
            <div className="evidence-intel__review-main">
              <div className="evidence-intel__card-head">
                <h2>Evidence records</h2>
                <span>{visibleLabel}</span>
              </div>
              {filteredEvidence.length === 0 ? <EmptyChart /> : (
                <div className="evidence-intel__ledger">
                  {filteredEvidence.slice(0, 12).map((row) => (
                    <article className="evidence-intel__ledger-card" key={row.item.id}>
                      <div className="evidence-intel__ledger-head">
                        <span className="evidence-intel__freshness" style={{ color: FRESHNESS_COLORS[row.band], backgroundColor: `${FRESHNESS_COLORS[row.band]}1f` }}>{row.band}</span>
                        <strong>{displayLabel(row.source)}</strong>
                        <em>{formatPercent(row.confidence)} confidence</em>
                      </div>
                      <p>{contentText(row.item)}</p>
                      <div className="evidence-intel__ledger-foot">
                        <span>{displayLabel(row.type)}</span>
                        <span>{row.ageDays === null ? 'No observation date' : `Observed ${formatDays(row.ageDays)} ago`}</span>
                        {row.item.signalId ? (
                          onNavigate
                            ? <button onClick={() => onNavigate('signals')} title="Open the Signals screen">Supports a signal</button>
                            : <span>Supports a signal</span>
                        ) : (
                          <span className="evidence-intel__unattached">Not attached to a signal</span>
                        )}
                        <button onClick={() => summarizeWithAI(row.item)} disabled={summarizingId === row.item.id}>
                          {summarizingId === row.item.id ? 'Summarising…' : 'Summarise'}
                        </button>
                      </div>
                    </article>
                  ))}
                  {filteredEvidence.length > 12 && (
                    <p className="evidence-intel__ledger-note">
                      Showing the 12 most recent of {filteredEvidence.length.toLocaleString()}. Narrow the filters above to see others.
                    </p>
                  )}
                </div>
              )}
            </div>
            <aside className="evidence-intel__risk-panel">
              <h2>Not attached to a signal</h2>
              <div className="evidence-intel__gap-number">{model.ungrounded.length.toLocaleString()}</div>
              <p>Nothing can cite these as support until they are attached to the signal they explain.</p>
              <h2>Attached, but out of date</h2>
              <div className="evidence-intel__gap-number">{model.staleGrounded.length.toLocaleString()}</div>
              <p>These look like support but were observed long enough ago that they may no longer describe the situation.</p>
              <h2>Weak on their own</h2>
              <div className="evidence-intel__gap-number">{model.lowQuality.length.toLocaleString()}</div>
              <p>Low stated confidence, or old, or both. These need re-observing before much is built on them.</p>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'state' | 'good' | 'warn' | 'crit' }) {
  return (
    <article className="evidence-intel__kpi" data-tone={tone}>
      <div className="evidence-intel__kpi-icon">{icon}</div>
      <div className="evidence-intel__kpi-label">{label}</div>
      <div className="evidence-intel__kpi-value">{value}</div>
      <div className="evidence-intel__kpi-hint">{hint}</div>
    </article>
  );
}

function ChartCard({ title, meta, footer, children }: { title: string; meta: string; footer?: string; children: ReactNode }) {
  return (
    <article className="evidence-intel__card">
      <div className="evidence-intel__card-head">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      <div className="evidence-intel__chart">{children}</div>
      {footer && <div className="evidence-intel__card-foot"><Sparkles size={14} /> {footer}</div>}
    </article>
  );
}

function HorizontalBars({ rows, colorFor }: { rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  if (rows.length === 0) return <EmptyChart />;
  return (
    <div className="evidence-intel__bars">
      {rows.map((row, index) => (
        <div className="evidence-intel__bar-row" key={row.name}>
          <span>{displayLabel(row.name)}</span>
          <div><i style={{ width: `${Math.max(row.percent * 100, row.value > 0 ? 2 : 0)}%`, backgroundColor: colorFor(row.name, index) }} /></div>
          <strong>{row.value.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
}

function DistributionCard({ title, rows, colorFor }: { title: string; rows: DistributionRow[]; colorFor: (name: string, index: number) => string }) {
  return (
    <ChartCard title={title} meta={`${rows.length.toLocaleString()} groups`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <div className="evidence-intel__distribution">
          {rows.map((row, index) => (
            <div className="evidence-intel__dist-row" key={row.name}>
              <div>
                <span style={{ backgroundColor: colorFor(row.name, index) }} />
                <strong>{displayLabel(row.name)}</strong>
              </div>
              <div className="evidence-intel__dist-track"><i style={{ width: `${row.percent * 100}%`, backgroundColor: colorFor(row.name, index) }} /></div>
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
    <ChartCard title={title} meta={`${rows.reduce((sum, row) => sum + row.value, 0).toLocaleString()} records`}>
      {rows.length === 0 ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={2}>
              {rows.map((row, index) => <Cell key={row.name} fill={colorFor(row.name, index)} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border-subtle)' }} formatter={(value: unknown) => [Number(value ?? 0), 'Records']} labelFormatter={(value: unknown) => displayLabel(String(value ?? ''))} />
            <Legend formatter={(value) => displayLabel(String(value))} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function EmptyChart() {
  return <div className="evidence-intel__empty">No data in the current filter.</div>;
}
