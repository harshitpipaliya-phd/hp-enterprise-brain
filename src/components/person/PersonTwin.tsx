import { useState, useEffect } from 'react';
import { api } from '../../api/person';
import { useTheme } from '../../hooks/useTheme';
import { LoadingState, ErrorState } from '../shared/States';

interface CapabilityScore {
  capabilityId: string;
  capabilityName: string;
  scores: { knowledge: number | null; ability: number | null; skill: number | null; behaviour: number | null; attitude: number | null; overall: number | null };
  gaps: Array<{ dimension: string; currentLevel: number | null; targetLevel: number; gap: number }>;
  assessedDate: string | null;
}
interface Guardian {
  firstName: string;
  lastName: string;
  relationship: string;
  email: string | null;
  phone: string | null;
  isPrimaryContact: boolean;
}
interface ExecutionHistoryItem {
  id: string;
  esoId: string;
  status: string;
  completedDate: string | null;
  createdDate: string;
}
interface Twin {
  person: { firstName: string; lastName: string; jobTitle: string | null; email: string };
  capabilityCount: number;
  capabilityScores: CapabilityScore[];
  decisionParticipation: { total: number; approved: number };
  learningContributions: number;
  recentActivity: Array<{ type: string; createdAt: string; entityType: string }>;
  guardians: Guardian[];
  executionHistory: ExecutionHistoryItem[];
  individualScore: { score: number | null; breakdown: { capabilityScore: number | null; decisionQuality: number | null; executionSuccess: number | null } };
}

/**
 * Person Twin. Consumes the real aggregation endpoint built the prior pass.
 */
export default function PersonTwin({ tenantId, personId, onBack }: { tenantId: string; personId: string; onBack: () => void }) {
  const theme = useTheme();
  const [twin, setTwin] = useState<Twin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getTwin(tenantId, personId)
      .then(setTwin)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId, personId]);

  if (loading) return <LoadingState label="Loading person twin..." />;
  if (error) return <ErrorState message={error} />;
  if (!twin) return null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{twin.person.firstName} {twin.person.lastName}</h1>
          <p style={{ color: theme.textMuted, marginBottom: 24 }}>{twin.person.jobTitle ?? 'No title set'} · {twin.person.email}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: theme.textMuted }}>Individual Intelligence Score</div>
          {twin.individualScore.score != null ? (
            <div style={{ fontSize: 32, fontWeight: 'bold', color: twin.individualScore.score >= 70 ? '#22c55e' : twin.individualScore.score >= 40 ? '#f59e0b' : '#ef4444' }}>
              {twin.individualScore.score}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: theme.textMuted, fontStyle: 'italic' }}>Insufficient data yet</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Stat theme={theme} label="Capabilities" value={String(twin.capabilityCount)} />
        <Stat theme={theme} label="Decisions Made" value={String(twin.decisionParticipation.total)} />
        <Stat theme={theme} label="Decisions Approved" value={String(twin.decisionParticipation.approved)} />
        <Stat theme={theme} label="Learning Contributions" value={String(twin.learningContributions)} />
      </div>

      <h3>Capabilities & KASBA Scores</h3>
      {twin.capabilityScores.length === 0 ? (
        <p style={{ color: theme.textMuted, marginBottom: 24 }}>No capabilities assigned yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
          {twin.capabilityScores.map((c) => (
            <div key={c.capabilityId} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{c.capabilityName}</strong>
                <span style={{ fontSize: 11, color: theme.textMuted }}>
                  {c.scores.overall != null ? `Overall: ${c.scores.overall}/5` : 'Not yet assessed'}
                </span>
              </div>
              {c.scores.overall != null && (
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
                  {(['knowledge', 'ability', 'skill', 'behaviour', 'attitude'] as const).map((dim) => (
                    <span key={dim}>{dim[0].toUpperCase()}: {c.scores[dim] ?? '—'}</span>
                  ))}
                </div>
              )}
              {c.gaps.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11 }}>
                  {c.gaps.map((g, i) => (
                    <div key={i} style={{ color: '#f59e0b' }}>{g.dimension}: gap of {g.gap} (current {g.currentLevel ?? 'unassessed'}, target {g.targetLevel})</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {twin.guardians.length > 0 && (
        <>
          <h3>Guardians / Parents</h3>
          <div style={{ display: 'grid', gap: 6, marginBottom: 24 }}>
            {twin.guardians.map((g, i) => (
              <div key={i} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>{g.firstName} {g.lastName} <span style={{ color: theme.textMuted }}>({g.relationship}{g.isPrimaryContact ? ', primary' : ''})</span></span>
                <span style={{ color: theme.textMuted }}>{g.email ?? g.phone ?? '—'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {twin.executionHistory.length > 0 && (
        <>
          <h3>Execution History</h3>
          <div style={{ display: 'grid', gap: 6, marginBottom: 24 }}>
            {twin.executionHistory.map((e) => (
              <div key={e.id} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>{e.esoId}</span>
                <span style={{ color: theme.textMuted }}>{e.status} · {new Date(e.createdDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Recent Activity</h3>
      {twin.recentActivity.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No recorded activity yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {twin.recentActivity.map((a, i) => (
            <div key={i} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span>{a.type}</span>
              <span style={{ color: theme.textMuted }}>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
