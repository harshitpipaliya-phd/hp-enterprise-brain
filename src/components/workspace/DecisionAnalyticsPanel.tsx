import { useCallback, useEffect, useMemo, useState } from 'react';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type {
  DecisionIntelligenceData,
  Gap,
  GapsResponse,
  OrganizationalState,
  RecommendationsResponse,
  Risk,
} from '../../api/organizationIntelligence';
import {
  Button,
  ConsequenceEmpty,
  ErrorState,
  Funnel,
  HBars,
  LayerFigure,
  LayerPoints,
  LayerStrip,
  MovementLayer,
  Panel,
  Quadrant,
  RiskMatrix,
  ScoreBars,
  Spinner,
  StateLayer,
  ConsequenceLayer,
  Undetermined,
} from '../../ui';
import {
  ConfidenceBar,
  DerivationFooter,
  EvidenceList,
  GapRow,
  IntelligenceHeader,
  ProvenanceDetails,
  RecommendationCard,
  count,
  num,
  pct,
} from './intelligenceUi';
import './OrganizationIntelligence.css';

type Profile = {
  totals?: { operationalRecords?: number; datasets?: number; loopRecords?: number };
  loop?: Record<string, { rows?: number; lastAt?: string | null }>;
  datasets?: { dataset: string; label: string; records: number }[];
};

type Filter = 'all' | 'category' | 'risk' | 'gap' | 'recommendation';

