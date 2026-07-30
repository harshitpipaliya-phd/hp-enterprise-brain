/**
 * Situation Card — the current case or observation being reasoned over.
 *
 * Product rule: a situation is not a title. It carries the signal that
 * triggered it, the case status, and the tenant that owns it. Without the
 * signal link the card is just a label.
 */
interface Situation {
  id: string;
  title: string;
  status: string;
  signalId: string;
  tenantId: string;
  createdDate: string;
}

export default function SituationCard({ situation }: { situation: Situation }) {
  return (
    <div className="rcl-situation" style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: 'var(--content-primary)' }}>{situation.title}</strong>
        <span className="rcl-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: 'var(--lifecycle-active-surface)', color: 'var(--lifecycle-active)', border: '1px solid var(--border-subtle)' }}>{situation.status}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--content-tertiary)' }}>
        Signal <code style={{ backgroundColor: 'var(--surface-inset)', padding: '1px 6px', borderRadius: 3 }}>{situation.signalId.slice(0, 8)}</code>
        <span style={{ margin: '0 8px' }}>·</span>
        {situation.createdDate?.slice(0, 10)}
      </div>
    </div>
  );
}
