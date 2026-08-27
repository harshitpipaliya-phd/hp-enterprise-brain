import { useState, useEffect } from 'react';
import { api } from '../../api/intelligence.js';
import { reasoningEngineApi } from '../../api/reasoning-engine.js';
import { useToast } from '../Toast';

interface Learning {
  id: string;
  outcome_id: string;
  mental_model_id: string;
  pattern: string;
  description: string;
  domain: string;
  confidence: number;
  reusable: boolean;
  created_by: string;
  created_date: string;
}

interface GroundingEvent {
  id: string;
  entity_id: string;
  correlation_id: string;
  payload: string;
  created_at: string;
}

interface CompoundingStats {
  learningsWritten: number;
  learningsReusable: number;
  reuseRate: number | null;
}

/**
 * Memory screen (Product Bible §5.5).
 *
 * Answers one question: what did we learn?
 *
 * Every learning links back to its originating outcome and forward to what
 * it influenced. Nothing dead-ends.
 */
export default function MemoryScreen({ tenantId }: { tenantId: string }) {
  const { showToast } = useToast();
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [stats, setStats] = useState<CompoundingStats | null>(null);
  const [groundingEvents, setGroundingEvents] = useState<GroundingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLearningId, setSelectedLearningId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [learningsData, statsData, eventsData] = await Promise.all([
        api.listLearnings(tenantId),
        reasoningEngineApi.memoryStats(tenantId),
        fetch(`/api/v1/events?type=LearningGrounded&limit=500`).then((r) => r.json()),
      ]);
      setLearnings(learningsData);
      setStats(statsData);
      setGroundingEvents(Array.isArray(eventsData) ? eventsData : []);
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const groundedEntitiesFor = (learningId: string): GroundingEvent[] => {
    return groundingEvents.filter((e) => e.entity_id === learningId);
  };

  const renderReuseRate = (rate: number | null) => {
    if (rate === null) {
      return <span style={{ color: 'var(--content-tertiary)' }}>not yet measurable</span>;
    }
    const pct = `${(rate * 100).toFixed(0)}%`;
    return <span>{pct}</span>;
  };

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: 'var(--surface-ground)', color: 'var(--content-primary)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span className="eb-page-kicker">Knowledge</span><h1>Organizational Memory</h1>
      </header>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)' }}>
            <div style={{ fontSize: 11, color: 'var(--content-tertiary)', textTransform: 'uppercase' }}>Learnings Written</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--content-primary)' }}>{stats.learningsWritten}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)' }}>
            <div style={{ fontSize: 11, color: 'var(--content-tertiary)', textTransform: 'uppercase' }}>Reusable</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--content-primary)' }}>{stats.learningsReusable}</div>
          </div>
          <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)' }}>
            <div style={{ fontSize: 11, color: 'var(--content-tertiary)', textTransform: 'uppercase' }}>Reuse Rate</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--content-primary)' }}>{renderReuseRate(stats.reuseRate)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : learnings.length === 0 ? (
        <p style={{ color: 'var(--content-tertiary)' }}>No learnings yet. The loop must run, record an outcome, and the outbox consumer must write a learning before memory has anything to show.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {learnings.map((l) => {
            const grounded = groundedEntitiesFor(l.id);
            const isSelected = selectedLearningId === l.id;
            return (
              <div
                key={l.id}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? 'var(--action-primary)' : 'var(--border-default)'}`,
                  backgroundColor: 'var(--surface-card)',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedLearningId(isSelected ? null : l.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--content-primary)' }}>{l.pattern}</strong>
                      {l.reusable ? (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--feedback-success-surface)', color: 'var(--feedback-success-solid)' }}>Reusable</span>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--surface-inset)', color: 'var(--content-tertiary)' }}>Not reusable</span>
                      )}
                    </div>
                    {l.description && (
                      <p style={{ fontSize: 13, color: 'var(--content-tertiary)', margin: '4px 0' }}>{l.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--content-tertiary)', marginTop: 6 }}>
                      {l.domain && <span>Domain: {l.domain}</span>}
                      <span>Confidence: {(l.confidence * 100).toFixed(0)}%</span>
                      <span>Outcome: {l.outcome_id?.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--content-tertiary)', textAlign: 'right' }}>
                    {l.created_date?.slice(0, 10)}
                  </div>
                </div>

                {isSelected && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Grounded on ({grounded.length})</div>
                    {grounded.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--content-tertiary)' }}>Not yet grounded on any later entity.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {grounded.map((g) => {
                          const payload = JSON.parse(g.payload || '{}');
                          return (
                            <div key={g.id} style={{ fontSize: 12, padding: 8, borderRadius: 6, backgroundColor: 'var(--surface-ground)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{payload.groundedEntityType || 'Unknown'}: {g.correlation_id?.slice(0, 8)}...</span>
                                <span style={{ color: 'var(--content-tertiary)' }}>{g.created_at?.slice(0, 10)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