export default function DecisionAnalyticsPanel({ tenantId }: { tenantId: string }) {
  const [decisions, setDecisions] = useState<DecisionIntelligenceData | null>(null);
  const [state, setState] = useState<OrganizationalState | null>(null);
  const [gaps, setGaps] = useState<GapsResponse | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<Filter>('all');
  const [filterValue, setFilterValue] = useState('all');
  const [openRisk, setOpenRisk] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openGap, setOpenGap] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [decisionData, stateData, gapData, recommendationData, profileData] = await Promise.all([
        organizationIntelligenceApi.getDecisions(tenantId, fresh),
        organizationIntelligenceApi.getState(tenantId, fresh),
        organizationIntelligenceApi.getGaps(tenantId, fresh),
        organizationIntelligenceApi.getRecommendations(tenantId, fresh),
        organizationIntelligenceApi.getProfile(tenantId, fresh),
      ]);

      setDecisions(decisionData);
      setState(stateData);
      setGaps(gapData);
      setRecommendations(recommendationData);
      setProfile(profileData as Profile);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load decision analytics.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  const filters = useMemo(() => {
    const categories = decisions?.byCategory.map((c) => c.category) ?? [];
    const riskAreas = [...new Set(decisions?.risks.register.map((r) => r.area) ?? [])];
    const gapAreas = [...new Set(gaps?.gaps.map((g) => g.area) ?? [])];
    const recAreas = [...new Set(recommendations?.recommendations.map((r) => r.area) ?? [])];
    return { categories, riskAreas, gapAreas, recAreas };
  }, [decisions, gaps, recommendations]);

  useEffect(() => {
    setFilterType('all');
    setFilterValue('all');
    setOpenRisk(null);
    setOpenCategory(null);
    setOpenGap(null);
  }, [tenantId]);

  if (loading && !decisions) {
    return <div className="oi-page"><Spinner label="Deriving decision analytics" /></div>;
  }

  if (error && !decisions) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!decisions || !state || !gaps || !recommendations) return null;

  const quadrant = decisions.accuracy.measurable ? decisions.acceptanceVsAccuracy : decisions.acceptanceVsEvidence;
  const quadrantPoints = (quadrant.points ?? []).filter((p) =>
    p.acceptance !== null && (decisions.accuracy.measurable ? p.accuracy != null : p.evidenceSupport != null));
  const maxRecs = Math.max(1, ...(quadrant.points ?? []).map((p) => p.recommendations));

  const visibleRisks = filterType === 'risk' && filterValue !== 'all'
    ? decisions.risks.register.filter((r) => r.area === filterValue)
    : decisions.risks.register;
  const visibleGaps = filterType === 'gap' && filterValue !== 'all'
    ? gaps.gaps.filter((g) => g.area === filterValue)
    : gaps.gaps;
  const visibleRecommendations = filterType === 'recommendation' && filterValue !== 'all'
    ? recommendations.recommendations.filter((r) => r.area === filterValue)
    : recommendations.recommendations;
  const visibleCategories = filterType === 'category' && filterValue !== 'all'
    ? decisions.byCategory.filter((c) => c.category === filterValue)
    : decisions.byCategory;

  const dataScope = [
    { key: 'Operational records', value: profile?.totals?.operationalRecords ?? null },
    { key: 'Datasets', value: profile?.totals?.datasets ?? null },
    { key: 'Loop records', value: profile?.totals?.loopRecords ?? null },
    { key: 'Decisions', value: decisions.state.decisions },
    { key: 'Recommendations', value: decisions.state.recommendations },
    { key: 'Outcomes', value: decisions.accuracy.outcomes },
  ];

  const evidenceRows = [
    { key: 'Traceable recommendations', value: decisions.quality.unevidenced.total === 0 ? null : (decisions.quality.unevidenced.evidenced ?? 0), display: count(decisions.quality.unevidenced.evidenced) },
    { key: 'Unevidenced recommendations', value: decisions.quality.unevidenced.unevidenced, display: count(decisions.quality.unevidenced.unevidenced) },
    { key: 'Decisions without rationale', value: decisions.quality.withoutRationale, display: count(decisions.quality.withoutRationale) },
    { key: 'Low-confidence decisions', value: decisions.quality.belowConfidenceFloor, display: count(decisions.quality.belowConfidenceFloor) },
  ];

  const movementPoints = state.movement.moving.length > 0
    ? state.movement.moving.slice(0, 3).map((trend) => (
        <>
          <strong>{trend.label}</strong> is {trend.direction}; fitted change {trend.changePct === null ? 'not expressible' : `${trend.changePct.toFixed(1)}%`}
          {' '}over {trend.periods} periods.
        </>
      ))
    : [<>Trend unavailable: insufficient historical evidence in metric snapshots or operational time series.</>];

  return (
    <div className="oi-page">
      <IntelligenceHeader
        eyebrow="Analytics"
        title="Decision Analytics"
        question="Where is this organization right now, what is changing, why does it matter, and what should be done next?"
        meta={decisions}
        actions={<Button variant="secondary" onClick={() => void load(true)} disabled={loading}>Recompute</Button>}
      />

      {error && <div className="u-alert u-alert-danger" style={{ marginBottom: 14 }}><div className="u-alert-body">{error}</div></div>}

      <LayerStrip>
        <StateLayer>
          <LayerFigure
            value={state.state.overall.score === null ? 'undetermined' : pct(state.state.overall.score)}
            unit={state.state.overall.score === null ? '' : ' overall state'}
            note={state.state.overall.why}
          />
        </StateLayer>

        <MovementLayer>
          <LayerPoints points={movementPoints} />
        </MovementLayer>

        <ConsequenceLayer>
          <LayerPoints
            points={[
              ...state.state.headline.slice(0, 2),
              recommendations.firstAction
                ? <><strong>First action:</strong> {recommendations.firstAction.recommendation}. {recommendations.firstAction.why}</>
                : <>No prioritized action is generated because no supported gap, risk, or learning opportunity currently qualifies.</>,
            ]}
          />
        </ConsequenceLayer>
      </LayerStrip>

      <div className="oi-toolbar" style={{ marginBottom: 16 }}>
        <label className="oi-block" style={{ minWidth: 210 }}>
          <span className="oi-block__label">Filter lens</span>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value as Filter); setFilterValue('all'); }}>
            <option value="all">Whole organization</option>
            <option value="category">Decision category</option>
            <option value="risk">Risk area</option>
            <option value="gap">Blind spot / gap area</option>
            <option value="recommendation">Recommendation area</option>
          </select>
        </label>
        {filterType !== 'all' && (
          <label className="oi-block" style={{ minWidth: 260 }}>
            <span className="oi-block__label">Value</span>
            <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
              <option value="all">All</option>
              {(filterType === 'category' ? filters.categories
                : filterType === 'risk' ? filters.riskAreas
                : filterType === 'gap' ? filters.gapAreas
                : filters.recAreas).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        )}
        <div className="oi-chips">
          <span className="oi-chip oi-chip--mono">tenant {decisions.tenantId}</span>
          <span className="oi-chip oi-chip--mono">version {decisions.dataVersion}</span>
        </div>
      </div>

      <div className="oi-sections">
        <div className="bl-grid bl-grid--2">
          <Panel title="Organizational decision state" hint={`${state.state.overall.dimensionsMeasured} measured dimensions`}>
            <div className="bl-grid bl-grid--2" style={{ gap: 10 }}>
              {state.state.dimensions.map((d) => (
                <button type="button" className="oi-block" key={d.key} title={d.why}>
                  <span className="oi-block__label">{d.label}</span>
                  <span className="oi-block__body">
                    <strong>{d.score === null ? 'undetermined' : pct(d.score)}</strong>
                    <span className="oi-chip" style={{ marginLeft: 6 }}>{d.stage}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="bc-note">{state.state.method.composite}</p>
          </Panel>

          <Panel title="Data used for this read" hint="organization scoped" footnote={<>{decisions.derivation.scope}</>}>
            <HBars rows={dataScope} width={440} labelWidth={160} label="Source populations used by decision analytics" />
            <p className="bc-note">{decisions.derivation.llm}</p>
          </Panel>
        </div>

        <Panel
          title={decisions.accuracy.measurable ? 'Decision quality matrix' : 'Decision confidence matrix'}
          hint="click a bubble for evidence and action"
          footnote={<>{quadrant.why}</>}
        >
          {!decisions.accuracy.measurable && (
            <div style={{ marginBottom: 12 }}>
              <Undetermined question="How often were decisions right?" gaps={decisions.accuracy.gaps.length ? decisions.accuracy.gaps : ['hpbrain_outcomes']} />
              <p className="bc-note">{decisions.accuracy.why} {decisions.accuracy.howToFix}</p>
            </div>
          )}

          <div className="bl-grid bl-grid--wide-left">
            {quadrantPoints.length === 0 ? (
              <ConsequenceEmpty
                missing="a category with measurable decision acceptance"
                produces="Recommendations need categories and decisions before category quality can be plotted."
              />
            ) : (
              <div className="bl-scroll">
                <Quadrant
                  points={quadrantPoints.map((p) => ({
                    key: p.category,
                    x: p.acceptance ?? 0,
                    y: (decisions.accuracy.measurable ? p.accuracy : p.evidenceSupport) ?? 0,
                    r: 7 + Math.sqrt(p.recommendations / maxRecs) * 16,
                    hot: (p.acceptance ?? 0) >= 0.5 && ((decisions.accuracy.measurable ? p.accuracy : p.evidenceSupport) ?? 0) < 0.5,
                    onClick: () => setOpenCategory(openCategory === p.category ? null : p.category),
                  }))}
                  xLabel={`${(quadrant.xLabel ?? 'Accepted').toUpperCase()} ->`}
                  yLabel={`${(quadrant.yLabel ?? 'Measured').toUpperCase()} ->`}
                  quadrantLabels={[
                    { x: 0.97, y: 0.94, text: 'STRONG AND VALIDATED', anchor: 'end' },
                    { x: 0.97, y: 0.14, text: (quadrant.hotCorner ?? 'DANGEROUS').toUpperCase(), hot: true, anchor: 'end' },
                    { x: 0.07, y: 0.94, text: 'UNDERUSED BUT SUPPORTED' },
                    { x: 0.07, y: 0.14, text: 'WEAKLY SUPPORTED' },
                  ]}
                  width={620}
                  height={360}
                  label={`${quadrant.yLabel} against ${quadrant.xLabel} by category`}
                />
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <h3 className="oi-subhead">Category intelligence</h3>
              {(openCategory
                ? quadrant.points.filter((p) => p.category === openCategory)
                : visibleCategories.map((c) => quadrant.points.find((p) => p.category === c.category)).filter(Boolean)
              ).slice(0, 5).map((p) => p && (
                <CategoryDetail key={p.category} point={p} accuracyMode={decisions.accuracy.measurable} />
              ))}
              {quadrant.provenance && <ProvenanceDetails provenance={quadrant.provenance} />}
            </div>
          </div>
        </Panel>

        <div className="bl-grid bl-grid--2">
          <Panel title="Evidence intelligence" hint="traceability and decision hygiene">
            <HBars rows={evidenceRows} width={440} labelWidth={190} label="Evidence support and decision hygiene" />
            <div className="oi-rec__next" style={{ marginTop: 12 }}>
              <b>Formula</b>
              Evidence-backed decision support uses recommendation evidence links: evidenced recommendations / recommendations. Null means there are no recommendations to assess.
            </div>
          </Panel>

          <Panel
            title="Risk intelligence"
            hint={`${decisions.risks.open} open, ${decisions.risks.unowned} unowned`}
            footnote={<>{decisions.risks.method.severity} {decisions.risks.method.impact}</>}
          >
            {decisions.risks.matrix.cells.length === 0 ? (
              <ConsequenceEmpty
                missing="a risk with measured likelihood and impact"
                produces="Risk rules ran against this organization's records; no placeable risk currently exists."
              />
            ) : (
              <RiskMatrix cells={decisions.risks.matrix.cells} unplaceable={decisions.risks.matrix.unplaceable.length} label="Risk exposure matrix" />
            )}
          </Panel>
        </div>

        <div className="bl-grid bl-grid--wide-left">
          <Panel title="Organizational blind spots and gaps" hint={`${gaps.critical} critical, ${gaps.high} high`}>
            {visibleGaps.length === 0 ? (
              <ConsequenceEmpty
                missing="a supported blind spot or gap"
                produces="Every gap detector ran and none matched the current filter."
              />
            ) : (
              <div className="oi-findings">
                {visibleGaps.slice(0, 6).map((gap) => (
                  <div key={gap.id}>
                    <button type="button" className="u-btn u-btn-ghost u-btn-sm" onClick={() => setOpenGap(openGap === gap.id ? null : gap.id)}>
                      {openGap === gap.id ? 'Collapse' : 'Inspect'} {gap.band} gap
                    </button>
                    {openGap === gap.id ? <GapRow gap={gap} /> : <CompactGap gap={gap} />}
                  </div>
                ))}
              </div>
            )}
            <p className="bc-note">{gaps.method.severity}</p>
          </Panel>

          <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
            <Panel title="Decision areas" hint="category, confidence, urgency">
              {visibleCategories.length === 0 ? (
                <ConsequenceEmpty missing="a recommendation category" produces="No category can be shown until recommendations exist." />
              ) : (
                <HBars
                  rows={visibleCategories.map((c) => ({
                    key: c.category,
                    value: c.recommendations,
                    display: `${count(c.recommendations)} recs`,
                  }))}
                  width={420}
                  labelWidth={145}
                  label="Recommendations by decision category"
                />
              )}
            </Panel>

            <Panel title="Decision pipeline" hint="recommendation to approval">
              <Funnel
                steps={[
                  { key: 'Recommendations', value: decisions.state.recommendations },
                  { key: 'Decided', value: decisions.state.pipeline.approved + decisions.state.pipeline.rejected },
                  { key: 'Approved', value: decisions.state.pipeline.approved },
                  { key: 'Outcomes', value: decisions.accuracy.outcomes },
                  { key: 'Learned', value: profile?.loop?.hpbrain_learnings?.rows ?? 0 },
                ]}
                width={420}
                label="Decision loop funnel"
              />
            </Panel>
          </div>
        </div>

        <div className="bl-grid bl-grid--2">
          <Panel title="Risk register and derived risks" hint="click a row for provenance">
            {visibleRisks.length === 0 ? (
              <ConsequenceEmpty missing="a registered or derived risk" produces="No risk currently matches the selected lens." />
            ) : (
              <div className="bl-scroll">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th>Risk</th>
                      <th>Severity</th>
                      <th>Cause</th>
                      <th>State</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRisks.slice(0, 10).map((risk) => (
                      <tr key={risk.id}>
                        <td>
                          <span className="oi-table__name">{risk.title}</span>
                          <span className="oi-table__sub">{risk.area} - {risk.registered ? 'registered' : 'derived on read'}</span>
                        </td>
                        <td className="oi-table__num">{num(risk.severity)}/5</td>
                        <td><span className="oi-chip">{risk.rootCauseFamily}</span></td>
                        <td><span className={`oi-chip oi-chip--${risk.state === 'mitigated' ? 'ok' : risk.owner ? 'info' : 'warn'}`}>{risk.owner ? 'owned' : risk.state}</span></td>
                        <td><button type="button" className="u-btn u-btn-ghost u-btn-sm" onClick={() => setOpenRisk(openRisk === risk.id ? null : risk.id)}>Why</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {openRisk && (() => {
              const risk = visibleRisks.find((r) => r.id === openRisk);
              return risk ? <RiskDetail risk={risk} /> : null;
            })()}
          </Panel>

          <Panel title="Priority map" hint="severity from gaps and actions">
            <ScoreBars
              rows={[
                ...visibleGaps.slice(0, 4).map((g) => ({ key: `Gap: ${g.title}`, value: g.severity })),
                ...visibleRecommendations.slice(0, 4).map((r) => ({ key: `Action: ${r.recommendation}`, value: r.severity })),
              ]}
              label="Highest scored findings and actions"
            />
            <p className="bc-note">{recommendations.method.priority}</p>
          </Panel>
        </div>

        <Panel title="What should the organization do next?" hint={`${recommendations.total} supported actions`}>
          {visibleRecommendations.length === 0 ? (
            <ConsequenceEmpty
              missing="a supported recommendation"
              produces="No supported gap, risk, or learning opportunity currently produces a recommendation."
            />
          ) : (
            <div className="oi-recs">
              {visibleRecommendations.slice(0, 5).map((recommendation) => (
                <RecommendationCard recommendation={recommendation} key={recommendation.id} />
              ))}
            </div>
          )}
          <p className="bc-note">{recommendations.method.benefit}</p>
        </Panel>
      </div>

      <DerivationFooter derivation={decisions.derivation} />
    </div>
  );
}

function CategoryDetail({ point, accuracyMode }: { point: NonNullable<DecisionIntelligenceData['acceptanceVsEvidence']['points'][number]>; accuracyMode: boolean }) {
  return (
    <article className="oi-finding" style={{ marginBottom: 8 }}>
      <div className="oi-finding__top">
        <h4 className="oi-finding__title">{point.category}</h4>
        <span className="oi-chips">
          <span className="oi-chip oi-chip--mono">{count(point.recommendations)} recommendations</span>
          <span className="oi-chip oi-chip--mono">accepted {pct(point.acceptance)}</span>
          <span className="oi-chip oi-chip--mono">
            {accuracyMode ? `accuracy ${pct(point.accuracy)}` : `evidence ${pct(point.evidenceSupport)}`}
          </span>
        </span>
      </div>
      <p className="oi-finding__detail">
        {accuracyMode
          ? `${count(point.outcomes)} outcomes recorded, ${count(point.successes)} successful. Categories without outcomes are not plotted as zero.`
          : `${count(point.evidenced)} recommendations have linked evidence. High acceptance with weak evidence is approval on trust, not proof of quality.`}
      </p>
    </article>
  );
}

function CompactGap({ gap }: { gap: Gap }) {
  return (
    <article className="oi-finding">
      <div className="oi-finding__top">
        <span className={`oi-chip oi-chip--${gap.band === 'critical' ? 'crit' : gap.band === 'high' ? 'warn' : 'info'}`}>{gap.band}</span>
        <h4 className="oi-finding__title">{gap.title}</h4>
        <span className="oi-chips">
          <span className="oi-chip oi-chip--mono">severity {num(gap.severity)}/5</span>
          <ConfidenceBar confidence={gap.confidence} />
        </span>
      </div>
      <p className="oi-finding__detail">{gap.whyItMatters}</p>
      <div style={{ marginTop: 8 }}><EvidenceList evidence={gap.evidence} /></div>
    </article>
  );
}

function RiskDetail({ risk }: { risk: Risk }) {
  return (
    <div className="oi-finding" style={{ marginTop: 12 }}>
      <div className="oi-finding__top">
        <h4 className="oi-finding__title">{risk.title}</h4>
        <span className="oi-chips">
          <span className="oi-chip oi-chip--mono">severity {num(risk.severity)}/5 - {risk.severitySource}</span>
          <ConfidenceBar confidence={risk.confidence} showBand />
        </span>
      </div>
      <p className="oi-finding__detail">{risk.detail}</p>
      <div className="oi-rec__grid" style={{ marginTop: 10 }}>
        <div className="oi-block">
          <div className="oi-block__label">Likelihood</div>
          <div className="oi-block__body">{risk.likelihoodBasis}</div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">Impact</div>
          <div className="oi-block__body">{risk.impactBasis}</div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">Evidence</div>
          <div className="oi-block__body"><EvidenceList evidence={risk.evidence} /></div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">Action</div>
          <div className="oi-block__body">{risk.recommendedAction}</div>
        </div>
      </div>
      <ProvenanceDetails provenance={risk.provenance} summary="Risk calculation and source rows" />
    </div>
  );
}
