
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Brain,
  Building2,
  FileSearch,
  GraduationCap,
  Lightbulb,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import SchoolIntelligence from './SchoolIntelligence';
import { EmptyState, ErrorState, LoadingState } from '../shared/States';
import { badgeTone, formatDateTime, formatNumber, formatPercent } from './intelligenceShared';
import type { View } from '../../App';
import './IntelligenceSuite.css';

type EnterpriseOverview = any;

/**
 * Intelligence Workspace — "what does this organization currently know about
 * itself?"
 *
 * WHAT THIS SCREEN WAS. Its eyebrow read "Executive Dashboard" and its heading
 * read "Enterprise Intelligence Workspace", while a *different* screen in the
 * sidebar is also called Executive Dashboard — so two nav entries led to two
 * pages both claiming to be the executive view, and this one led with a
 * "Priced Leakage / Recovered Value" ledger in the hero. That ledger is real,
 * but it is a sum of `expected_roi` over pending recommendation rows: for every
 * organization in this installation it totals nothing, because no recommendation
 * carries a priced value. A board-level page opening on two empty currency-shaped
 * figures reads as an organization that has lost nothing and recovered nothing,
 * which is a claim, not an absence.
 *
 * The value ledgers are kept, and render only when they have entries. The screen
 * now opens on what the organization actually holds.
 */
