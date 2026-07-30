import { useState } from 'react';

/**
 * ESO Library (Product Bible §5.7).
 *
 * Answers: what can we actually do?
 *
 * NOTE: hpbrain_eso_definitions and hpbrain_eso_efficacy_records have no
 * API endpoints yet (see docs/DECISIONS-PENDING.md module 3). This screen
 * is structural proof that the RCL primitives can compose a real surface;
 * the data layer will arrive when the contract pipeline delivers the routes.
 */

interface EsoDefinition {
  id: string;
  esoCode: string;
  name: string;
  objective: string;
  status: string;
  allowedExecutorClasses: string[];
  trustLevel: string;
}

interface EfficacyRecord {
  id: string;
  esoId: string;
  outcomeResult: string;
  observedConfidence: number;
  recordedAt: string;
}

const PLACEHOLDER_DEFINITIONS: EsoDefinition[] = [
  { id: 'demo-eso-1', esoCode: 'ESO-FEE-REMIND', name: 'Targeted fee reminder', objective: 'Recover outstanding fees through a structured reminder sequence.', status: 'active', allowedExecutorClasses: ['human', 'system'], trustLevel: 'high' },
  { id: 'demo-eso-2', esoCode: 'ESO-ATTEND-INTERVENE', name: 'Attendance intervention', objective: 'Reduce chronic absence through a graduated contact sequence.', status: 'active', allowedExecutorClasses: ['human'], trustLevel: 'medium' },
];

const PLACEHOLDER_EFFICACY: EfficacyRecord[] = [
  { id: 'eff-1', esoId: 'demo-eso-1', outcomeResult: 'success', observedConfidence: 0.78, recordedAt: '2026-07-20 09:00:00' },
];

export default function EsoLibraryScreen() {
  const [selectedEso, setSelectedEso] = useState<string | null>(null);

  const definitions = PLACEHOLDER_DEFINITIONS;
  const efficacy = PLACEHOLDER_EFFICACY.filter((e) => e.esoId === selectedEso);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24, minHeight: '100vh' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>ESO Library</h1>
        <p style={{ fontSize: 13, color: 'var(--content-tertiary)', marginTop: 4 }}>What can we actually do? Definitions, bindings, and efficacy.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--content-tertiary)', marginBottom: 8 }}>Definitions</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {definitions.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedEso(d.id === selectedEso ? null : d.id)}
                style={{ padding: 12, borderRadius: 8, border: `1px solid ${d.id === selectedEso ? 'var(--action-primary)' : 'var(--border-default)'}`, backgroundColor: 'var(--surface-card)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--content-primary)' }}>{d.name}</strong>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: d.status === 'active' ? 'var(--feedback-success-surface)' : 'var(--surface-inset)', color: d.status === 'active' ? 'var(--feedback-success-solid)' : 'var(--content-tertiary)', border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>{d.status}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--content-tertiary)', marginBottom: 4 }}>{d.esoCode}</div>
                <div style={{ fontSize: 12, color: 'var(--content-secondary)' }}>{d.objective}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 10, color: 'var(--content-tertiary)', flexWrap: 'wrap' }}>
                  <span>Trust: {d.trustLevel}</span>
                  <span>Executors: {d.allowedExecutorClasses.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--content-tertiary)', marginBottom: 8 }}>Efficacy</h2>
          {selectedEso ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {efficacy.length === 0 ? (
                <p style={{ color: 'var(--content-tertiary)', fontSize: 12 }}>No efficacy records for this ESO yet.</p>
              ) : (
                efficacy.map((e) => (
                  <div key={e.id} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-default)', backgroundColor: 'var(--surface-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--content-primary)', textTransform: 'capitalize' }}>{e.outcomeResult}</span>
                      <span style={{ fontSize: 11, color: 'var(--content-tertiary)' }}>{(e.observedConfidence * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--content-tertiary)' }}>{e.recordedAt?.slice(0, 10)}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--content-tertiary)', fontSize: 12 }}>Select an ESO definition to view its efficacy records.</p>
          )}
        </section>
      </div>
    </div>
  );
}
