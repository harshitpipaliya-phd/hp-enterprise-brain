import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type {
  EvidenceRef,
  Gap,
  OrganizationalState,
  Recommendation,
  RecommendationsResponse,
  Risk,
  StateDimension,
} from '../../api/organizationIntelligence';
import type { View } from '../../App';
import './OrganizationIntelligenceSection.css';

/**
 * ORGANIZATION INTELLIGENCE — the full-width middle band of the organization
 * overview.
 *
 * A PRESENTATION LAYER, NOT A SECOND ENGINE. Every sentence, count and
 * percentage on this panel is read from four endpoints the existing
 * IntelligenceEngine already publishes for the current tenant:
 *
 *   /organization-intelligence/{tenantId}/state            → health, narrative, strengths
 *   /organization-intelligence/{tenantId}/gaps             → key findings
 *   /organization-intelligence/{tenantId}/risks            → risks
 *   /organization-intelligence/{tenantId}/recommendations  → opportunities, actions
 *
 * Nothing here computes an assessment. The one arithmetic operation in this file
 * is score x 100 for the meter, because the server publishes the composite as a
 * fraction and a reader reads percentages. No default is substituted for a null:
 * a health score the engine could not measure is rendered as the sentence saying
 * so, never as a zero and never as an invented figure.
 *
 * TENANT SCOPE IS THE SERVER'S. `tenantId` is the organization currently
 * selected in the shell; the API layer sends it on the path and
 * EnsureTenantScope re-derives the real scope from the token, so this panel
 * cannot widen it. Changing organization changes the prop, which re-runs the
 * load and clears the previous organization's answer first — organization A's
 * intelligence is never on screen for organization B.
 *
 * NOTHING IS HARDCODED TO AN ORGANIZATION. There is not an organization name, an
 * id, an industry or a count anywhere in this file. An organization with no
 * operational records renders the same component and gets the engine's own
 * explanation of why each band is empty.
 */

interface Props {
  tenantId: string;
  onNavigate: (view: View) => void;
}

interface Loaded {
  state: OrganizationalState | null;
  gaps: Gap[];
  risks: Risk[];
  recommendations: RecommendationsResponse | null;
}

const EMPTY: Loaded = { state: null, gaps: [], risks: [], recommendations: null };

/** How many rows each band shows. An executive reading, not a register. */
const FINDINGS = 3;
const STRENGTHS = 3;
const RISKS = 3;
const OPPORTUNITIES = 3;
const ACTIONS = 4;

/** Risk states that describe history rather than live exposure. */
const CLOSED_RISK_STATES = ['mitigated', 'closed', 'resolved', 'accepted'];

