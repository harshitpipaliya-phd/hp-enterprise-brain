import { useCallback, useEffect, useState } from 'react';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type { DecisionIntelligenceData, Risk } from '../../api/organizationIntelligence';
import { API_BASE, authToken } from '../../api/client.js';
import {
  LayerStrip, StateLayer, MovementLayer, ConsequenceLayer, LayerFigure, LayerPoints,
  ConsequenceEmpty, Undetermined, Panel, Quadrant, RiskMatrix, HBars, Funnel,
  Button, Spinner, ErrorState,
} from '../../ui';
import {
  ConfidenceBar, ProvenanceDetails, EvidenceList, IntelligenceHeader, DerivationFooter,
  ExecutiveInterpretationPanel, pct, num, count,
} from './intelligenceUi';
import './OrganizationIntelligence.css';

/**
 * Decision Intelligence — "Are our decisions any good, and is anything we already
 * know about going uncovered?"
 *
 * THE HONEST VERSION OF THIS SCREEN IS MOSTLY ABOUT WHAT IT CANNOT SAY. Whether a
 * decision was right is knowable only from a recorded outcome. The previous build
 * rendered `Math.round(recommendationAccuracy * 100)` and so displayed a confident
 * "0%" for an organization that had never recorded one — asserting that every
 * decision it ever took was wrong, which is a far stronger and more damaging claim
 * than the truth. Accuracy is now rendered as UNDETERMINED with the missing table
 * named, and the screen falls back on acceptance against evidence support: a question
 * it can answer, about the same underlying worry.
 *
 * THE RISK REGISTER IS DERIVED, AND SAYS SO ON EVERY ROW. hpbrain_risks is empty
 * here, and an empty register reads as "no risks" rather than "nobody has looked".
 * The rows come from generators over the organization's operational records; each is
 * marked `derived` with no owner, because nothing was written down to own — and the
 * recommended action for a derived risk is to register it so somebody can.
 *
 * IMPACT IS A MAGNITUDE PROXY AND IS LABELLED AS ONE. No cost, penalty or revenue
 * data exists for this organization, so no monetary impact is shown anywhere.
 */
