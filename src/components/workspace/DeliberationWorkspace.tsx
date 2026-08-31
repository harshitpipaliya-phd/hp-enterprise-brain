
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Scale, Send, XCircle } from 'lucide-react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { EmptyState, ErrorState, LoadingState } from '../shared/States';
import { badgeTone, formatDateTime, formatNumber, formatPercent } from './intelligenceShared';
import { HeaderActions, PageHeader } from '../../ui';
import './IntelligenceSuite.css';
import { operationsApi } from '../../api/operations';
import type { LoopMetrics } from '../../api/operations';
import { DistributionPanel, LifecyclePanel } from './OperationalIntelligencePanels';

type DeliberationOverview = any;

export default function DeliberationWorkspace({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<DeliberationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  /*
    THE LIFECYCLE, WITH THE REASON EACH EMPTY STAGE IS EMPTY.

    This screen's own summary can say how many recommendations are pending; it
    cannot say WHY there are none, and "Pending Recommendations 0" on an
    organization whose five investigations have not yet reached a hypothesis
    reads as a broken product rather than as an accurate report. The loop
    aggregate carries the state and the sentence for every stage.

    Loaded separately and allowed to fail — the deliberation overview is the
    screen, this is the context around it.
  */
  const [loop, setLoop] = useState<LoopMetrics | null>(null);

  // Case context is fetched per recommendation, on demand, and cached by id.
  // It is a second round-trip on purpose: the overview says what the brain
  // recommends, and only a reader who asks gets told what it stood on.
  const [openRecommendationId, setOpenRecommendationId] = useState<string | null>(null);
  const [caseContextById, setCaseContextById] = useState<Record<string, any>>({});
  const [caseContextError, setCaseContextError] = useState<Record<string, string>>({});
  const [caseContextLoading, setCaseContextLoading] = useState<string | null>(null);
  const [proposalTextById, setProposalTextById] = useState<Record<string, string>>({});
  const [decisionNoteById, setDecisionNoteById] = useState<Record<string, string>>({});
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const toggleRecommendation = async (recommendationId: string) => {
    if (openRecommendationId === recommendationId) {
      setOpenRecommendationId(null);
      return;
    }

    setOpenRecommendationId(recommendationId);

    if (caseContextById[recommendationId]) return;

    setCaseContextLoading(recommendationId);
    setCaseContextError((current) => {
      const { [recommendationId]: _dropped, ...rest } = current;
      return rest;
    });

    try {
      const context = await decisionIntelligenceApi.getRecommendationCaseContext(tenantId, recommendationId);
      setCaseContextById((current) => ({ ...current, [recommendationId]: context }));
    } catch (e: any) {
      setCaseContextError((current) => ({
        ...current,
        [recommendationId]: e?.message ?? 'Unable to load what this recommendation cited.',
      }));
    } finally {
      setCaseContextLoading(null);
    }
  };

  const load = async ({ background = false } = {}) => {
    const useBackgroundRefresh = background || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const overview = await decisionIntelligenceApi.getDeliberationOverview(tenantId, 1, 8);
      setData(overview);
      setSelectedCaseId((current) => current ?? overview?.focus?.selectedCaseId ?? overview?.cases?.items?.[0]?.id ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load deliberation workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const proposeDecision = async (recommendation: any) => {
    const rationale = (proposalTextById[recommendation.id] || recommendation.description || recommendation.title || '').trim();
    if (rationale.length < 10) {
      setActionError('A decision rationale must be at least 10 characters.');
      return;
    }

    setActionBusyId(`recommendation:${recommendation.id}`);
    setActionError(null);
    setActionMessage(null);

    try {
      const decision = await decisionIntelligenceApi.proposeRecommendationDecision(tenantId, recommendation.id, rationale);
      setActionMessage(`Decision ${decision.id} is proposed and waiting for governance review.`);
      await load({ background: true });
    } catch (e: any) {
      setActionError(e?.message ?? 'Unable to record the decision proposal.');
    } finally {
      setActionBusyId(null);
    }
  };

  const decide = async (decisionId: string, action: 'approve' | 'reject') => {
    const note = (decisionNoteById[decisionId] || '').trim();
    if (action === 'reject' && note.length < 10) {
      setActionError('A rejection note must be at least 10 characters.');
      return;
    }

    setActionBusyId(`decision:${decisionId}:${action}`);
    setActionError(null);
    setActionMessage(null);

    try {
      const decision = action === 'approve'
        ? await decisionIntelligenceApi.approveDecision(tenantId, decisionId, note ? { note } : {})
        : await decisionIntelligenceApi.rejectDecision(tenantId, decisionId, { note });

      setActionMessage(`Decision ${decision.id} is now ${decision.status}.`);
      await load({ background: true });
    } catch (e: any) {
      setActionError(e?.message ?? `Unable to ${action} the decision.`);
    } finally {
      setActionBusyId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    operationsApi.getLoop(tenantId)
      .then((result) => { if (!cancelled) setLoop(result); })
      .catch(() => { if (!cancelled) setLoop(null); });
    return () => { cancelled = true; };
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [tenantId]);

  const selectedCase = useMemo(() => {
    if (!data) return null;
    const fallbackId = selectedCaseId ?? data.focus?.selectedCaseId ?? data.cases?.items?.[0]?.id ?? null;
    if (!fallbackId) return null;
    return data.cases?.detailsById?.[fallbackId] ?? null;
  }, [data, selectedCaseId]);

  if (loading && !data) return <LoadingState label="Loading deliberation workspace..." />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="intel-page intel-deliberation">
      <PageHeader
        variant="intelligence"
        icon={<Scale />}
        title="Cases & Deliberation"
        description="Investigations, hypotheses, evidence and decisions being evaluated."
        meta={[
          { label: data.organization?.name || 'Organization', title: 'Current tenant scope' },
          {
            label: `${formatNumber(data.summary?.pendingDecisions)} pending decision${data.summary?.pendingDecisions === 1 ? '' : 's'}`,
            title: 'Waiting for governance attention',
          },
        ]}
        actions={(
          <HeaderActions>
            <button type="button" className="u-btn u-btn-secondary" onClick={() => load({ background: true })} disabled={refreshing}>
              <RefreshCw size={15} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </HeaderActions>
        )}
        aside={(
          /* The one figure this screen exists to surface, held beside the
             actions rather than buried in the stat grid below. */
          <div className="intel-score-card">
            <span className="intel-subtle">Current Bottleneck</span>
            <strong>{data.focus?.biggestBottleneck?.label || 'Nothing is stuck'}</strong>
            <p>
              {data.focus?.biggestBottleneck?.conversionRate != null
                ? `${formatPercent(data.focus.biggestBottleneck.conversionRate)} conversion from the previous stage`
                : 'No complete stage conversion metric is available yet.'}
            </p>
            {refreshing && <div className="intel-refresh-chip" data-variant="deliberation">Refreshing case intelligence...</div>}
          </div>
        )}
      />

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">Deliberation Health</span>
            <h2>Active investigation posture</h2>
          </div>
        </div>
        <div className="intel-stat-grid">
          {[
            ['Open Cases', data.summary?.openCases, 'Cases not yet resolved'],
            ['Active Investigations', data.summary?.activeInvestigations, 'Still being worked'],
            ['Pending Recommendations', data.summary?.pendingRecommendations, 'Waiting for decision'],
            ['Pending Decisions', data.summary?.pendingDecisions, 'Governance queue'],
            ['Average Decision Age', data.summary?.averageDecisionAgeDays != null ? `${data.summary.averageDecisionAgeDays} days` : 'No open decisions', 'How long the queue has been waiting'],
            ['Evidence Coverage', data.summary?.evidenceCoverage != null ? formatPercent(data.summary.evidenceCoverage) : 'No open cases', 'Open cases that have evidence attached'],
            ['High and Critical Risks', data.summary?.highCriticalRisks, 'Risks scoring 0.50 or above'],
            ['Overdue Decisions', data.summary?.overdueDecisions ?? 'Not tracked', data.summary?.overdueDecisionNote || 'No due dates are recorded on decisions'],
          ].map(([label, value, note]) => (
            <article key={String(label)} className="intel-kpi" data-tone={badgeTone(String(label).includes('Risk') ? 'high' : label === 'Evidence Coverage' ? 'active' : 'pending')}>
              <span className="intel-kpi-label">{label}</span>
              <div className="intel-kpi-value">{typeof value === 'number' ? formatNumber(value) : value}</div>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </section>

      {/*
        WHAT IS ACTUALLY BEING INVESTIGATED, and where the loop stops.

        Every figure below is a count over this organization's own case,
        evidence and signal rows. A stage with nothing in it renders the reason
        rather than a zero — see IntelligenceLoopMetrics on the server.
      */}
      {loop && <LifecyclePanel stages={loop.stages} />}

      {loop?.cases.supported && (
        <section className="intel-section">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Investigation posture</span>
              <h2>Where each investigation has reached</h2>
            </div>
          </div>
          <div className="intel-stat-grid">
            {[
              ['Investigations', loop.cases.total, 'Opened against detected signals'],
              ['Still open', loop.cases.open ?? 0, `${loop.cases.closed ?? 0} closed`],
              ['Awaiting a cause', loop.cases.awaitingHypothesis ?? 0, 'No hypothesis recorded yet — the loop stops here'],
              ['Root cause identified', loop.cases.withResolvedCause ?? 0, 'A hypothesis has been accepted'],
              ['Average age', loop.cases.averageAgeDays != null ? `${loop.cases.averageAgeDays} days` : 'Not dated', 'Across every investigation'],
              ['Oldest open', loop.cases.oldestOpenDays != null ? `${loop.cases.oldestOpenDays} days` : 'None open', 'The one that has waited longest'],
            ].map(([label, value, note]) => (
              <article key={String(label)} className="intel-kpi" data-tone="pending">
                <span className="intel-kpi-label">{label}</span>
                <div className="intel-kpi-value">{typeof value === 'number' ? formatNumber(value) : value}</div>
                <small>{note}</small>
              </article>
            ))}
          </div>

          <div className="opsi-grid-2">
            <DistributionPanel
              title="Severity carried over from the triggering signal"
              rows={(loop.cases.bySeverity ?? []).map((r) => ({ name: r.label, records: r.count, share: r.share }))}
              empty="No investigation is linked to a signal carrying a severity."
              note="A case has no severity of its own; this is the severity of the signal it was opened for."
            />
            <DistributionPanel
              title="Investigation status"
              rows={(loop.cases.byStatus ?? []).map((r) => ({ name: r.label, records: r.count, share: r.share }))}
              empty="No investigation carries a status."
            />
          </div>
        </section>
      )}

      <section className="intel-section intel-deliberation-shell">
        <div className="intel-case-list">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Case Explorer</span>
              <h2>Investigations</h2>
            </div>
          </div>
          {data.cases?.items?.length ? data.cases.items.map((item: any) => (
            <button
              type="button"
              key={item.id}
              className={`intel-case-row ${selectedCaseId === item.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedCaseId(item.id)}
            >
              <div className="intel-inline-list">
                <strong>{item.title}</strong>
                <span className="intel-pill" data-tone={badgeTone(item.severity || item.status)}>{item.severity || item.status}</span>
              </div>
              <div className="intel-case-grid">
                <span>Status: {item.status || 'unknown'}</span>
                <span>Evidence: {formatNumber(item.evidenceCount)}</span>
                <span>Age: {item.ageDays != null ? `${item.ageDays} days` : 'not dated'}</span>
                <span>Confidence: {item.confidence != null ? formatPercent(item.confidence) : 'not scored'}</span>
              </div>
              <small>{item.currentHypothesis?.statement || item.nextAction}</small>
            </button>
          )) : <EmptyState icon="○" message="No investigation has been opened yet. Cases are opened against signals that need looking into." />}
        </div>

        <div className="intel-case-detail">
          <div className="intel-section-head">
            <div>
              <span className="intel-eyebrow">Case Intelligence</span>
              <h2>{selectedCase?.summary?.title || 'Select a case'}</h2>
              <p>{selectedCase?.summary?.status ? `Status: ${selectedCase.summary.status}` : 'Choose a case to inspect its evidence, hypotheses, reasoning, and decision trail.'}</p>
            </div>
          </div>

          {selectedCase ? (
            <>
              <div className="intel-inline-list">
                <span className="intel-pill" data-tone={badgeTone(selectedCase.summary?.severity || selectedCase.summary?.status)}>{selectedCase.summary?.severity || selectedCase.summary?.status}</span>
                <span className="intel-pill" data-tone="info">{selectedCase.summary?.classification || 'Unclassified'}</span>
                <span className="intel-pill" data-tone="warn">{selectedCase.summary?.confidence != null ? `${formatPercent(selectedCase.summary.confidence)} confidence` : 'Not scored'}</span>
              </div>

              <div className="intel-timeline">
                {selectedCase.timeline?.map((stage: any) => (
                  <div key={stage.stage} className="intel-timeline-stage">
                    <div className="intel-timeline-label">{stage.stage}</div>
                    <div className="intel-timeline-card">
                      {stage.items?.length ? stage.items.map((entry: any) => (
                        <div key={entry.id} className="intel-timeline-item">
                          <strong>{entry.title}</strong>
                          <div className="intel-inline-list">
                            <span className="intel-mini-badge" data-tone={badgeTone(entry.status)}>{entry.status}</span>
                            <small>{entry.confidence != null ? `${formatPercent(entry.confidence)} confidence` : ''}</small>
                            <small>{formatDateTime(entry.timestamp)}</small>
                          </div>
                        </div>
                      )) : <div className="intel-note">Nothing has been recorded at this stage yet.</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="intel-reco-block">
                <div className="intel-section-head">
                  <div>
                    <span className="intel-eyebrow">What the Brain suggests</span>
                    <h3>Recommended action</h3>
                  </div>
                </div>

                {selectedCase.recommendations?.length ? selectedCase.recommendations.map((rec: any) => {
                  const isOpen = openRecommendationId === rec.id;
                  const context = caseContextById[rec.id];
                  const contextError = caseContextError[rec.id];
                  const linkedDecision = selectedCase.decisions?.find((decision: any) => decision.recommendationId === rec.id);
                  const proposalText = proposalTextById[rec.id] ?? rec.description ?? rec.title ?? '';
                  const proposalBusy = actionBusyId === `recommendation:${rec.id}`;

                  return (
                    <article key={rec.id} className="intel-reco-card" data-open={isOpen ? 'true' : 'false'}>
                      <button
                        type="button"
                        className="intel-reco-head"
                        onClick={() => toggleRecommendation(rec.id)}
                        aria-expanded={isOpen}
                      >
                        <strong>{rec.title}</strong>
                        <div className="intel-inline-list">
                          <span className="intel-pill" data-tone="info">{rec.category || 'Uncategorised'}</span>
                          <span className="intel-pill" data-tone={badgeTone(rec.priority)}>{rec.priority || 'unprioritised'}</span>
                          <span className="intel-mini-badge" data-tone={badgeTone(rec.status)}>{rec.status}</span>
                          <small>Confidence: {rec.confidence != null ? formatPercent(rec.confidence) : 'not scored'}</small>
                        </div>
                      </button>

                      {rec.description && <p className="intel-reco-rationale">{rec.description}</p>}

                      <div className="intel-decision-gate">
                        <div className="intel-inline-list">
                          <span className="intel-mini-badge" data-tone={badgeTone(linkedDecision?.status || 'pending')}>
                            Decision: {linkedDecision?.status || 'not proposed'}
                          </span>
                          {linkedDecision?.id && <small>{linkedDecision.id}</small>}
                        </div>

                        {!linkedDecision ? (
                          <div className="intel-gate-form">
                            <textarea
                              value={proposalText}
                              onChange={(event) => setProposalTextById((current) => ({
                                ...current,
                                [rec.id]: event.target.value,
                              }))}
                              rows={3}
                              aria-label={`Decision rationale for ${rec.title}`}
                            />
                            <button
                              type="button"
                              className="intel-action-button"
                              onClick={() => proposeDecision(rec)}
                              disabled={proposalBusy}
                            >
                              <Send size={15} /> {proposalBusy ? 'Recording...' : 'Send to governance'}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {isOpen && (
                        <div className="intel-reco-evidence">
                          {caseContextLoading === rec.id && <div className="intel-note">Loading cited evidence...</div>}
                          {contextError && <div className="intel-note">{contextError}</div>}

                          {context && (
                            <>
                              <div className="intel-inline-list">
                                <span className="intel-mini-badge" data-tone="good">
                                  Cited evidence: {formatNumber(context.groundedOn?.length ?? 0)}
                                </span>
                                <span className="intel-mini-badge" data-tone="info">
                                  Other evidence in case: {formatNumber(context.caseContext?.evidenceCount ?? 0)}
                                </span>
                              </div>

                              {context.groundedOn?.length ? (
                                <ul className="intel-reco-evidence-list">
                                  {context.groundedOn.map((evidenceId: string) => (
                                    <li key={evidenceId}>{evidenceId}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="intel-note">This recommendation cited no evidence.</div>
                              )}

                              {/* The resolution path, verbatim from the endpoint. A reader
                                  who wants to know how this recommendation was tied to this
                                  case should not have to take the link on trust. */}
                              <small className="intel-reco-path">{context.resolution?.via}</small>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }) : <EmptyState icon="○" message="Nothing has been recommended for this case yet." />}
              </div>
            </>
          ) : (
            <EmptyState icon="○" message="Select an investigation on the left to see its evidence, what could explain it, and what is recommended." />
          )}
        </div>
      </section>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">Decision Queue</span>
            <h2>Requires attention</h2>
          </div>
        </div>
        <div className="intel-panel">
          {(actionError || actionMessage) && (
            <div className="intel-gate-status" data-tone={actionError ? 'warn' : 'good'}>
              {actionError || actionMessage}
            </div>
          )}
          <div className="intel-table-wrap">
            <table className="intel-table">
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Related Case</th>
                  <th>Recommendation</th>
                  <th>Confidence</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Age</th>
                  <th>Status</th>
                  <th>Governance</th>
                </tr>
              </thead>
              <tbody>
                {data.decisionQueue?.items?.length ? data.decisionQueue.items.map((item: any) => (
                  <tr key={item.id}>
                    <td>{item.decision || 'Decision'}</td>
                    <td>{item.caseTitle || (item.caseId ? `Case ${String(item.caseId).slice(0, 8)}` : <span className="intel-muted">Not linked</span>)}</td>
                    <td>{item.recommendation || <span className="intel-muted">Not linked</span>}</td>
                    <td>{item.confidence != null ? formatPercent(item.confidence) : <span className="intel-muted">—</span>}</td>
                    <td>{item.priority || <span className="intel-muted">—</span>}</td>
                    <td>{item.owner || <span className="intel-muted">Unassigned</span>}</td>
                    <td>{item.ageDays != null ? `${item.ageDays} days` : <span className="intel-muted">—</span>}</td>
                    <td><span className="intel-pill" data-tone={badgeTone(item.status)}>{item.status}</span></td>
                    <td>
                      <div className="intel-gate-table-actions">
                        <textarea
                          value={decisionNoteById[item.id] ?? ''}
                          onChange={(event) => setDecisionNoteById((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))}
                          rows={2}
                          aria-label={`Governance note for ${item.decision || 'decision'}`}
                        />
                        <div className="intel-inline-actions">
                          <button
                            type="button"
                            className="intel-action-button"
                            onClick={() => decide(item.id, 'approve')}
                            disabled={actionBusyId === `decision:${item.id}:approve`}
                          >
                            <CheckCircle2 size={15} /> Approve
                          </button>
                          <button
                            type="button"
                            className="intel-action-button is-danger"
                            onClick={() => decide(item.id, 'reject')}
                            disabled={actionBusyId === `decision:${item.id}:reject`}
                          >
                            <XCircle size={15} /> Reject
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9}>No decision is waiting. Propose one from a recommendation above and it will arrive here for approval.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