export default function OrganizationIntelligenceSection({ tenantId, onNavigate }: Props) {
  const [data, setData] = useState<Loaded>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh: boolean, alive: () => boolean) => {
    if (fresh) setRefreshing(true);
    setError(null);

    /*
      FOUR REQUESTS, ONE COMPUTATION. Each endpoint returns a slice of the same
      per-tenant intelligence the engine composes once and caches against a
      fingerprint of the source rows, so asking for four slices costs one
      compute — and asking for the single combined payload would ship the risk
      matrix and the decision quadrants this band never draws.

      allSettled rather than all: a band whose endpoint fails renders its own
      reason instead of taking the whole section down. The health meter is worth
      showing even when the risk register is not answering.
    */
    const [stateRes, gapsRes, risksRes, recsRes] = await Promise.allSettled([
      organizationIntelligenceApi.getState(tenantId, fresh),
      organizationIntelligenceApi.getGaps(tenantId, fresh),
      organizationIntelligenceApi.getRisks(tenantId, fresh),
      organizationIntelligenceApi.getRecommendations(tenantId, fresh),
    ]);

    if (!alive()) return;

    setData({
      state: stateRes.status === 'fulfilled' ? stateRes.value : null,
      gaps: gapsRes.status === 'fulfilled' ? asArray<Gap>((gapsRes.value as { gaps?: Gap[] }).gaps) : [],
      risks: risksRes.status === 'fulfilled' ? asArray<Risk>((risksRes.value as { risks?: Risk[] }).risks) : [],
      recommendations: recsRes.status === 'fulfilled' ? recsRes.value : null,
    });

    // Only an outright failure of the two endpoints that carry the reading is
    // worth an error line. One empty band explains itself.
    if (stateRes.status === 'rejected' && recsRes.status === 'rejected') {
      setError(messageOf(stateRes.reason) || 'This organization’s intelligence could not be read.');
    }

    setLoading(false);
    setRefreshing(false);
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(EMPTY);
    void load(false, () => !cancelled);
    return () => { cancelled = true; };
  }, [load]);

  const overall = data.state?.state?.overall ?? null;
  const healthPct = overall?.score === null || overall?.score === undefined
    ? null
    : Math.round(overall.score * 100);

  const narrative = asArray<string>(data.state?.state?.headline);

  /*
    THE ORDER IS THE SERVER'S. `rank` is the engine's priority ordering —
    severity against tractability, published with the payload — so the top
    actions are the engine's top actions rather than this panel's opinion.
  */
  const ranked = [...asArray<Recommendation>(data.recommendations?.recommendations)]
    .sort((a, b) => a.rank - b.rank);
  const actions = ranked.slice(0, ACTIONS);

  /*
    OPPORTUNITIES ARE THE UPSIDE THAT IS NOT ALREADY IN THE ACTION LIST.

    A partition, not a second ranking: anything printed under Recommended
    actions is excluded, so the two bands never restate each other. What remains
    is ordered by how well its benefit is supported — an Observed benefit is a
    measurement, a Projected one is a projection — because an opportunity whose
    upside can be shown from records is worth reading before one whose cannot.
  */
  const taken = new Set(actions.map((a) => a.id));
  const opportunities = ranked
    .filter((rec) => !taken.has(rec.id))
    .sort((a, b) => benefitRank(b.benefit?.label) - benefitRank(a.benefit?.label))
    .slice(0, OPPORTUNITIES);

  const findings = [...data.gaps].sort((a, b) => b.severity - a.severity).slice(0, FINDINGS);
  const strengths = asArray<StateDimension>(data.state?.state?.strengths).slice(0, STRENGTHS);
  const openRisks = data.risks
    .filter((risk) => !CLOSED_RISK_STATES.includes(String(risk.state ?? '').toLowerCase()))
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, RISKS);

  const measured = overall
    ? `${overall.dimensionsMeasured} of ${overall.dimensionsMeasured + overall.dimensionsUnmeasured} dimensions measured`
    : null;

  const anything = healthPct !== null || narrative.length > 0 || findings.length > 0
    || strengths.length > 0 || openRisks.length > 0 || opportunities.length > 0 || actions.length > 0;

  return (
    <section className="orgi" aria-labelledby="orgi-title">
      <div className="orgi__head">
        <div>
          <span className="orgi__kicker">Organization intelligence</span>
          <h2 id="orgi-title">What the organization&rsquo;s data is telling us.</h2>
        </div>
        <div className="orgi__head-actions">
          {data.state?.computedAt && (
            <span className="orgi__stamp" title={`Data version ${data.state.dataVersion}`}>
              Derived {formatWhen(data.state.computedAt)}
            </span>
          )}
          <button
            type="button"
            className="orgi__refresh"
            onClick={() => void load(true, () => true)}
            disabled={refreshing || loading}
          >
            <RefreshCw size={14} className={refreshing ? 'orgi-spin' : ''} aria-hidden="true" /> Recompute
          </button>
        </div>
      </div>

      {loading ? (
        <div className="orgi__placeholder" role="status">
          <span className="orgi__pulse" aria-hidden="true" />
          Reading this organization&rsquo;s records&hellip;
        </div>
      ) : error && !anything ? (
        <div className="orgi__placeholder orgi__placeholder--warn">
          <AlertTriangle size={18} aria-hidden="true" />
          {error}
        </div>
      ) : !anything ? (
        <div className="orgi__placeholder">
          Nothing has been recorded for this organization yet, so there is nothing to interpret. Import a
          source file to give the intelligence loop something to read.
        </div>
      ) : (
        <>
          {/* ── Band 1 · health and the executive reading ─────────────────── */}
          <div className="orgi__band orgi__band--summary">
            <div className="orgi__health">
              <span className="orgi__label">Overall organizational health</span>
              {healthPct === null ? (
                <>
                  <p className="orgi__unavailable">Health score unavailable — insufficient evidence</p>
                  {overall?.why && <p className="orgi__health-why">{overall.why}</p>}
                </>
              ) : (
                <>
                  <div className="orgi__figure">
                    <strong>{healthPct}<span>%</span></strong>
                    <em data-tone={healthTone(healthPct)}>{sentence(overall?.band)}</em>
                  </div>
                  <div
                    className="orgi__meter"
                    role="img"
                    aria-label={`Overall organizational health ${healthPct} percent`}
                  >
                    <span style={{ width: `${healthPct}%` }} data-tone={healthTone(healthPct)} />
                  </div>
                  <p className="orgi__health-meta">
                    {measured}
                    {overall?.stage ? ` · ${sentence(overall.stage)} stage` : ''}
                  </p>
                  {overall?.why && <p className="orgi__health-why">{overall.why}</p>}
                </>
              )}
            </div>

            <div className="orgi__narrative">
              <span className="orgi__label">What is happening</span>
              {narrative.length === 0 ? (
                <p className="orgi__muted">
                  The engine has no standing observation about this organization yet — nothing it reads has
                  produced a pattern to summarise.
                </p>
              ) : (
                narrative.map((line) => <p key={line}>{line}</p>)
              )}
            </div>
          </div>

          {/* ── Band 2 · key findings ─────────────────────────────────────── */}
          {findings.length > 0 && (
            <div className="orgi__band">
              <span className="orgi__label">Key findings</span>
              <div className="orgi__findings" role="list" aria-label="Key findings">
                {findings.map((gap) => (
                  <article key={gap.id} role="listitem" className="orgi__finding" data-tone={bandTone(gap.band)}>
                    <header>
                      <span className="orgi__chip" data-tone={bandTone(gap.band)}>{sentence(gap.band)}</span>
                      <span className="orgi__area">{humanize(gap.area)}</span>
                    </header>
                    <h3>{gap.title}</h3>
                    <p className="orgi__note"><em>Why it matters</em> {gap.whyItMatters}</p>
                    <Evidence items={gap.evidence} />
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ── Band 3 · strengths | risks | opportunities ────────────────── */}
          <div className="orgi__band orgi__band--three">
            <Column
              icon={<CheckCircle2 size={15} aria-hidden="true" />}
              tone="good"
              title="Strengths"
              count={strengths.length}
              empty="No dimension of this organization scores highly enough yet to be reported as a strength."
            >
              {strengths.map((dimension) => (
                <li key={dimension.key}>
                  <strong>{strengthHeadline(dimension)}</strong>
                  <p>{dimension.why}</p>
                  {evidenceOf(dimension) && <small><em>Evidence</em> {evidenceOf(dimension)}</small>}
                </li>
              ))}
            </Column>

            <Column
              icon={<ShieldAlert size={15} aria-hidden="true" />}
              tone="crit"
              title="Risks"
              count={openRisks.length}
              empty="No open risk has been detected or registered against this organization's records."
            >
              {openRisks.map((risk) => (
                <li key={risk.id}>
                  <strong>{risk.title}</strong>
                  <p>{risk.detail}</p>
                  {risk.recommendedAction && (
                    <small><em>Recommended action</em> {risk.recommendedAction}</small>
                  )}
                  <Evidence items={risk.evidence} />
                  <span className="orgi__owner">
                    {risk.owner
                      ? `Owner: ${risk.owner}`
                      : risk.registered
                        ? 'Registered, no owner assigned'
                        : 'Detected on read, not yet registered to an owner'}
                  </span>
                </li>
              ))}
            </Column>

            <Column
              icon={<Sparkles size={15} aria-hidden="true" />}
              tone="state"
              title="Opportunities"
              count={opportunities.length}
              empty="Every improvement the engine can propose is already listed as a recommended action below."
            >
              {opportunities.map((rec) => (
                <li key={rec.id}>
                  <strong>{rec.recommendation}</strong>
                  <p>{rec.why}</p>
                  <small><em>Potential benefit</em> {benefitStatement(rec)}</small>
                </li>
              ))}
            </Column>
          </div>

          {/* ── Band 4 · recommended actions ──────────────────────────────── */}
          {actions.length > 0 && (
            <div className="orgi__band">
              <div className="orgi__band-head">
                <span className="orgi__label">Recommended actions</span>
                <button type="button" className="orgi__more" onClick={() => onNavigate('deliberation')}>
                  Open deliberation <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
              <ol className="orgi__actions" aria-label="Recommended actions">
                {actions.map((rec, index) => (
                  <li key={rec.id}>
                    <span className="orgi__rank" aria-hidden="true">{index + 1}</span>
                    <div className="orgi__action-body">
                      <div className="orgi__action-head">
                        <h3>{rec.recommendation}</h3>
                        <span className="orgi__chip" data-tone={priorityTone(rec.priority)}>
                          {sentence(rec.priority)} priority
                        </span>
                      </div>
                      {rec.finding && <p className="orgi__note"><em>What was observed</em> {rec.finding}</p>}
                      <p className="orgi__note"><em>Why</em> {rec.why}</p>
                      <p className="orgi__note"><em>Next step</em> {rec.nextAction}</p>
                      <div className="orgi__action-meta">
                        <span className="orgi__area">{humanize(rec.area)}</span>
                        <span className="orgi__area">{benefitStatement(rec)}</span>
                        <Evidence items={rec.evidence} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="orgi__foot">
            <Lightbulb size={13} aria-hidden="true" />
            Every statement above is derived from this organization&rsquo;s own records by the intelligence
            engine. Where a measure had no input it is reported as unmeasured rather than as zero.
          </p>
        </>
      )}
    </section>
  );
}

/* ─────────────────────────── pieces ─────────────────────────── */

function Column({
  icon, title, tone, empty, count, children,
}: {
  icon: ReactNode;
  title: string;
  tone: 'good' | 'crit' | 'state';
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="orgi__col" data-tone={tone} aria-label={title}>
      <header>
        <span className="orgi__col-icon" data-tone={tone}>{icon}</span>
        <span className="orgi__label">{title}</span>
      </header>
      {count === 0 ? <p className="orgi__muted">{empty}</p> : <ul className="orgi__col-list">{children}</ul>}
    </section>
  );
}

/**
 * Evidence, as counted rows rather than as a claim.
 *
 * `what` is written by the engine in business words ("departments with no
 * manager"); the count beside it is the number of rows that satisfied it. The
 * table name the ref also carries is deliberately not drawn — a reader is being
 * shown what was counted, not where it is stored.
 */
function Evidence({ items }: { items?: EvidenceRef[] }) {
  const rows = asArray<EvidenceRef>(items).filter((ref) => ref && ref.what);
  if (rows.length === 0) return null;

  return (
    <ul className="orgi__evidence">
      {rows.slice(0, 3).map((ref) => (
        <li key={`${ref.what}-${ref.count}`}>
          <b>{Number(ref.count ?? 0).toLocaleString()}</b> {ref.what}
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────── language ─────────────────────────── */

/**
 * Rule keys, column names and dataset keys into words.
 *
 * The engine's titles and reasons are already written in business language; what
 * still arrives machine-shaped is the odd identifier — an `area` of
 * `complaint_records`, a band of `high`. This is the one place they are turned
 * into something a reader can read, and it is presentation only: nothing
 * downstream keys off the result.
 */
function humanize(value: string | null | undefined): string {
  if (!value) return 'Organization-wide';
  const words = String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return words === '' ? 'Organization-wide' : words.charAt(0).toUpperCase() + words.slice(1);
}

function sentence(value: string | null | undefined): string {
  if (!value) return '';
  const text = String(value).replace(/[_-]+/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A strength is named by the loop dimension it was measured on. */
function strengthHeadline(dimension: StateDimension): string {
  const label = sentence(dimension.label);
  return dimension.score === null ? label : `${label} — ${Math.round(dimension.score * 100)}%`;
}

/**
 * The strongest measured factor behind a dimension's score, in the engine's own
 * words. Chosen by value rather than by weight: what is quoted as evidence for a
 * strength should be the thing that is actually true of the organization.
 */
function evidenceOf(dimension: StateDimension): string | null {
  const measured = asArray<{ value: number | null; basis?: string }>(dimension.factors)
    .filter((factor) => factor.value !== null);
  if (measured.length === 0) return null;
  const best = measured.reduce((a, b) => ((b.value ?? 0) > (a.value ?? 0) ? b : a));
  return best.basis ?? null;
}

/**
 * The benefit sentence, with the honesty label attached.
 *
 * An absent or Unknown benefit is reported as unestimable rather than dressed
 * up: the engine does not cost actions, and a number invented here would be
 * indistinguishable from one it had measured.
 */
function benefitStatement(rec: Recommendation): string {
  const benefit = rec.benefit;
  if (!benefit || !benefit.statement || benefit.label === 'Unknown') {
    return 'Financial impact cannot be estimated from available data.';
  }
  return `${benefit.label}: ${benefit.statement}`;
}

function benefitRank(label: string | undefined): number {
  return ({ Observed: 3, Estimated: 2, Projected: 1 } as Record<string, number>)[label ?? ''] ?? 0;
}

/* ─────────────────────────── tones ─────────────────────────── */

function healthTone(pct: number): 'good' | 'warn' | 'crit' {
  return pct >= 70 ? 'good' : pct >= 40 ? 'warn' : 'crit';
}

function bandTone(band: string | undefined): 'good' | 'warn' | 'crit' | 'state' {
  switch (String(band ?? '').toLowerCase()) {
    case 'critical': return 'crit';
    case 'high': return 'warn';
    case 'medium': return 'state';
    default: return 'good';
  }
}

function priorityTone(priority: string | undefined): 'good' | 'warn' | 'crit' | 'state' {
  switch (String(priority ?? '').toLowerCase()) {
    case 'critical': return 'crit';
    case 'high': return 'warn';
    case 'medium': return 'state';
    default: return 'good';
  }
}

/* ─────────────────────────── plumbing ─────────────────────────── */

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : '';
}

function formatWhen(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
