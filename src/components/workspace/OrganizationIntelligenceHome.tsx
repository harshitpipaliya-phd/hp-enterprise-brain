import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '../../ui';
import { api } from '../../api/intelligence';
import type { Organization } from '../../App';
import type { View } from '../../App';

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  link?: string;
  metric?: number;
  confidence?: number;
}

interface HomeMetrics {
  tenantId: string;
  erp: {
    activePeople: number;
    activeDepartments: number;
    peopleWithoutDepartment: number;
    departmentsWithoutManager: number;
    peopleWithoutProfile: number;
  };
  intelligence: {
    openSignals: number;
    highSignals: number;
    pendingRecommendations: number;
    openDecisions: number;
  };
  pipeline?: {
    stage: string;
    blocker: string | null;
    nextAction: string;
    counts: {
      operationalRecords: number;
      signals: number;
      firedRuleKeys: number;
      cases: number;
      hypotheses: number;
      recommendations: number;
      decisions: number;
      executions: number;
      outcomes: number;
      learnings: number;
    };
    review: {
      firedRuleKeys: number;
      approvedRuleKeys: number;
      unclassifiedRuleKeys: number;
      unclassified: string[];
    };
  };
  domainIntelligence?: {
    fees?: {
      dataset: string;
      availability: Record<string, boolean>;
      overview: {
        records: number;
        students: number;
        departments: number;
        classes: number;
        sections: number;
        totalBilled: number;
        totalConcession: number;
        totalNet: number;
        totalCollected: number;
        totalOutstanding: number;
        collectionRate: number | null;
        defaulters: number;
        criticalRiskStudents: number;
        averagePaymentDelayDays: number | null;
      };
      analytics: {
        byDepartment: Array<{ name: string; records: number; net: number; collected: number; outstanding: number; collectionRate: number | null }>;
        byClass: Array<{ name: string; records: number; net: number; collected: number; outstanding: number; collectionRate: number | null }>;
        byFeeType: Array<{ name: string; records: number; net: number; collected: number; outstanding: number; collectionRate: number | null }>;
        byPaymentMethod: Array<{ name: string; records: number; net: number; collected: number; outstanding: number; collectionRate: number | null }>;
        byScholarship: Array<{ name: string; records: number; net: number; collected: number; outstanding: number; collectionRate: number | null }>;
        riskLevelRows: Array<{ name: string; count: number; share: number | null }>;
        riskLevelStudents: Array<{ name: string; count: number; share: number | null }>;
      };
      priorityRecovery: Array<{
        studentRef: string;
        className: string;
        section: string;
        outstanding: number;
        collectionRate: number | null;
        riskScore: number;
        riskBand: string;
        sourceRiskLevel: string | null;
        riskFactors: string[];
        recommendedAction: string;
      }>;
      defaulters: Array<{
        studentRef: string;
        className: string;
        section: string;
        outstanding: number;
        collectionRate: number | null;
        overdueRecords: number;
        partialRecords: number;
        averageAttendancePct: number | null;
        averageExamPct: number | null;
        daysOverdue: number | null;
        riskScore: number;
        riskBand: string;
        sourceRiskLevel: string | null;
        riskFactors: string[];
        recommendedAction: string;
      }>;
      dataQuality: Record<string, number>;
      trace: { table: string; dataset: string; recordCount: number };
    } | null;
  };
  attention: AttentionItem[];
  dataFreshness: {
    erp: string;
    brain: string;
  };
}

interface Props {
  organization: Organization;
  onNavigate: (view: View, org?: Organization) => void;
}

