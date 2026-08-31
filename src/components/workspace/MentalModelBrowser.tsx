import { useCallback, useEffect, useState } from 'react';
import { Notebook } from 'lucide-react';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type { KnowledgeIntelligence, KnowledgeDomain } from '../../api/organizationIntelligence';
import {
  LayerStrip, StateLayer, MovementLayer, ConsequenceLayer, LayerFigure, LayerPoints,
  ConsequenceEmpty, Panel, Quadrant, Sparkline, ScoreBars, NullLegend, Button, Spinner, ErrorState,
} from '../../ui';
import {
  ConfidenceBar, ProvenanceDetails, IntelligenceHeader, DerivationFooter, ExecutiveInterpretationPanel, pct, num, count,
} from './intelligenceUi';
import './OrganizationIntelligence.css';

/**
 * Organizational Knowledge — "What does this organization genuinely know, and how
 * hard-earned is that knowledge?"
 *
 * WHAT REPLACED WHAT. This screen used to list rows from hpbrain_mental_models. That
 * table is empty for every organization in this installation, so the screen rendered
 * one sentence explaining that mental models appear once a reusable Learning is
 * captured — technically true, and useless to an organization holding 96,000
 * operational records it had learned nothing visible from. Knowledge is now derived
 * from those records: recurring patterns, in domains, with earned confidence.
 * Mental models still appear when they exist, as their own source.
 *
 * THE SCREEN ANSWERS ONE QUESTION, in three layers. State: how many domains and how
 * well established. Movement: which bodies of work are growing or shrinking, tested
 * against their own noise. Consequence: which knowledge is fragile, where the blind
 * spots are, and what to learn next. Nothing on it is computed here — every figure
 * arrives derived, with its provenance attached.
 *
 * FRAGILE KNOWLEDGE IS THE POINT OF THE QUADRANT. Confidence against pattern count,
 * bubble area by reinforcement: a domain high on confidence with two patterns behind
 * it is a different asset from one earned over thirty, and a single confidence column
 * cannot tell them apart.
 */