export default function IntelligenceWorkspace({ tenantId, onNavigate }: { tenantId: string; onNavigate?: (view: View) => void }) {
  const [data, setData] = useState<EnterpriseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async ({ background = false } = {}) => {
    const useBackgroundRefresh = background || !!data;
    if (useBackgroundRefresh && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      setData(await decisionIntelligenceApi.getEnterpriseOverview(tenantId));
    } catch (e: any) {
      setError(e?.message ?? 'Unable to load the intelligence workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantId]);

  const attention = useMemo(
    () => [...(data?.managementAttention || []), ...(data?.predictedIssues || [])],
    [data],
  );

  if (loading && !data) return <LoadingState label="Loading what this organization knows about itself…" />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return null;

  const signals = data.signalsEvidence ?? {};
  const decisions = data.decisionIntelligence ?? {};
  const departments = asArray(data.workforceDepartment?.attention);
  const capabilities = asArray(data.capabilityWorkforce?.attention);
  const recommendations = asArray(data.aiRecommendations);
  const outcomes = asArray(data.recentOutcomes);
  const learnings = asArray(data.reusableLearnings);
  const strengths = asArray(data.executiveSummary?.strengths);
  const weaknesses = asArray(data.executiveSummary?.weaknesses);
  const loopStages = asArray(data.loopContinuity?.stages);
  const pricedItems = asArray(data.valueRealization?.pricedLeakage?.items);
  const recoveredItems = asArray(data.valueRealization?.recovered?.items);
  const unpricedItems = asArray(data.valueRealization?.unpriced);

  /*
    Whether this organization has produced any intelligence at all.

    Counted over the things that would have to exist for any section below to
    have content. When none of them do, one honest paragraph beats eleven empty
    panels, each individually explaining that its own corner is empty.
  */
  const hasAnything = Number(signals.signalsTotal ?? 0) > 0
    || Number(signals.evidenceTotal ?? 0) > 0
    || attention.length > 0
    || recommendations.length > 0
    || departments.length > 0
    || capabilities.length > 0
    || outcomes.length > 0
    || learnings.length > 0
    || Number(decisions.pendingDecisions ?? 0) > 0
    || Number(decisions.approvedDecisions ?? 0) > 0;

  return (
    <div className="intel-page intel-enterprise">
      <header className="intel-header">
        <div>
          <span className="intel-eyebrow"><Brain size={14} /> Intelligence Loop</span>
          <h1>Intelligence Workspace</h1>
          <p>
            What {data.organization?.name || 'this organization'} currently knows about itself: what is happening,
            what supports it, what is recommended, and what is waiting on a decision.
          </p>
        </div>
        <div className="intel-header__actions">
          <button type="button" className="eb-pill-btn" onClick={() => load({ background: true })} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/*
        Rendered ABOVE the loop summary and outside the `hasAnything` branch.

        A school whose intelligence comes from imported datasets can have a great
        deal to say while the signal/case/decision loop is still empty — and the
        blank slate below would then declare that the organization knows nothing
        about itself, directly above four hundred thousand rows of its own exam
        results. This component returns null for an organization with no school
        datasets, so nothing changes for the ERP-backed tenants.
      */}
      <SchoolIntelligence tenantId={tenantId} />

      {!hasAnything ? (
        <section className="intel-section">
          <div className="intel-blank-slate">
            <Brain size={30} />
            <h2>No organizational intelligence has been generated yet</h2>
            <p>
              Intelligence is derived from this organization&apos;s own records. Nothing has been imported, no
              detection rule has matched, and no case, recommendation or decision exists — so there is nothing
              here to summarise. Import a file and the loop starts producing signals, evidence and, from those,
              the recommendations and decisions this screen reports on.
            </p>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('ingestion')}>
                <Upload size={15} /> Open the Ingestion Engine
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          {attention.length > 0 && (
            <Section
              icon={<AlertTriangle size={14} />}
              eyebrow="Unresolved"
              title="What needs attention"
            >
              <div className="intel-summary-list">
                {attention.slice(0, 6).map((item: any) => (
                  <article key={item.id} className="intel-summary-item">
                    <div className="intel-inline-list">
                      <strong>{item.title}</strong>
                      <span className="intel-pill" data-tone={badgeTone(item.priority || item.tone || 'high')}>
                        {item.priority || item.impact || item.tone}
                      </span>
                    </div>
                    <p>{item.description || item.evidence || item.narrative}</p>
                    {(item.ifNoAction || item.why) && <small>{item.ifNoAction || item.why}</small>}
                  </article>
                ))}
              </div>
            </Section>
          )}

          <section className="intel-section intel-enterprise-panels">
            <Panel
              icon={<FileSearch size={14} />}
              eyebrow="Observed"
              title="Signals and the evidence behind them"
              action={onNavigate ? { label: 'Open Signals', onClick: () => onNavigate('signals') } : undefined}
            >
              <div className="intel-stat-grid">
                <Stat label="Signals raised" value={formatNumber(signals.signalsTotal)} />
                <Stat label="Evidence records" value={formatNumber(signals.evidenceTotal)} />
                <Stat
                  label="Average evidence confidence"
                  value={signals.averageEvidenceConfidence != null ? formatPercent(signals.averageEvidenceConfidence) : 'Not scored'}
                />
                <Stat
                  label="Evidence out of date"
                  value={formatNumber(signals.staleEvidence)}
                  tone={Number(signals.staleEvidence ?? 0) > 0 ? 'warn' : undefined}
                />
              </div>
            </Panel>

            <Panel
              icon={<ScrollText size={14} />}
              eyebrow="Waiting"
              title="Decisions"
              action={onNavigate ? { label: 'Open Deliberation', onClick: () => onNavigate('deliberation') } : undefined}
            >
              <div className="intel-stat-grid">
                <Stat label="Awaiting a decision" value={formatNumber(decisions.pendingDecisions)} tone={Number(decisions.pendingDecisions ?? 0) > 0 ? 'warn' : undefined} />
                <Stat label="Approved" value={formatNumber(decisions.approvedDecisions)} />
                <Stat label="Recommendations pending" value={formatNumber(decisions.pendingRecommendations)} />
                <Stat
                  label="Average time waiting"
                  value={decisions.averageDecisionAgeDays != null ? `${decisions.averageDecisionAgeDays} days` : 'Nothing waiting'}
                />
              </div>
            </Panel>
          </section>

          {loopStages.length > 0 && (
            <Section
              icon={<Target size={14} />}
              eyebrow="Continuity"
              title="How far each stage carries through to the next"
            >
              <div className="intel-loop-grid">
                {loopStages.map((stage: any) => (
                  <article key={stage.key} className="intel-loop-stage">
                    <span className="intel-kpi-label">{stage.label}</span>
                    <strong>{formatNumber(stage.count)}</strong>
                    <small>{stage.conversionRate != null ? `${formatPercent(stage.conversionRate)} of the stage before` : 'Start of the loop'}</small>
                  </article>
                ))}
              </div>
              {data.loopContinuity?.weakestStage && (
                <p className="intel-section-note">
                  <strong>{data.loopContinuity.weakestStage.label}</strong> is where most is lost — only
                  {' '}{formatPercent(data.loopContinuity.weakestStage.conversionRate)} of the previous stage reaches it.
                </p>
              )}
            </Section>
          )}

          {recommendations.length > 0 && (
            <Section
              icon={<Lightbulb size={14} />}
              eyebrow="Suggested"
              title="What the Brain recommends doing next"
              action={onNavigate ? { label: 'Review in Deliberation', onClick: () => onNavigate('deliberation') } : undefined}
            >
              <div className="intel-recommendation-stack">
                {recommendations.slice(0, 4).map((item: any) => (
                  <article key={item.id} className="intel-recommendation-card">
                    <div className="intel-inline-list">
                      <span className="intel-mini-badge" data-tone={badgeTone(item.priority)}>{item.priority}</span>
                      <span className="intel-mini-badge" data-tone={item.sourceType === 'record' ? 'info' : 'warn'}>
                        {item.sourceType === 'record' ? 'Recorded recommendation' : 'Derived from current records'}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.why}</p>
                    <div className="intel-callout">
                      <strong>Suggested action:</strong> {item.recommendedAction}
                    </div>
                    <small>
                      {item.confidence != null ? `Confidence ${formatPercent(item.confidence)}. ` : ''}
                      {item.riskIfIgnored ? `If ignored: ${item.riskIfIgnored}` : ''}
                    </small>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {departments.length > 0 && (
            <Section
              icon={<Building2 size={14} />}
              eyebrow="Structure"
              title="Departments that need attention"
              action={onNavigate ? { label: 'Open Departments', onClick: () => onNavigate('departments') } : undefined}
            >
              <div className="intel-table-wrap">
                <table className="intel-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>People</th>
                      <th>Has a leader</th>
                      <th>Capabilities assigned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((row: any) => (
                      <tr key={row.departmentId}>
                        <td>{row.departmentName}</td>
                        <td>{formatNumber(row.peopleCount)}</td>
                        <td>{row.hasLeader ? 'Yes' : <span className="intel-muted">No</span>}</td>
                        <td>{formatNumber(row.capabilityAssignments)}</td>
                        <td>
                          <span className="intel-pill" data-tone={badgeTone(row.attentionLabel === 'Needs attention' ? 'high' : row.attentionLabel === 'Watch' ? 'pending' : 'active')}>
                            {row.attentionLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {(capabilities.length > 0 || data.workforceDepartment?.peopleWithoutDepartment != null) && (
            <Section
              icon={<Users size={14} />}
              eyebrow="Coverage"
              title="Capability gaps"
              action={onNavigate ? { label: 'Open Capabilities', onClick: () => onNavigate('capabilities') } : undefined}
            >
              <div className="intel-stat-grid">
                <Stat
                  label="People without a department"
                  value={formatNumber(data.workforceDepartment?.peopleWithoutDepartment)}
                  tone={Number(data.workforceDepartment?.peopleWithoutDepartment ?? 0) > 0 ? 'warn' : undefined}
                />
                <Stat
                  label="Departments without a leader"
                  value={formatNumber(data.workforceDepartment?.departmentsWithoutLeaders)}
                  tone={Number(data.workforceDepartment?.departmentsWithoutLeaders ?? 0) > 0 ? 'warn' : undefined}
                />
                <Stat
                  label="Capabilities with someone assigned"
                  value={data.capabilityWorkforce?.capabilityCoverage != null ? formatPercent(data.capabilityWorkforce.capabilityCoverage) : 'Not assessed'}
                />
              </div>

              {capabilities.length > 0 && (
                <div className="intel-summary-list" style={{ marginTop: 16 }}>
                  {capabilities.map((row: any) => (
                    <article key={row.capabilityId} className="intel-summary-item">
                      <div className="intel-inline-list">
                        <strong>{row.capabilityName}</strong>
                        <span className="intel-pill" data-tone={badgeTone(row.attentionLabel === 'Critical gap' ? 'critical' : row.attentionLabel === 'Unassigned' ? 'high' : 'active')}>
                          {row.attentionLabel}
                        </span>
                      </div>
                      <p>
                        Criticality {row.criticality}. {formatNumber(row.assignmentCount)} person
                        {Number(row.assignmentCount) === 1 ? '' : 's'} currently assigned.
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </Section>
          )}

          {(strengths.length > 0 || weaknesses.length > 0) && (
            <section className="intel-section intel-enterprise-panels">
              <Panel icon={<Target size={14} />} eyebrow="Assessment" title="Where this organization is strong">
                {strengths.length > 0
                  ? <ul className="intel-list">{strengths.map((item: string) => <li key={item}>{item}</li>)}</ul>
                  : <EmptyState icon="○" message="Nothing measured clears the threshold for a strength yet." />}
              </Panel>
              <Panel icon={<ShieldAlert size={14} />} eyebrow="Assessment" title="Where it is weak">
                {weaknesses.length > 0
                  ? <ul className="intel-list">{weaknesses.map((item: string) => <li key={item}>{item}</li>)}</ul>
                  : <EmptyState icon="○" message="Nothing measured falls below the threshold for a weakness." />}
              </Panel>
            </section>
          )}

          {(outcomes.length > 0 || learnings.length > 0) && (
            <section className="intel-section intel-enterprise-panels">
              {outcomes.length > 0 && (
                <Panel
                  icon={<Target size={14} />}
                  eyebrow="Proved"
                  title="What actually happened"
                  action={onNavigate ? { label: 'Open Execution Center', onClick: () => onNavigate('executions') } : undefined}
                >
                  <div className="intel-summary-list">
                    {outcomes.map((item: any) => (
                      <article key={item.id} className="intel-summary-item">
                        <div className="intel-inline-list">
                          <strong>{item.title}</strong>
                          <span className="intel-pill" data-tone={badgeTone(item.result)}>{item.result}</span>
                        </div>
                        <p>{item.confidence != null ? `Recorded with ${formatPercent(item.confidence)} confidence` : 'No confidence was recorded'}</p>
                        <small>{formatDateTime(item.createdDate)}</small>
                      </article>
                    ))}
                  </div>
                </Panel>
              )}

              {learnings.length > 0 && (
                <Panel
                  icon={<GraduationCap size={14} />}
                  eyebrow="Learned"
                  title="What is worth reusing"
                  action={onNavigate ? { label: 'Open Organizational Knowledge', onClick: () => onNavigate('mentalmodels') } : undefined}
                >
                  <div className="intel-summary-list">
                    {learnings.slice(0, 4).map((item: any) => (
                      <article key={item.id} className="intel-summary-item">
                        <div className="intel-inline-list">
                          <strong>{item.pattern}</strong>
                          <span className="intel-mini-badge" data-tone="good">
                            {item.confidence != null ? formatPercent(item.confidence) : 'not scored'}
                          </span>
                        </div>
                        <p>{item.description || 'No description was recorded for this learning.'}</p>
                      </article>
                    ))}
                  </div>
                </Panel>
              )}
            </section>
          )}

          {/* Value only appears when a recommendation or outcome actually carries
              a number. Two empty currency-shaped totals are a claim about the
              organization, not a blank. */}
          {(pricedItems.length > 0 || recoveredItems.length > 0 || unpricedItems.length > 0) && (
            <Section icon={<Target size={14} />} eyebrow="Value" title="Where value is at stake, and where it has been recovered">
              <div className="intel-value-ledgers">
                <Ledger
                  title="At stake"
                  items={pricedItems}
                  empty="No pending recommendation carries a numeric value."
                />
                <Ledger
                  title="Recovered"
                  items={recoveredItems}
                  empty="No recorded outcome carries a measured value."
                />
                <div className="intel-ledger-panel">
                  <h3 className="intel-subsection-title">Real, but not priced</h3>
                  <div className="intel-summary-list">
                    {unpricedItems.length > 0 ? unpricedItems.map((item: any) => (
                      <article key={item.id} className="intel-summary-item">
                        <strong>{item.title}</strong>
                        <p>{item.why}</p>
                      </article>
                    )) : <EmptyState icon="○" message="Nothing identified that matters but cannot be priced." />}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {data.dataTrust && (
            <Section icon={<ShieldAlert size={14} />} eyebrow="Reliability" title="How much of this can be trusted">
              <div className="intel-stat-grid">
                <Stat label="Records with required fields" value={data.dataTrust.completeness != null ? formatPercent(data.dataTrust.completeness) : 'Not assessed'} />
                <Stat label="People missing a department" value={formatNumber(data.dataTrust.missingEmployeeDepartment)} />
                <Stat label="Departments missing a leader" value={formatNumber(data.dataTrust.missingDepartmentLeadership)} />
                <Stat label="Capabilities nobody is assigned to" value={formatNumber(data.dataTrust.missingCapabilityMapping)} />
                <Stat label="Evidence out of date" value={formatNumber(data.dataTrust.staleEvidence)} />
                <Stat label="Imports that failed" value={formatNumber(data.dataTrust.failedImports)} tone={Number(data.dataTrust.failedImports ?? 0) > 0 ? 'warn' : undefined} />
                <Stat label="Rows rejected on import" value={formatNumber(data.dataTrust.rejectedRows)} />
                <Stat label="Last refreshed" value={formatDateTime(data.dataTrust.lastRefresh) || 'Unknown'} />
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function Section({
  icon, eyebrow, title, action, children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section className="intel-section">
      <div className="intel-panel">
        <div className="intel-section-head">
          <div>
            <span className="intel-eyebrow">{icon} {eyebrow}</span>
            <h2>{title}</h2>
          </div>
          {action && <button type="button" className="eb-link-btn" onClick={action.onClick}>{action.label}</button>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Panel({
  icon, eyebrow, title, action, children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <div className="intel-panel">
      <div className="intel-section-head">
        <div>
          <span className="intel-eyebrow">{icon} {eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action && <button type="button" className="eb-link-btn" onClick={action.onClick}>{action.label}</button>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <article className="intel-kpi" data-tone={tone === 'warn' ? 'pending' : 'active'}>
      <span className="intel-kpi-label">{label}</span>
      <div className="intel-kpi-value">{value}</div>
    </article>
  );
}

function Ledger({ title, items, empty }: { title: string; items: any[]; empty: string }) {
  return (
    <div className="intel-ledger-panel">
      <h3 className="intel-subsection-title">{title}</h3>
      <div className="intel-summary-list">
        {items.length > 0 ? items.map((item: any) => (
          <article key={item.id} className="intel-summary-item">
            <div className="intel-inline-list">
              <strong>{item.title}</strong>
              <span className="intel-pill" data-tone={badgeTone(item.source === 'outcome' ? 'completed' : 'high')}>
                {formatNumber(item.value)}
              </span>
            </div>
            <p>{item.why}</p>
            {item.confidence != null && <small>Confidence {formatPercent(item.confidence)}.</small>}
          </article>
        )) : <EmptyState icon="○" message={empty} />}
      </div>
    </div>
  );
}
