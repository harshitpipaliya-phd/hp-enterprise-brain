import { useEffect, useState } from 'react';
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

  const { erp, intelligence, attention, dataFreshness } = metrics;

  return (
    <div className="eb-home">
      <div className="eb-home-header">
        <div className="eb-home-brand">
          {organization.logo && (
            <img src={organization.logo} alt="" className="eb-home-logo" />
          )}
          <div>
            <h1>{organization.name}</h1>
            <p className="eb-home-subtitle">{today}</p>
            <p className="eb-home-freshness">
              ERP data: live · Brain data: {dataFreshness.brain}
            </p>
          </div>
        </div>
        <div className="eb-home-user">
          <span className="eb-home-role">Organization Intelligence Home</span>
          {totalAttention > 0 && (
            <span className="eb-home-alerts">{totalAttention} active alert{totalAttention !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

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