export default function MentalModelBrowser({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<KnowledgeIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await organizationIntelligenceApi.getKnowledge(tenantId, fresh));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load organizational knowledge.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) {
    return <div className="oi-page"><Spinner label="Deriving organizational knowledge from the record base" /></div>;
  }

  if (error) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!data) return null;

  const { state, domains, evidence, blindSpots, learnNext, definitions, trends, concentrations } = data;

  const measured = domains.filter((d) => d.confidence.value !== null);
  const fragile = domains.filter((d) => d.fragile);
  const maxPatterns = Math.max(1, ...domains.map((d) => d.patterns));
  const maxReinforcement = Math.max(1, ...domains.map((d) => d.reinforcement));

  // Movement lines the organization can be said to have. `flat` is kept out: a
  // slope that does not clear its own standard error is not movement, and listing
  // it as such is how a reader ends up chasing a random walk.
  const moving = trends.filter((t) => t.direction !== 'flat');

  return (
    <div className="oi-page">
      <IntelligenceHeader
        title="Organizational Knowledge"
        icon={<Notebook />}
        question="The organization's accumulated knowledge, relationships and institutional memory."
        meta={data}
        actions={<Button variant="secondary" onClick={() => void load(true)} disabled={loading}>Recompute</Button>}
      />

      <LayerStrip>
        <StateLayer>
          <LayerFigure
            value={state.domains}
            unit={state.domains === 1 ? ' domain' : ' domains'}
            note={
              state.domains === 0
                ? 'No body of recorded work is classified well enough to describe a domain.'
                : `${count(state.patterns)} recurring patterns, reinforced ${count(state.reinforcement)} times across them. ${state.wellEarned} well established, ${state.fragile} fragile.`
            }
          />
        </StateLayer>

        <MovementLayer>
          {moving.length === 0 ? (
            <ConsequenceEmpty
              missing="a body of work whose month-on-month slope clears its own standard error"
              produces="Every series this organization has is statistically flat. That is a finding, not an absence of data — nothing is measurably growing or shrinking."
            />
          ) : (
            <LayerPoints
              points={moving.slice(0, 3).map((t) => (
                <>
                  <strong>{t.area}</strong> — {t.label.toLowerCase()} is {t.direction}
                  {t.changePct !== null ? ` ${Math.abs(t.changePct).toFixed(0)}%` : ''} across {t.periods} months
                  {' '}(t={num(t.significance)}, r²={t.fitQuality === null ? 'n/a' : num(t.fitQuality)}).
                </>
              ))}
            />
          )}
        </MovementLayer>

        <ConsequenceLayer>
          {fragile.length === 0 && blindSpots.length === 0 ? (
            <ConsequenceEmpty
              missing="a fragile domain or a recorded blind spot"
              produces="Every domain clears the confidence and pattern-count floor, and every classifier column varies. Nothing here needs attention."
            />
          ) : (
            <LayerPoints
              points={[
                ...fragile.slice(0, 2).map((d) => (
                  <>
                    <strong>Fragile:</strong> {d.domain} — {d.fragileReasons.join('; ')}.
                  </>
                )),
                ...blindSpots.slice(0, 2).map((b) => (
                  <>
                    <strong>Blind spot:</strong> {b.title}.
                  </>
                )),
                ...(learnNext[0]
                  ? [<><strong>Learn next:</strong> {learnNext[0].domain} — {learnNext[0].reason}</>]
                  : []),
              ]}
            />
          )}
        </ConsequenceLayer>
      </LayerStrip>

      <div className="oi-sections" style={{ marginBottom: 18 }}>
        <ExecutiveInterpretationPanel interpretation={data.interpretation} />
      </div>

      <div className="oi-sections">
        <div className="bl-grid bl-grid--wide-left">
          <Panel
            title="Knowledge by domain"
            hint="bubble area = reinforcement count"
            footnote={
              <>
                A domain reinforced {count(maxReinforcement)} times is a different asset from one
                asserted once at the same confidence. <strong>The pattern count is what tells them apart</strong>,
                and the table beside this lists it exactly. The shaded corner is fragile knowledge:
                low confidence, few recurring patterns.
              </>
            }
          >
            {measured.length === 0 ? (
              <ConsequenceEmpty
                missing="a domain whose confidence could be measured"
                produces="Confidence needs volume, classification, conclusion or recency — and none of them is available for any dataset this organization holds."
              />
            ) : (
              <div className="bl-scroll">
                <Quadrant
                  points={measured.map((d) => ({
                    key: d.domain,
                    x: d.patterns / maxPatterns,
                    y: d.confidence.value ?? 0,
                    r: 5 + Math.sqrt(d.reinforcement / maxReinforcement) * 13,
                    hot: d.fragile,
                  }))}
                  xLabel="PATTERN COUNT →"
                  yLabel="CONFIDENCE →"
                  quadrantLabels={[{ x: 0.03, y: 0.94, text: 'FRAGILE KNOWLEDGE', hot: true }]}
                  width={560}
                  height={330}
                  label="Domain confidence against recurring pattern count"
                />
              </div>
            )}
          </Panel>

          <Panel title="Domains" hint={`${state.domainsMeasured} of ${state.domains} measurable`}>
            {domains.length === 0 ? (
              <ConsequenceEmpty
                missing="an ingested dataset with a classifier column recorded on at least half its rows"
                produces="Bring operational data in through Ingestion, or map a classifier for the data already here."
              />
            ) : (
              <div className="bl-scroll">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th>Domain</th>
                      <th>Conf</th>
                      <th>Patterns</th>
                      <th>Reinforced</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((d) => (
                      <tr key={d.key} className={d.fragile ? 'is-fragile' : undefined}>
                        <td>
                          <span className="oi-table__name">{d.domain}</span>
                          <span className="oi-table__sub">
                            {d.axis ? `along ${d.axisLabel}` : 'no qualifying classifier'} · {count(d.records)} records
                          </span>
                        </td>
                        <td><ConfidenceBar confidence={d.confidence} /></td>
                        <td className="oi-table__num">{d.patterns}</td>
                        <td className="oi-table__num">{count(d.reinforcement)}</td>
                        <td>
                          <button type="button" className="u-btn u-btn-ghost u-btn-sm"
                            onClick={() => setExpanded(expanded === d.key ? null : d.key)}
                            aria-expanded={expanded === d.key}>
                            {expanded === d.key ? 'Hide' : 'Why'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {expanded && (() => {
          const d = domains.find((x) => x.key === expanded);
          if (!d) return null;
          return <DomainDetail domain={d} onClose={() => setExpanded(null)} />;
        })()}

        <div className="bl-grid bl-grid--2">
          <Panel
            title="Evidence coverage"
            hint="what supports what the organization noticed"
            footnote={
              evidence.confidenceBands && Object.keys(evidence.confidenceBands).length === 1
                ? <>Every one of {count(evidence.evidence)} evidence rows sits in a single confidence band. <strong>A confidence that never varies carries no information</strong> — it was asserted by whatever wrote the rows, not derived from the source, so it cannot separate strong evidence from weak.</>
                : <>Coverage is distinct signals with at least one piece of evidence, over all signals. Confidence bands show whether the evidence base can discriminate at all.</>
            }
          >
            <div className="bl-grid bl-grid--2" style={{ gap: 12 }}>
              <Metric label="Signals raised" value={count(evidence.signals)} />
              <Metric label="Evidence rows" value={count(evidence.evidence)} />
              <Metric label="Signals corroborated" value={evidence.coverage === null ? 'no signals' : pct(evidence.coverage)}
                sub={`${count(evidence.signalsCovered)} of ${count(evidence.signals)}; ${count(evidence.signalsUncovered)} have nothing supporting them`} />
              <Metric label="Mean stated confidence" value={num(evidence.meanConfidence)}
                sub={`across ${Object.keys(evidence.confidenceBands).length} band${Object.keys(evidence.confidenceBands).length === 1 ? '' : 's'}`} />
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="oi-chips">
                {Object.entries(evidence.confidenceBands).map(([band, n]) => (
                  <span className="oi-chip oi-chip--mono" key={band}>{band}: {count(n)}</span>
                ))}
                {evidence.undated > 0 && (
                  <span className="oi-chip oi-chip--warn">{count(evidence.undated)} undated</span>
                )}
              </span>
            </div>
            <ProvenanceDetails provenance={evidence.provenance} />
          </Panel>

          <Panel
            title="What to learn next"
            hint="ranked by exposure: records × confidence shortfall"
            footnote="Effort spent raising confidence in a domain the organization barely touches buys nothing. Exposure is volume multiplied by how little is established, so the ranking follows where the work actually is."
          >
            {learnNext.length === 0 ? (
              <ConsequenceEmpty
                missing="a domain with both recorded work and a confidence shortfall"
                produces="Either no domain has records, or every domain is already fully established."
              />
            ) : (
              <>
                <div className="bl-scroll">
                  <ScoreBars
                    max={Math.max(...learnNext.map((l) => l.exposure))}
                    hotFrom={Math.max(...learnNext.map((l) => l.exposure)) * 0.6}
                    rows={learnNext.map((l) => ({ key: l.domain, value: l.exposure }))}
                    width={520}
                    labelWidth={170}
                    label="Knowledge exposure by domain"
                  />
                </div>
                <div className="oi-findings" style={{ marginTop: 12 }}>
                  {learnNext.slice(0, 3).map((l) => (
                    <div className="oi-finding" key={l.key}>
                      <div className="oi-finding__top">
                        <h4 className="oi-finding__title">{l.domain}</h4>
                        <span className="oi-chips">
                          <span className="oi-chip oi-chip--mono">exposure {count(l.exposure)}</span>
                          <span className="oi-chip oi-chip--mono">conf {num(l.confidence)}</span>
                        </span>
                      </div>
                      <p className="oi-finding__detail">{l.reason}</p>
                      {l.weakestComponent && (
                        <p className="oi-finding__detail">
                          <strong>Weakest component: {l.weakestComponent.key}.</strong> {l.weakestComponent.basis}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>

        <Panel
          title="Blind spots"
          hint="where the organization records nothing"
          footnote="Each of these is a fact about columns, not an opinion: a classifier that is null on most rows, one that has exactly one value across thousands of rows, or a dataset with no conclusion recorded. Ordered by how many records the absence affects."
        >
          {blindSpots.length === 0 ? (
            <ConsequenceEmpty
              missing="a classifier that is unrecorded, invariant, or a dataset with no conclusion"
              produces="Every classifier column this organization populates varies, and every dataset records how its work concluded."
            />
          ) : (
            <div className="bl-scroll">
              <table className="oi-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Area</th>
                    <th>Finding</th>
                    <th>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {blindSpots.map((b) => (
                    <tr key={`${b.area}-${b.field}-${b.kind}`}>
                      <td><span className="oi-chip">{b.kind.replace(/_/g, ' ')}</span></td>
                      <td className="oi-table__name">{b.area}</td>
                      <td>
                        {b.title}
                        <span className="oi-table__sub">{b.detail}</span>
                      </td>
                      <td className="oi-table__num">{count(b.records)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {concentrations.length > 0 && (
          <Panel
            title="Where knowledge is concentrated"
            hint="a single class holding most of a body of work"
            footnote="Concentration is not a verdict — an operator whose faults are mostly one fault may simply have one dominant failure mode. It is a statement that the organization's exposure in that area is not spread, which is a fact worth having before planning capacity against it."
          >
            <div className="oi-findings">
              {concentrations.map((c) => (
                <div className="oi-finding" key={`${c.area}-${c.field}-${c.value}`}>
                  <div className="oi-finding__top">
                    <h4 className="oi-finding__title">{c.title}</h4>
                    <span className="oi-chips">
                      <span className="oi-chip oi-chip--mono">{pct(c.share)}</span>
                      <span className="oi-chip">{c.field}</span>
                    </span>
                  </div>
                  <p className="oi-finding__detail">{c.detail}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="How these figures are defined" hint="the rules, stated once">
          <div className="oi-factors">
            {Object.entries(definitions).map(([key, text]) => (
              <div className="oi-factor" key={key} style={{ gridTemplateColumns: '120px 1fr' }}>
                <span className="oi-factor__key">{key}</span>
                <span className="oi-factor__basis">{text}</span>
              </div>
            ))}
          </div>
          <NullLegend what="never measured" />
        </Panel>
      </div>

      <DerivationFooter derivation={data.derivation} />
    </div>
  );
}

/* ─────────────────────────── domain detail ─────────────────────────── */

/**
 * One domain opened up: its confidence factors, its measure, and the patterns it is
 * built from with the months each recurs across.
 *
 * The pattern list is what makes the confidence auditable. A reader who doubts that
 * a domain is well established can read the exact values, their record counts, and
 * how many separate months each appeared in.
 */
function DomainDetail({ domain, onClose }: { domain: KnowledgeDomain; onClose: () => void }) {
  const d = domain;

  return (
    <Panel
      title={`${d.domain} — why this confidence`}
      hint={d.source === 'mental_models' ? 'recorded mental model' : 'derived from operational records'}
      right={<button type="button" className="u-btn u-btn-ghost u-btn-sm" onClick={onClose}>Close</button>}
      footnote={
        d.fragile
          ? <>This domain is reported as fragile: {d.fragileReasons.join('; ')}.</>
          : <>Every component below was measured from this organization's own rows. A component with no input is shown as <code>n/a</code> and its weight was shared across the others — never scored zero.</>
      }
    >
      <div className="bl-grid bl-grid--3" style={{ gap: 12, marginBottom: 12 }}>
        <Metric label="Records" value={count(d.records)}
          sub={d.firstAt && d.lastAt ? `${d.firstAt.slice(0, 10)} → ${d.lastAt.slice(0, 10)}` : undefined} />
        <Metric label="Recurring patterns" value={String(d.patterns)}
          sub={d.unsupportedValues > 0 ? `${d.unsupportedValues} value${d.unsupportedValues === 1 ? '' : 's'} did not recur often enough to count` : undefined} />
        <Metric label="Reinforcement" value={count(d.reinforcement)} sub={d.reinforcementBasis} />
        <Metric label="Pattern coverage" value={pct(d.coverage)}
          sub="share of the dataset's records that sit inside a recurring pattern" />
        <Metric label="Top-pattern share" value={pct(d.concentration)} sub={d.topPattern ?? undefined} />
        {d.measure && (
          <Metric
            label={`Outcome measure (${d.measure.unit ?? 'units'})`}
            value={`median ${num(d.measure.median, 1)}`}
            sub={`p95 ${num(d.measure.p95, 1)} · mean ${num(d.measure.mean, 1)}${d.measure.negatives > 0 ? ` · ${d.measure.negatives} impossible value${d.measure.negatives === 1 ? '' : 's'}` : ''}`}
          />
        )}
      </div>

      <ConfidenceFactorsBlock domain={d} />

      {d.patternDetail.length > 0 && (
        <div className="bl-scroll" style={{ marginTop: 12 }}>
          <table className="oi-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Records</th>
                <th>Concluded</th>
                <th>Months</th>
                <th>Trend</th>
                <th>Mean</th>
              </tr>
            </thead>
            <tbody>
              {d.patternDetail.map((p) => (
                <tr key={p.value}>
                  <td className="oi-table__name">{p.value}</td>
                  <td className="oi-table__num">{count(p.records)}</td>
                  <td className="oi-table__num">{count(p.closed)}</td>
                  <td className="oi-table__num">{p.periods}</td>
                  <td>
                    {/* Recurrence, not a time series: the bar is months present out
                        of the twelve a year has, which is what qualified the value
                        as a pattern in the first place. */}
                    <Sparkline
                      values={Array.from({ length: 12 }, (_, i) => (i < p.periods ? 1 : 0))}
                      width={70}
                      height={16}
                      label={`${p.periods} of 12 months`}
                    />
                  </td>
                  <td className="oi-table__num">{num(p.meanMetric, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProvenanceDetails provenance={d.provenance} summary="The query behind this domain" />
    </Panel>
  );
}

function ConfidenceFactorsBlock({ domain }: { domain: KnowledgeDomain }) {
  return (
    <div className="oi-factors">
      {domain.confidence.components.map((c) => (
        <div className="oi-factor" key={c.key}>
          <span className="oi-factor__key">{c.key} ×{c.weight}</span>
          <span className={`oi-factor__val${c.value === null ? ' oi-factor__val--none' : ''}`}>
            {c.value === null ? 'n/a' : c.value.toFixed(2)}
          </span>
          <span className="oi-factor__basis">{c.basis}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── local metric ─────────────────────────── */

/**
 * A labelled figure with an optional basis line.
 *
 * Deliberately not ui/layers.tsx's `Metric`: that one owns the null-renders-as-
 * "never measured" contract and takes a numeric value plus a confidence. These are
 * pre-formatted strings the API already resolved, including its own em-dashes for
 * absent values, and passing them through a component that re-decides what null
 * means would give one screen two ways of saying "unknown".
 */
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="oi-block">
      <div className="oi-block__label">{label}</div>
      <div className="oi-block__body">
        <strong style={{ fontSize: 15 }}>{value}</strong>
        {sub && <div style={{ marginTop: 3, color: 'var(--content-tertiary)' }}>{sub}</div>}
      </div>
    </div>
  );
}
