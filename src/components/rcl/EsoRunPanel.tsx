/**
 * ESO Run Panel — the execution record for an ESO.
 *
 * Product rule: an execution without a plan is not a run, it is a guess.
 * The panel surfaces the bound measurement plan id and the executor type so
 * the governance trail is answerable from the row itself.
 */
interface EsoRun {
  id: string;
  status: string;
  startedDate: string;
  completedDate: string | null;
  executedBy: string;
  executorType: string;
  measurementPlanId: string | null;
}

const STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
  queued:     { bg: 'var(--surface-inset)',   fg: 'var(--content-tertiary)' },
  running:    { bg: 'var(--priority-p3-surface)', fg: 'var(--priority-p3)' },
  completed:  { bg: 'var(--feedback-success-surface)', fg: 'var(--feedback-success-solid)' },
  failed:     { bg: 'var(--feedback-error-surface)',   fg: 'var(--feedback-error-solid)' },
  rolled_back:{ bg: 'var(--feedback-warning-surface)', fg: 'var(--feedback-warning-solid)' },
};

export default function EsoRunPanel({ run }: { run: EsoRun }) {
  const token = STATUS_TOKENS[run.status] ?? STATUS_TOKENS.queued;

  return (
    <div className="rcl-eso-run" style={{ border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--surface-card)', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="rcl-badge" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, backgroundColor: token.bg, color: token.fg, border: '1px solid var(--border-subtle)', textTransform: 'capitalize' }}>
          {run.status.replace(/_/g, ' ')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--content-tertiary)' }}>{run.executorType}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--content-secondary)' }}>
        Executed by: {run.executedBy}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--content-tertiary)', flexWrap: 'wrap' }}>
        <span>Started: {run.startedDate?.slice(0, 10)}</span>
        {run.completedDate && <span>Completed: {run.completedDate.slice(0, 10)}</span>}
        {run.measurementPlanId && <span>Plan: {run.measurementPlanId.slice(0, 8)}</span>}
      </div>
    </div>
  );
}