export default function DecisionIntelligence({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<DecisionIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRisk, setOpenRisk] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await organizationIntelligenceApi.getDecisions(tenantId, fresh));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load decision intelligence.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Reads the token through authToken() rather than localStorage directly, so the
   * export works in every session like the rest of the app. Sending no Authorization
   * header produced a 401 whose JSON body was then saved as decisions-<tenant>.csv —
   * a downloaded file that looked like a success.
   */
  const exportCsv = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/analytics/${tenantId}/decisions/export.csv`, {
        headers: { Authorization: `Bearer ${authToken()}` },
      });
      if (!res.ok) {
        setError(`Export failed (HTTP ${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `decisions-${tenantId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'Export failed.');
    }
  };

  if (loading && !data) {
    return <div className="oi-page"><Spinner label="Deriving decision intelligence" /></div>;
  }

  if (error && !data) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!data) return null;

  const {
    state, latency, accuracy, quality, byExecutor, categoryByExecutor,
    acceptanceVsEvidence, acceptanceVsAccuracy, openBeyond, rootCause, risks,
  } = data;

  const quadrant = accuracy.measurable ? acceptanceVsAccuracy : acceptanceVsEvidence;
  const quadrantPoints = (quadrant.points ?? []).filter((p) =>
    p.acceptance !== null && (accuracy.measurable ? p.accuracy != null : p.evidenceSupport != null));
  const maxRecs = Math.max(1, ...(quadrant.points ?? []).map((p) => p.recommendations));

  const executorRows = Object.entries(byExecutor)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);

  const executorTypes = [...new Set(Object.values(categoryByExecutor).flatMap((row) => Object.keys(row)))].sort();
  const categories = Object.keys(categoryByExecutor).sort();

  return (
    <div className="oi-page">
      <IntelligenceHeader
        eyebrow="Analytics"
        title="Decision Intelligence"
        question="Are our decisions any good — and is anything we already know about going uncovered?"
        meta={data}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            <Button variant="secondary" onClick={() => void load(true)} disabled={loading}>Recompute</Button>
          </>
        }
      />

      {error && <div className="u-alert u-alert-danger" style={{ marginBottom: 14 }}><div className="u-alert-body">{error}</div></div>}

      <LayerStrip>
        <StateLayer>
          <LayerFigure
            value={state.decisions}
            unit={state.decisions === 1 ? ' decision' : ' decisions'}
            note={
              state.decisions === 0
                ? 'Nothing has been decided, so nothing downstream of a decision has an input.'
                : `${state.pipeline.approved} approved · ${state.pipeline.rejected} rejected · ${state.pipeline.pending} still open. Acceptance ${pct(state.acceptanceRate)}.`
            }
          />
        </StateLayer>

        <MovementLayer>
          <LayerPoints
            points={[
              accuracy.measurable ? (
                <>
                  Acceptance is <strong>{pct(state.acceptanceRate)}</strong> and accuracy <strong>{pct(accuracy.value)}</strong>
                  {' '}over {count(accuracy.outcomes)} recorded outcomes. High acceptance with lower accuracy means
                  recommendations are being approved faster than they are being validated.
                </>
              ) : (
                <>
                  Acceptance is <strong>{pct(state.acceptanceRate)}</strong> and accuracy is <strong>undetermined</strong> —
                  {' '}nothing measures whether any of it worked, so the two cannot be compared at all.
                </>
              ),
              state.decisionCoverage !== null ? (
                <>
                  <strong>{pct(state.decisionCoverage)}</strong> of {count(state.recommendations)} recommendations reached a
                  decision in either direction. {latency.measurable
                    ? <>Mean time from recommendation to decision {num(latency.meanHours, 1)}h, worst {num(latency.maxHours, 1)}h.</>
                    : <>No decision is linked to a recommendation, so there is no interval to measure.</>}
                </>
              ) : (
                <>No recommendation exists for this organization, so there is nothing to decide on.</>
              ),
              quality.unevidenced.share !== null && quality.unevidenced.share > 0 ? (
                <>
                  <strong>{count(quality.unevidenced.unevidenced)} of {count(quality.unevidenced.total)}</strong> recommendations
                  carry no evidence link, so {quality.unevidenced.share === 1 ? 'every' : 'that share of'} approval rests on trust
                  rather than on a traceable source.
                </>
              ) : (
                <>Every recommendation carries a traceable evidence path.</>
              ),
            ]}
          />
        </MovementLayer>

        <ConsequenceLayer>
          {risks.open === 0 && openBeyond.open === 0 ? (
            <ConsequenceEmpty
              missing="an open risk or an undecided decision"
              produces="Nothing is waiting on a decision and no risk is open. Both were checked, so this is empty rather than unexamined."
            />
          ) : (
            <LayerPoints
              points={[
                ...(risks.open > 0
                  ? [<>
                      <strong>{risks.open} risk{risks.open === 1 ? '' : 's'} open</strong>, worst severity {num(risks.maxSeverity)}/5.
                      {' '}{risks.unowned === risks.open
                        ? 'None is registered, so nobody owns any of them.'
                        : `${risks.unowned} without an owner.`}
                    </>]
                  : []),
                ...(openBeyond.open > 0
                  ? [<>
                      <strong>{openBeyond.open} decision{openBeyond.open === 1 ? '' : 's'} still open</strong>, the oldest for
                      {' '}{count(openBeyond.maxDays)} days, mean {num(openBeyond.meanDays, 0)} days.
                    </>]
                  : []),
                ...(!accuracy.measurable
                  ? [<>
                      <strong>Recording one outcome</strong> is the cheapest intervention available: it turns accuracy,
                      decision quality and every learning figure from undetermined into measured.
                    </>]
                  : []),
              ]}
            />
          )}
        </ConsequenceLayer>
      </LayerStrip>

      {state.provenanceNote && (
        <div className="u-alert u-alert-warning" style={{ marginBottom: 16 }}>
          <div className="u-alert-title">Provenance of these decisions</div>
          <div className="u-alert-body">{state.provenanceNote}</div>
        </div>
      )}

      <div className="oi-sections" style={{ marginBottom: 18 }}>
        <ExecutiveInterpretationPanel interpretation={data.interpretation} />
      </div>

      <div className="oi-sections">
        <div className="bl-grid bl-grid--2">
          <Panel
            title={accuracy.measurable ? 'Acceptance against accuracy, by category' : 'Acceptance against evidence support, by category'}
            hint="bubble area = recommendations"
            footnote={<>{quadrant.why}</>}
          >
            {!accuracy.measurable && (
              <div style={{ marginBottom: 12 }}>
                <Undetermined
                  question="How often were our decisions right?"
                  gaps={accuracy.gaps.length ? accuracy.gaps : ['hpbrain_outcomes']}
                />
                <p className="bc-note">{accuracy.why} {accuracy.howToFix}</p>
              </div>
            )}

            {quadrantPoints.length === 0 ? (
              <ConsequenceEmpty
                missing="a recommendation category with a measurable acceptance rate"
                produces="Recommendations need a category and a decision before this can be plotted."
              />
            ) : (
              <div className="bl-scroll">
                <Quadrant
                  points={quadrantPoints.map((p) => ({
                    key: p.category,
                    x: p.acceptance ?? 0,
                    y: (accuracy.measurable ? p.accuracy : p.evidenceSupport) ?? 0,
                    r: 6 + Math.sqrt(p.recommendations / maxRecs) * 12,
                    // The dangerous corner: waved through without support.
                    hot: (p.acceptance ?? 0) >= 0.5 && ((accuracy.measurable ? p.accuracy : p.evidenceSupport) ?? 0) < 0.5,
                  }))}
                  xLabel={`${(quadrant.xLabel ?? 'ACCEPTED').toUpperCase()} →`}
                  yLabel={`${(quadrant.yLabel ?? '').toUpperCase()} →`}
                  quadrantLabels={[{ x: 0.97, y: 0.94, text: (quadrant.hotCorner ?? '').toUpperCase(), hot: true, anchor: 'end' }]}
                  width={480}
                  height={320}
                  label={`${quadrant.yLabel} against ${quadrant.xLabel} by category`}
                />
              </div>
            )}
            {quadrant.provenance && <ProvenanceDetails provenance={quadrant.provenance} />}
          </Panel>

          <Panel
            title="Likelihood against impact"
            hint="bubble = risks in that cell"
            footnote={<>
              {risks.method.severity} <strong>Impact is a magnitude proxy</strong> — {risks.method.impact}
            </>}
          >
            {risks.matrix.cells.length === 0 ? (
              <ConsequenceEmpty
                missing="a risk with both a likelihood and an impact"
                produces="Risks are derived from operational records; this organization's records trigger none of the detection rules."
              />
            ) : (
              <div className="bl-scroll">
                <RiskMatrix
                  cells={risks.matrix.cells}
                  unplaceable={risks.matrix.unplaceable.length}
                  label="Open risks by likelihood band and impact band"
                />
              </div>
            )}
          </Panel>
        </div>

        <div className="bl-grid bl-grid--wide-left">
          <Panel
            title="Risk register"
            hint={`${risks.derived} derived · ${risks.registered} registered · ${risks.unowned} unowned`}
            footnote={<>
              Severity is computed, not entered — a risk cannot be talked down without changing its
              likelihood evidence or its impact class. <strong>A derived risk has no owner because nothing
              was written to the register</strong>; registering it is what makes it ownable.
            </>}
          >
            {risks.register.length === 0 ? (
              <ConsequenceEmpty
                missing="a detected or registered risk"
                produces="Every detection rule ran against this organization's records and none matched, and the register is empty."
              />
            ) : (
              <div className="bl-scroll">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th>Risk</th>
                      <th>L</th>
                      <th>I</th>
                      <th>Severity</th>
                      <th>Cause</th>
                      <th>State</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {risks.register.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="oi-table__name">{r.title}</span>
                          <span className="oi-table__sub">{r.area} · {r.registered ? 'registered' : 'derived on read'}</span>
                        </td>
                        <td className="oi-table__num">{r.likelihoodBand ?? '—'}</td>
                        <td className="oi-table__num">{r.impactBand ?? '—'}</td>
                        <td className="oi-table__num">
                          <span className={r.severity !== null && r.severity >= 3.5 ? 'oi-chip oi-chip--crit' : 'oi-chip oi-chip--mono'}>
                            {num(r.severity)}
                          </span>
                        </td>
                        <td><span className="oi-chip">{r.rootCauseFamily}</span></td>
                        <td>
                          <span className={`oi-chip oi-chip--${r.state === 'mitigated' ? 'ok' : r.owner ? 'info' : 'warn'}`}>
                            {r.state === 'mitigated' ? 'mitigated' : r.owner ? 'owned' : 'unowned'}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="u-btn u-btn-ghost u-btn-sm"
                            onClick={() => setOpenRisk(openRisk === r.id ? null : r.id)}
                            aria-expanded={openRisk === r.id}>
                            {openRisk === r.id ? 'Hide' : 'Why'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {openRisk && (() => {
              const r = risks.register.find((x) => x.id === openRisk);
              return r ? <RiskDetail risk={r} /> : null;
            })()}
          </Panel>

          <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
            <Panel
              title="Root cause of what was decided"
              hint={rootCause.source === 'hypotheses' ? 'from raised hypotheses' : 'from risk generators'}
              footnote={<>{rootCause.why}</>}
            >
              {rootCause.distribution.every((d) => d.count === 0) ? (
                <ConsequenceEmpty
                  missing="a classified hypothesis or a detected risk"
                  produces="Raise a hypothesis in Deliberation and classify it against the root-cause taxonomy."
                />
              ) : (
                <div className="bl-scroll">
                  <HBars
                    rows={rootCause.distribution.map((d) => ({ key: d.family, value: d.count }))}
                    width={380}
                    labelWidth={100}
                    label="Root-cause family distribution"
                  />
                </div>
              )}
              <ProvenanceDetails provenance={rootCause.provenance} />
            </Panel>

            <Panel
              title="Decision pipeline"
              hint="proposed → decided → executed"
              footnote="Each step's share is of the step before it, so a collapse is visible where it happens rather than only at the end."
            >
              <Funnel
                steps={[
                  { key: 'Recommendations', value: state.recommendations },
                  { key: 'Decided', value: state.pipeline.approved + state.pipeline.rejected },
                  { key: 'Approved', value: state.pipeline.approved },
                ]}
                width={360}
                label="Recommendation to approval funnel"
              />
            </Panel>
          </div>
        </div>

        <div className="bl-grid bl-grid--2">
          <Panel
            title="Decision quality checks"
            hint="deterministic, over every decision"
            footnote={<>
              Each of these is a count over the organization's own rows. The confidence floor of
              {' '}{num(quality.confidenceFloor)} is the same one the reasoning service applies, read from
              configuration rather than restated here.
            </>}
          >
            <div className="bl-grid bl-grid--2" style={{ gap: 12 }}>
              <Check label="Decisions with no recommendation behind them" value={quality.withoutRecommendation} bad={quality.withoutRecommendation > 0} />
              <Check label="Decisions with no rationale recorded" value={quality.withoutRationale} bad={quality.withoutRationale > 0} />
              <Check label={`Decisions taken below confidence ${num(quality.confidenceFloor)}`} value={quality.belowConfidenceFloor} bad={quality.belowConfidenceFloor > 0} />
              <Check label="Recommendations with no evidence linked" value={quality.unevidenced.unevidenced} bad={quality.unevidenced.unevidenced > 0} />
            </div>

            <div style={{ marginTop: 12 }}>
              <span className="oi-chips">
                <span className="oi-chip oi-chip--mono">mean decision confidence {num(state.meanConfidence)}</span>
                {data.confidenceBands.map((b) => (
                  <span className="oi-chip oi-chip--mono" key={b.band}>reasoning {b.band}: {b.count}</span>
                ))}
              </span>
            </div>
          </Panel>

          <Panel
            title="Who ends up owning the work"
            hint="executor class by recommendation category"
            footnote="Categories with no decision are absent rather than shown as zero rows: nothing has been routed for them, which is different from routing nothing to anybody."
          >
            {executorRows.length === 0 ? (
              <ConsequenceEmpty
                missing="a decision with an executor class"
                produces="Executor class is set when a decision is recorded against a recommendation."
              />
            ) : (
              <>
                <div className="bl-scroll">
                  <HBars
                    rows={executorRows}
                    width={360}
                    labelWidth={100}
                    label="Decisions by executor class"
                  />
                </div>

                {categories.length > 0 && (
                  <div className="bl-scroll" style={{ marginTop: 12 }}>
                    <table className="oi-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          {executorTypes.map((t) => <th key={t}>{t}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((cat) => (
                          <tr key={cat}>
                            <td className="oi-table__name">{cat}</td>
                            {executorTypes.map((t) => (
                              <td className="oi-table__num" key={t}>
                                {categoryByExecutor[cat][t] ?? <span style={{ color: 'var(--content-tertiary)' }}>·</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>

      <DerivationFooter derivation={data.derivation} />
    </div>
  );
}

/* ─────────────────────────── risk detail ─────────────────────────── */

/**
 * One risk opened up: how likelihood and impact were arrived at, what rows triggered
 * it, and what to do about it.
 *
 * `impactKind` is rendered prominently. A magnitude proxy and an assessed impact are
 * different kinds of claim occupying the same axis, and a reader deciding how much to
 * spend on a mitigation needs to know which one they are reading.
 */
function RiskDetail({ risk }: { risk: Risk }) {
  return (
    <div className="oi-finding" style={{ marginTop: 12 }}>
      <div className="oi-finding__top">
        <h4 className="oi-finding__title">{risk.title}</h4>
        <span className="oi-chips">
          <span className="oi-chip oi-chip--mono">severity {num(risk.severity)}/5 · {risk.severitySource}</span>
          <ConfidenceBar confidence={risk.confidence} showBand />
        </span>
      </div>

      <p className="oi-finding__detail">{risk.detail}</p>

      <div className="oi-rec__grid" style={{ marginTop: 10 }}>
        <div className="oi-block">
          <div className="oi-block__label">Likelihood {risk.likelihood === null ? '' : num(risk.likelihood)}</div>
          <div className="oi-block__body">{risk.likelihoodBasis}</div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">
            Impact {risk.impact === null ? '' : num(risk.impact)}
            <span className={`oi-label oi-label--${risk.impactKind === 'magnitude_proxy' ? 'projected' : 'estimated'}`}>
              {risk.impactKind.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="oi-block__body">{risk.impactBasis}</div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">Evidence</div>
          <div className="oi-block__body"><EvidenceList evidence={risk.evidence} /></div>
        </div>
        <div className="oi-block">
          <div className="oi-block__label">Detected by</div>
          <div className="oi-block__body">
            Generator <strong>{risk.generator}</strong>, root cause <strong>{risk.rootCauseFamily}</strong>.
            {' '}{risk.registered ? 'Recorded in the register.' : 'Derived on read — no register entry, so no owner.'}
          </div>
        </div>
      </div>

      <div className="oi-rec__next">
        <b>Recommended action</b>
        {risk.recommendedAction}
      </div>

      <ProvenanceDetails provenance={risk.provenance} summary="The rule and rows behind this risk" />
    </div>
  );
}

function Check({ label, value, bad }: { label: string; value: number; bad: boolean }) {
  return (
    <div className="oi-block">
      <div className="oi-block__label">{label}</div>
      <div className="oi-block__body">
        <strong style={{ fontSize: 18, color: bad ? 'var(--feedback-error-content)' : 'var(--feedback-success-content)' }}>
          {count(value)}
        </strong>
      </div>
    </div>
  );
}
