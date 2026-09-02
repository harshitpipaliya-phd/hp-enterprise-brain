import { useCallback, useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type { OrganizationalState, RecommendationsResponse, GapsResponse } from '../../api/organizationIntelligence';
import {
  LayerStrip, StateLayer, MovementLayer, ConsequenceLayer, LayerFigure, LayerPoints,
  ConsequenceEmpty, Panel, Radar, Sparkline, Button, Spinner, ErrorState, Tabs,
} from '../../ui';
import {
  DimensionLadder, RecommendationCard, GapRow, IntelligenceHeader, DerivationFooter,
  pct, num, count,
} from './intelligenceUi';
import './OrganizationIntelligence.css';
import { operationsApi } from '../../api/operations';
import type { OperationsOverview } from '../../api/operations';
import { InsightsPanel, ScorecardPanel, TrendChart } from './OperationalIntelligencePanels';

/**
 * Executive Dashboard — "Where is this organization, and what should it do next?"
 *
 * WHAT WAS WRONG WITH THE PREVIOUS VERSION, precisely. It rendered
 * `Math.round(statistics.outcomes.recommendationAccuracy * 100)%` as a KPI. That
 * figure is successes divided by outcomes, and this organization has recorded no
 * outcomes, so the endpoint returned 0.0 and the tile displayed a confident
 * "Recommendation Accuracy: 0%". A leader reading it would conclude that every
 * recommendation the Brain had ever made was wrong. The same applied to
 * "Avg Risk Score: 0" over an empty risk register, and to an Organizational
 * Intelligence Score that averaged those zeros into a single number nobody could
 * decompose. Three fabrications, all of them arithmetic on empty sets.
 *
 * The replacement measures the eight stages of the Organizational Intelligence Loop,
 * scores only the ones with a measurable input, and reports the rest as undetermined
 * with the blocking reason named. The composite carries how much of its intended
 * weight was actually available.
 *
 * AND IT ENDS IN ACTIONS, which is the part a leader is here for. Prioritised
 * recommendations, each derived from a specific detected gap or risk, each carrying
 * its evidence, its confidence, a labelled benefit and one next action.
 */
export default function ExecutiveDashboard({ tenantId, onViewEso }: { tenantId: string; onViewEso?: (esoId: string) => void }) {
  const [state, setState] = useState<OrganizationalState | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [gaps, setGaps] = useState<GapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'actions' | 'gaps'>('actions');
  /*
    THE OPERATIONAL SCORECARD, alongside the loop state above.

    The loop measures how far this organization's REASONING has travelled; the
    scorecard measures the organization itself, from its own imported records.
    An executive screen that shows only the first reports a young installation as
    having nothing to say — while a quarter of a million operational records sit
    one table away, fully analysable.

    Loaded separately and allowed to fail: the loop state is the screen.
  */
  const [operations, setOperations] = useState<OperationsOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    operationsApi.getOverview(tenantId)
      .then((result) => { if (!cancelled) setOperations(result); })
      .catch(() => { if (!cancelled) setOperations(null); });
    return () => { cancelled = true; };
  }, [tenantId]);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      // Three endpoints, one computation. The engine composes and caches per data
      // version, so these are three cheap slices of one result rather than three
      // recomputations.
      const [s, r, g] = await Promise.all([
        organizationIntelligenceApi.getState(tenantId, fresh),
        organizationIntelligenceApi.getRecommendations(tenantId),
        organizationIntelligenceApi.getGaps(tenantId),
      ]);
      setState(s);
      setRecommendations(r);
      setGaps(g);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the organizational picture.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !state) {
    return <div className="oi-page"><Spinner label="Measuring the organization against the intelligence loop" /></div>;
  }

  if (error && !state) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!state || !recommendations || !gaps) return null;

  const s = state.state;
  const overall = s.overall;

  // Every dimension carries a 0..1 score; the radar is drawn on 0..5 so it reads on
  // the same scale as a KASBA level. null stays null — Radar hatches it rather than
  // drawing a spoke at the centre.
  const radarDimensions = s.dimensions.map((d) => ({
    key: d.label.split(' ')[0],
    value: d.score === null ? null : Number((d.score * 5).toFixed(2)),
  }));

  return (
    <div className="oi-page">
      <IntelligenceHeader
        title="Executive Dashboard"
        icon={<Gauge />}
        question="A decision-oriented view of organizational performance, risk and opportunity."
        meta={state}
        actions={<Button variant="secondary" onClick={() => void load(true)} disabled={loading}>Recompute</Button>}
      />

      {/*
        WHAT THE ORGANIZATION'S OWN RECORDS SAY, before the loop's own state.

        Placed first because it is the half a reader can act on today: the loop
        below describes how much reasoning has been done, and this describes what
        there is to reason about. Every dimension carries its arithmetic, and any
        the connected data cannot support is listed separately rather than scored
        as zero — see App\Domain\Operations\OrganizationScorecard.
      */}
      {operations?.available && (
        <>
          <ScorecardPanel scorecard={operations.scorecard} title="Organization intelligence" />
          <InsightsPanel insights={operations.insights} limit={6} />
          {operations.trend.supported && (
            <TrendChart
              points={operations.trend.points}
              momentum={operations.trend.momentum}
              title="Recorded activity by month"
            />
          )}
        </>
      )}

      <LayerStrip>
        <StateLayer>
          {overall.score === null ? (
            <ConsequenceEmpty
              missing="a single measurable loop dimension"
              produces="Nothing this organization's state is built from could be measured. Ingest operational data, or record a signal, to give the loop an input."
            />
          ) : (
            <LayerFigure
              value={num(overall.score)}
              note={`${overall.stage} · ${overall.dimensionsMeasured} of ${overall.dimensionsMeasured + overall.dimensionsUnmeasured} loop stages measurable, carrying ${pct(overall.weightMeasured, 0)} of the intended weight.`}
            />
          )}
        </StateLayer>

        <MovementLayer>
          {state.movement.moving.length === 0 ? (
            <ConsequenceEmpty
              missing="a series whose slope clears its own standard error"
              produces="Every measurable series is statistically flat. Nothing is provably growing or shrinking, which is itself a finding."
            />
          ) : (
            <LayerPoints
              points={state.movement.moving.slice(0, 3).map((t) => (
                <>
                  <strong>{t.area}</strong> — {t.label.toLowerCase()} is {t.direction}
                  {t.changePct !== null ? ` ${Math.abs(t.changePct).toFixed(0)}%` : ''} over {t.periods} months.
                  {' '}Rising means {t.risingMeans}.
                </>
              ))}
            />
          )}
        </MovementLayer>

        <ConsequenceLayer>
          {state.consequence.firstAction === null ? (
            <ConsequenceEmpty
              missing="a detected gap or risk"
              produces="Every detection rule ran and none matched. There is nothing to act on."
            />
          ) : (
            <LayerPoints
              points={[
                <>
                  <strong>{state.consequence.criticalGaps} critical gap{state.consequence.criticalGaps === 1 ? '' : 's'}</strong> and
                  {' '}{state.consequence.openRisks} open risk{state.consequence.openRisks === 1 ? '' : 's'},
                  {' '}{state.consequence.unownedRisks} of them with nobody assigned.
                </>,
                <><strong>Do first:</strong> {state.consequence.firstAction.recommendation}.</>,
                <>{state.consequence.firstAction.why}</>,
              ]}
            />
          )}
        </ConsequenceLayer>
      </LayerStrip>

      <div className="oi-sections">
        <div className="bl-grid bl-grid--wide-left">
          <Panel
            title="The loop, stage by stage"
            hint="click a stage for the measurements behind its score"
            footnote={<>{overall.why}</>}
          >
            <DimensionLadder dimensions={s.dimensions} />
          </Panel>

          <Panel
            title="Shape of the loop"
            hint="0-5, hatched where never measured"
            footnote={
              s.unmeasured.length > 0
                ? <>{s.unmeasured.length} stage{s.unmeasured.length === 1 ? '' : 's'} could not be measured at all and {s.unmeasured.length === 1 ? 'is' : 'are'} hatched rather than drawn at zero. <strong>Never having tried is not the same as having failed.</strong></>
                : <>Every stage of the loop has a measurable input.</>
            }
          >
            <Radar dimensions={radarDimensions} max={5} width={280} height={280} label="Loop stage scores" />

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {s.byMovement.map((m) => (
                <div key={m.movement} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--content-primary)' }}>{m.movement}</span>
                  <span className="oi-chips">
                    {m.unmeasured > 0 && <span className="oi-chip oi-chip--warn">{m.unmeasured} unmeasured</span>}
                    <span className="oi-chip oi-chip--mono">{m.score === null ? 'undetermined' : num(m.score)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="bl-grid bl-grid--2">
          <Panel title="Strengths" hint="stages at 0.65 or above">
            {s.strengths.length === 0 ? (
              <ConsequenceEmpty
                missing="a loop stage scoring 0.65 or above"
                produces="No stage of the loop is yet well established. The ladder above shows which is closest."
              />
            ) : (
              <div className="oi-findings">
                {s.strengths.map((d) => (
                  <div className="oi-finding" key={d.key}>
                    <div className="oi-finding__top">
                      <h4 className="oi-finding__title">{d.label}</h4>
                      <span className="oi-chips">
                        <span className="oi-chip oi-chip--ok">{num(d.score)}</span>
                        <span className="oi-chip">{d.stage}</span>
                      </span>
                    </div>
                    <p className="oi-finding__detail">{d.why}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Weaknesses and blanks" hint="stages below 0.40, and stages with no input">
            {s.weaknesses.length === 0 && s.unmeasured.length === 0 ? (
              <ConsequenceEmpty
                missing="a loop stage below 0.40 or without a measurable input"
                produces="Every stage clears the floor and every one of them can be measured."
              />
            ) : (
              <div className="oi-findings">
                {[...s.weaknesses, ...s.unmeasured].map((d) => (
                  <div className="oi-finding" key={d.key}>
                    <div className="oi-finding__top">
                      <h4 className="oi-finding__title">{d.label}</h4>
                      <span className="oi-chips">
                        <span className={`oi-chip oi-chip--${d.score === null ? 'warn' : 'crit'}`}>
                          {d.score === null ? 'undetermined' : num(d.score)}
                        </span>
                      </span>
                    </div>
                    <p className="oi-finding__detail">{d.blocking ?? d.why}</p>
                    {d.unmeasured.length > 0 && (
                      <p className="bc-note">
                        Unmeasurable components: {d.unmeasured.join(', ')}. Their weight was shared across the
                        rest rather than scored zero.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="What this organization should do next"
          hint={`${recommendations.total} actions · ${recommendations.critical} critical · ${gaps.total} gaps detected`}
          right={
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'actions', label: `Actions (${recommendations.total})` },
                { id: 'gaps', label: `Gaps (${gaps.total})` },
              ]}
            />
          }
          footnote={<>{recommendations.method.priority} <strong>{recommendations.method.benefit}</strong></>}
        >
          {tab === 'actions' ? (
            recommendations.recommendations.length === 0 ? (
              <ConsequenceEmpty
                missing="a detected gap or risk to act on"
                produces="Every detection rule ran against this organization's records and none matched."
              />
            ) : (
              <div className="oi-recs">
                {recommendations.recommendations.slice(0, 12).map((r) => (
                  <RecommendationCard recommendation={r} key={r.id} onViewEso={onViewEso} />
                ))}
                {recommendations.total > 12 && (
                  <p className="bc-note">
                    Showing the 12 highest-priority of {recommendations.total}. The remainder are ranked below
                    priority score {num(recommendations.recommendations[11].priorityScore)} and are available
                    from the recommendations endpoint.
                  </p>
                )}
              </div>
            )
          ) : (
            gaps.gaps.length === 0 ? (
              <ConsequenceEmpty
                missing="a detected absence"
                produces="Nothing the detectors look for is missing from this organization's records."
              />
            ) : (
              <div className="oi-findings">
                {gaps.gaps.slice(0, 15).map((g) => <GapRow gap={g} key={g.id} />)}
                {gaps.total > 15 && (
                  <p className="bc-note">Showing the 15 most severe of {gaps.total}.</p>
                )}
              </div>
            )
          )}
        </Panel>

        {state.movement.moving.length > 0 && (
          <Panel
            title="What is actually moving"
            hint="ordinary least squares over complete months"
            footnote={<>{state.movement.method.trend} {state.movement.method.partial}</>}
          >
            <div className="bl-scroll">
              <table className="oi-table">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Shape</th>
                    <th>Direction</th>
                    <th>Change</th>
                    <th>t</th>
                    <th>r²</th>
                    <th>Rising means</th>
                  </tr>
                </thead>
                <tbody>
                  {state.movement.moving.map((t) => (
                    <tr key={t.key}>
                      <td>
                        <span className="oi-table__name">{t.area}</span>
                        <span className="oi-table__sub">{t.label}</span>
                      </td>
                      <td>
                        <Sparkline values={t.series} width={90} height={22} label={`${t.periods} months`} />
                      </td>
                      <td>
                        <span className={`oi-chip oi-chip--${t.direction === 'rising' ? 'warn' : 'info'}`}>{t.direction}</span>
                      </td>
                      <td className="oi-table__num">{t.changePct === null ? '—' : `${t.changePct > 0 ? '+' : ''}${t.changePct.toFixed(0)}%`}</td>
                      <td className="oi-table__num">{num(t.significance)}</td>
                      <td className="oi-table__num">{num(t.fitQuality)}</td>
                      <td>{t.risingMeans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <Panel title="What the organization holds" hint="the population every figure above is taken over">
          <div className="bl-grid bl-grid--3" style={{ gap: 12 }}>
            <div className="oi-block">
              <div className="oi-block__label">Operational records</div>
              <div className="oi-block__body"><strong style={{ fontSize: 17 }}>{count(state.totals.operationalRecords)}</strong>
                <div style={{ marginTop: 3, color: 'var(--content-tertiary)' }}>across {state.totals.datasets} dataset{state.totals.datasets === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="oi-block">
              <div className="oi-block__label">Loop records</div>
              <div className="oi-block__body"><strong style={{ fontSize: 17 }}>{count(state.totals.loopRecords)}</strong>
                <div style={{ marginTop: 3, color: 'var(--content-tertiary)' }}>signals, evidence, decisions and the rest</div>
              </div>
            </div>
            <div className="oi-block">
              <div className="oi-block__label">Gaps by area</div>
              <div className="oi-block__body">
                <span className="oi-chips">
                  {Object.entries(gaps.byArea).map(([area, n]) => (
                    <span className="oi-chip oi-chip--mono" key={area}>{area}: {n}</span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="The headline, in sentences" hint="assembled only from measured figures">
          {s.headline.length === 0 ? (
            <ConsequenceEmpty
              missing="a measured figure to build a statement from"
              produces="No sentence here is written unless the figures in it were measured. Nothing was."
            />
          ) : (
            <ul className="bl-points">
              {s.headline.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          )}
        </Panel>
      </div>

      <DerivationFooter derivation={recommendations.derivation} />
    </div>
  );
}
