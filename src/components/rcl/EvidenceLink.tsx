import { useState } from 'react';

/**
 * Evidence Link / Drawer — a pointer to the evidence that grounds a claim.
 *
 * Product rule: evidence without provenance is not evidence. The link exposes
 * source, confidence, and the observation timestamp so a reader can judge the
 * chain without opening the drawer.
 */
interface EvidenceLink {
  id: string;
  source: string;
  confidence: number;
  provenanceTs: string;
  content: string;
}

export default function EvidenceLink({ evidence }: { evidence: EvidenceLink }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rcl-evidence" style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, backgroundColor: 'var(--surface-card)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((s) => !s)}
        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', color: 'var(--content-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 13 }}>{evidence.source}</span>
        <span style={{ fontSize: 10, color: 'var(--content-tertiary)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', fontSize: 12, color: 'var(--content-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ marginBottom: 4 }}>{evidence.content}</div>
          <div style={{ color: 'var(--content-tertiary)', fontSize: 11 }}>
            Confidence: {(evidence.confidence * 100).toFixed(0)}% · Observed {evidence.provenanceTs?.slice(0, 10)}
          </div>
        </div>
      )}
    </div>
  );
}