export default function OrganizationIntelligenceHome({ organization, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<HomeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getHomeMetrics(organization.tenantId);

        if (cancelled) return;

        setMetrics(data as HomeMetrics);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.message || 'Failed to load organization intelligence.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [organization.tenantId]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const totalAttention = metrics?.attention.filter((a) => a.severity === 'high').length ?? 0;

  if (loading) {
    return (
      <div className="eb-loading">
        <div className="eb-loading-spinner" />
        <p>Loading organization intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="eb-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="eb-empty">
        <p>No intelligence data available yet. Start by adding people, departments, and capabilities.</p>
      </div>
    );
  }

  const { erp, intelligence, pipeline, domainIntelligence, attention, dataFreshness } = metrics;
  const fees = domainIntelligence?.fees;

  return (
    <div className="eb-home">
      <PageHeader
        variant="organization"
        icon={organization.logo ? <img src={organization.logo} alt="" /> : <Building2 />}
        title={organization.name}
        status={totalAttention > 0
          ? { label: `${totalAttention} active alert${totalAttention !== 1 ? 's' : ''}`, tone: 'warning' }
          : null}
        description={today}
        meta={[{ label: `ERP data: live · Brain data: ${dataFreshness.brain}` }]}
      />

      <div className="eb-home-hero">
        <h2>{greeting}.</h2>
        <p>
          {erp.activePeople > 0
            ? `Your workforce has ${erp.activePeople} active employee${erp.activePeople !== 1 ? 's' : ''} across ${erp.activeDepartments} department${erp.activeDepartments !== 1 ? 's' : ''}.`
            : 'No employee records found.'}
          {intelligence.highSignals > 0
            ? ` There ${intelligence.highSignals === 1 ? 'is' : 'are'} ${intelligence.highSignals} high-severity signal${intelligence.highSignals !== 1 ? 's' : ''} requiring immediate attention.`
            : ' All signals are currently resolved.'}
        </p>
      </div>

      <div className="eb-home-cards">
        <div className="eb-stat-card">
          <div className="eb-stat-value">{erp.activePeople.toLocaleString()}</div>
          <div className="eb-stat-label">Active People</div>
          <div className="eb-stat-detail">from ERP</div>
        </div>
        <div className="eb-stat-card">
          <div className="eb-stat-value">{erp.activeDepartments.toLocaleString()}</div>
          <div className="eb-stat-label">Departments</div>
          <div className="eb-stat-detail">from ERP</div>
        </div>
        <div className="eb-stat-card">
          <div className="eb-stat-value" style={{ color: erp.peopleWithoutDepartment > 0 ? 'var(--feedback-error-content)' : 'inherit' }}>
            {erp.peopleWithoutDepartment.toLocaleString()}
          </div>
          <div className="eb-stat-label">Without Department</div>
          <div className="eb-stat-detail">needs assignment</div>
        </div>
        <div className="eb-stat-card">
          <div className="eb-stat-value" style={{ color: erp.departmentsWithoutManager > 0 ? 'var(--feedback-warning-content)' : 'inherit' }}>
            {erp.departmentsWithoutManager.toLocaleString()}
          </div>
          <div className="eb-stat-label">Without Manager</div>
          <div className="eb-stat-detail">leadership gap</div>
        </div>
        <div className="eb-stat-card">
          <div className="eb-stat-value" style={{ color: intelligence.highSignals > 0 ? 'var(--feedback-error-content)' : 'inherit' }}>
            {intelligence.highSignals.toLocaleString()}
          </div>
          <div className="eb-stat-label">High Signals</div>
          <div className="eb-stat-detail">requires review</div>
        </div>
        <div className="eb-stat-card">
          <div className="eb-stat-value">{intelligence.pendingRecommendations.toLocaleString()}</div>
          <div className="eb-stat-label">Pending Decisions</div>
          <div className="eb-stat-detail">awaiting approval</div>
        </div>
      </div>

      {pipeline && (
        <section className="eb-home-attention">
          <h3>Enterprise Brain Pipeline</h3>
          <div className="eb-home-cards">
            {[
              ['Records', pipeline.counts.operationalRecords, 'tenant-scoped rows'],
              ['Signals', pipeline.counts.signals, `${pipeline.counts.firedRuleKeys} fired rule keys`],
              ['Cases', pipeline.counts.cases, 'opened investigations'],
              ['Rule Keys', pipeline.review.firedRuleKeys, `${pipeline.review.approvedRuleKeys} classified`],
              ['Recommendations', pipeline.counts.recommendations, 'grounded actions'],
              ['Decisions', pipeline.counts.decisions, 'governed choices'],
              ['Executions', pipeline.counts.executions, 'actions tracked'],
              ['Learning', pipeline.counts.learnings, `${pipeline.counts.outcomes} outcomes`],
            ].map(([label, value, detail]) => (
              <div className="eb-stat-card" key={String(label)}>
                <div className="eb-stat-value">{Number(value).toLocaleString()}</div>
                <div className="eb-stat-label">{label}</div>
                <div className="eb-stat-detail">{detail}</div>
              </div>
            ))}
          </div>
          <div className="eb-dashed-empty">
            <strong>Current stage: {pipeline.stage.replace(/_/g, ' ')}</strong>
            <p>{pipeline.blocker || 'The full intelligence loop has produced reusable learning.'}</p>
            <p>{pipeline.nextAction}</p>
            {pipeline.review.unclassified.length > 0 && (
              <p>Unclassified rule keys: {pipeline.review.unclassified.join(', ')}</p>
            )}
          </div>
        </section>
      )}

      {fees && (
        <section className="eb-home-attention">
          <h3>School Fee Intelligence</h3>
          <div className="eb-home-cards">
            {[
              ['Students', fees.overview.students, 'distinct student refs'],
              ['Departments', fees.overview.departments, 'from fee records'],
              ['Total Billed', money(fees.overview.totalBilled), 'amount due'],
              ['Collected', money(fees.overview.totalCollected), `${percent(fees.overview.collectionRate)} collection`],
              ['Outstanding', money(fees.overview.totalOutstanding), 'open balance'],
              ['Defaulters', fees.overview.defaulters, `${fees.overview.criticalRiskStudents} critical`],
            ].map(([label, value, detail]) => (
              <div className="eb-stat-card" key={String(label)}>
                <div className="eb-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
                <div className="eb-stat-label">{label}</div>
                <div className="eb-stat-detail">{detail}</div>
              </div>
            ))}
          </div>

          <div className="eb-home-cards">
            <MiniTable
              title="Department Exposure"
              rows={fees.analytics.byDepartment.slice(0, 5)}
              empty="No department fee breakdown is available."
            />
            <MiniTable
              title="Collection by Class"
              rows={fees.analytics.byClass.slice(0, 5)}
              empty="No class-wise fee data is available."
            />
            <MiniTable
              title="Fee Type Exposure"
              rows={fees.analytics.byFeeType.slice(0, 5)}
              empty="No fee-type breakdown is available."
            />
            <MiniTable
              title="Payment Methods"
              rows={fees.analytics.byPaymentMethod.slice(0, 5)}
              empty="No payment-method data is available."
            />
            <MiniTable
              title="Scholarship Segments"
              rows={fees.analytics.byScholarship.slice(0, 5)}
              empty="No scholarship or fee-plan data is available."
            />
            <DistributionCard
              title="Student Risk Bands"
              rows={fees.analytics.riskLevelStudents}
              note="Distinct students, using the highest source risk level found for each student."
            />
            <DistributionCard
              title="Risk Rows"
              rows={fees.analytics.riskLevelRows}
              note="Fee records, not distinct students."
            />
          </div>

          <div className="eb-dashed-empty">
            <strong>Priority recovery queue</strong>
            {fees.priorityRecovery.length === 0 ? (
              <p>No student has an outstanding or overdue fee balance in the current dataset.</p>
            ) : (
              <div className="eb-fee-risk-list">
                {fees.priorityRecovery.slice(0, 5).map((student) => (
                  <div key={student.studentRef} className="eb-fee-risk-row">
                    <strong>{student.studentRef}</strong>
                    <span>{student.className || 'Class unavailable'} {student.section || ''}</span>
                    <span>{money(student.outstanding)} outstanding</span>
                    <span>{student.riskBand} ({student.riskScore}) · {percent(student.collectionRate)} collected</span>
                    <small>{student.riskFactors.join(' ') || 'No risk factors beyond the open balance.'}</small>
                  </div>
                ))}
              </div>
            )}
            <p>
              Source: {fees.trace.table} / {fees.trace.dataset}, {fees.trace.recordCount.toLocaleString()} records.
              {!fees.availability.dueDate && ' Due dates are not present, so days overdue is not calculated.'}
              {!fees.availability.reminderHistory && ' Reminder history is not present, so reminder recommendations are not generated.'}
            </p>
          </div>
        </section>
      )}

      <div className="eb-home-attention">
        <h3>Needs Your Attention</h3>
        {attention.length === 0 ? (
          <div className="eb-dashed-empty">No attention items at this time.</div>
        ) : (
          <ul className="eb-attention-list">
            {attention.map((item) => (
              <li key={item.id} className={`eb-attention-item eb-attention-${item.severity}`}>
                <div className="eb-attention-content">
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                  {item.confidence !== undefined && (
                    <span className="eb-attention-meta">Confidence: {Math.round(item.confidence * 100)}%</span>
                  )}
                </div>
                {item.link && (
                  <button
                    className="eb-attention-link"
                    onClick={() => onNavigate(item.link as View, organization)}
                  >
                    View
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Data unavailable';
  return `INR ${Math.round(value).toLocaleString()}`;
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Data unavailable';
  return `${Math.round(value * 100)}%`;
}

function MiniTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ name: string; records: number; collected: number; outstanding: number; collectionRate: number | null }>;
  empty: string;
}) {
  return (
    <div className="eb-stat-card eb-fee-mini-table">
      <div className="eb-stat-label">{title}</div>
      {rows.length === 0 ? (
        <div className="eb-stat-detail">{empty}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Collected</th>
              <th>Outstanding</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{money(row.collected)}</td>
                <td>{money(row.outstanding)}</td>
                <td>{percent(row.collectionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DistributionCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Array<{ name: string; count: number; share: number | null }>;
  note: string;
}) {
  return (
    <div className="eb-stat-card eb-fee-mini-table">
      <div className="eb-stat-label">{title}</div>
      {rows.length === 0 ? (
        <div className="eb-stat-detail">Data unavailable</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Band</th>
              <th>Count</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count.toLocaleString()}</td>
                <td>{percent(row.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="eb-stat-detail">{note}</div>
    </div>
  );
}
