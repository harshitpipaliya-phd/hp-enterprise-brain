/**
 * Recommendation Engine — the queue, the explanation, and the decision.
 *
 * Ported from G2G's app/ai/recommendations/page.tsx. Same sections, copy and
 * flow, on HP Brain's primitives and the console's aii- layout.
 *
 * WHY THE DECISION BUTTONS ARE NOT ON THE LIST
 *
 * They are on the detail panel, under the reasoning step and the evidence. That is
 * deliberate and it is the whole ethic of this capability: approving a recommendation
 * from a list means approving a headline, and the headline is the one part of a
 * recommendation that carries no justification. Making the buttons reachable only
 * after the explanation has rendered costs one click and is the difference between a
 * decision and a reflex.
 *
 * The API agrees rather than trusting this: it refuses a decision on anything that is
 * not still pending, with a 409. When that happens the screen re-reads the chain, so
 * the panel shows the decision somebody else already made instead of stale buttons.
 */

import React from 'react';
import { ChevronRight, Clock, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';

import { AiApiError, describeAiError } from '../../../api/aiIntelligence/client';
import {
  decideRecommendation,
  fetchRecommendationChain,
  fetchRecommendations,
  type Recommendation,
  type RecommendationChain,
  type RecommendationCounts,
  type RecommendationDecision,
} from '../../../api/aiIntelligence/recommendations';
import { Alert, Button, Field, StatusBadge, TextInput } from '../../../ui';
import { CapabilityShell } from '../CapabilityShell';
import { LoadingLine, Notice } from '../console-ui';
import './aiScreens.css';

const FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'deferred', label: 'Deferred' },
];

const PAST_TENSE: Record<RecommendationDecision, string> = {
  approve: 'approved',
  reject: 'rejected',
  defer: 'deferred',
};

export default function RecommendationsScreen() {
  return (
    <CapabilityShell slug="recommendations">
      <RecommendationConsole />
    </CapabilityShell>
  );
}

function RecommendationConsole() {
  const [rows, setRows] = React.useState<Recommendation[]>([]);
  const [counts, setCounts] = React.useState<RecommendationCounts | null>(null);
  const [filter, setFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [chain, setChain] = React.useState<RecommendationChain | null>(null);
  const [chainError, setChainError] = React.useState('');
  const [deciding, setDeciding] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [noteError, setNoteError] = React.useState<string | undefined>(undefined);

  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    // `status=pending` is not a value the table holds — the repository maps it onto
    // both 'open' and 'pending' — so the server resolves that filter itself and the
    // screen passes it through like any other.
    fetchRecommendations(filter === '' ? null : filter)
      .then((data) => {
        if (cancelled) return;
        setRows(data.recommendations);
        setCounts(data.counts);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, reloadToken]);

  /*
   * The loaded chain is not cleared when the selection changes — it is matched
   * against the current selection at render time instead.
   *
   * Clearing it in the effect body is a synchronous setState inside an effect, which
   * React flags as a cascading render. Matching on the id also fixes the bug that
   * clearing was papering over: a slow response for recommendation A could land after
   * the user had opened B, and the old code would have shown A's evidence under B's
   * title.
   */
  React.useEffect(() => {
    if (openId === null) return;

    let cancelled = false;

    fetchRecommendationChain(openId)
      .then((data) => {
        if (!cancelled) {
          setChainError('');
          setChain(data);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setChainError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [openId, reloadToken]);

  /** The chain only counts as loaded when it is the one that was asked for. */
  const shownChain = chain?.recommendation?.id === openId ? chain : null;

  const reload = React.useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const decide = async (decision: RecommendationDecision) => {
    if (openId === null) return;

    setDeciding(true);
    setError('');
    setNotice('');
    setNoteError(undefined);

    try {
      const result = await decideRecommendation(openId, decision, note.trim() || undefined);
      setCounts(result.counts);
      setNotice(`Recommendation ${PAST_TENSE[decision]}.`);
      setNote('');
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
      if (cause instanceof AiApiError) {
        setNoteError(cause.fieldErrors.note?.[0]);
        // 409: somebody decided it first. Re-read so the panel shows what they decided.
        if (cause.status === 409) reload();
      }
    } finally {
      setDeciding(false);
    }
  };

  if (loading && rows.length === 0 && error === '') {
    return (
      <div className="aii-card">
        <LoadingLine>Loading recommendations…</LoadingLine>
      </div>
    );
  }

  return (
    <section className="aiw-section" aria-labelledby="aiw-recommendations-heading">
      <header className="aiw-section-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="aiw-h2" id="aiw-recommendations-heading">Recommendations</h2>
          <p className="aiw-desc">
            Ranked by confidence, not by date — this is a work queue. Open one to read the reasoning
            and the evidence before deciding.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={reload}
          icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
        >
          Refresh
        </Button>
      </header>

      {counts && (
        <div className="aii-filters" role="group" aria-label="Filter by status">
          {FILTERS.map((option) => {
            const value =
              option.value === ''
                ? counts.total
                : (counts[option.value as keyof RecommendationCounts] as number);

            return (
              <button
                key={option.value || 'all'}
                type="button"
                className="aii-filter"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                <span className="aii-filter-count">{value}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Both are live regions (status / alert), so a decision's outcome is heard
          as well as seen. */}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="aii-split">
        <ul className="aiw-list" aria-label="Recommendations">
          {rows.length === 0 && <li className="aiw-list-empty">Nothing in this view.</li>}
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="aiw-list-btn"
                aria-current={openId === row.id ? 'true' : undefined}
                onClick={() => setOpenId(row.id)}
              >
                <span className="aiw-list-body">
                  <span className="aiw-list-title" style={{ display: 'block' }}>{row.title}</span>
                  <span className="aiw-meta">
                    <PriorityChip priority={row.priority} />
                    <StatusChip status={row.status} />
                    {row.confidence !== null && (
                      <span className="aiw-num">confidence {(row.confidence * 100).toFixed(0)}%</span>
                    )}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div style={{ minWidth: 0 }}>
          {openId === null ? (
            <p className="aiw-dashed aiw-dashed--tall">
              Select a recommendation to see the reasoning and evidence behind it.
            </p>
          ) : chainError !== '' ? (
            <Notice icon="error">{chainError}</Notice>
          ) : shownChain === null ? (
            <div className="aii-card">
              <LoadingLine>Loading the explanation…</LoadingLine>
            </div>
          ) : (
            <ChainPanel
              chain={shownChain}
              note={note}
              noteError={noteError}
              onNote={setNote}
              deciding={deciding}
              onDecide={decide}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ChainPanel({
  chain,
  note,
  noteError,
  onNote,
  deciding,
  onDecide,
}: {
  chain: RecommendationChain;
  note: string;
  noteError?: string;
  onNote: (value: string) => void;
  deciding: boolean;
  onDecide: (decision: RecommendationDecision) => void;
}) {
  const recommendation = chain.recommendation;

  if (recommendation === null) return null;

  return (
    <div className="aiw-panel-stack">
      <section className="aiw-panel">
        <h3 className="aiw-h2">{recommendation.title}</h3>
        <p className="aiw-meta">
          <PriorityChip priority={recommendation.priority} />
          <StatusChip status={recommendation.status} />
          {recommendation.confidence !== null && (
            <span className="aiw-num">confidence {(recommendation.confidence * 100).toFixed(0)}%</span>
          )}
          {recommendation.category && <span>{recommendation.category}</span>}
        </p>
        {recommendation.description && (
          <p className="aiw-body aiw-body--muted" style={{ marginTop: 'var(--space-3)' }}>
            {recommendation.description}
          </p>
        )}

        {/* Prose, not labels — these columns hold sentences in the source data. */}
        <dl className="aiw-prose-list">
          {(['impact', 'cost', 'risk'] as const).map((key) =>
            recommendation[key] && recommendation[key] !== '-' ? (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{recommendation[key]}</dd>
              </div>
            ) : null,
          )}
        </dl>
      </section>

      <section className="aiw-panel">
        <h4 className="aiw-h3">Why this was recommended</h4>
        {chain.reasoning === null ? (
          // Stated rather than left as an empty panel: a recommendation with no
          // reasoning step is a real state in this data, and "none recorded" is a
          // different fact from "the lookup failed".
          <p className="aiw-body aiw-body--muted">No reasoning step is recorded for this recommendation.</p>
        ) : (
          <>
            <p className="aiw-body">{chain.reasoning.description}</p>
            <p className="aiw-meta">
              {chain.reasoning.step_order !== null && `Step ${chain.reasoning.step_order}`}
              {chain.reasoning.confidence !== null &&
                ` · confidence ${(chain.reasoning.confidence * 100).toFixed(0)}%`}
            </p>
          </>
        )}
      </section>

      <section className="aiw-panel">
        <h4 className="aiw-h3">
          Evidence <span className="aii-muted">({chain.evidence.length})</span>
        </h4>
        {chain.evidence.length === 0 ? (
          <p className="aiw-body aiw-body--muted">No evidence is linked to this one.</p>
        ) : (
          <ul className="aiw-evidence">
            {chain.evidence.map((record) => (
              <li key={record.id}>
                <p className="aiw-meta" style={{ marginTop: 0 }}>
                  <span className="aiw-strong">{record.evidence_type}</span>
                  {record.source && <span>{record.source}</span>}
                  {record.confidence !== null && (
                    <span className="aiw-num">{(record.confidence * 100).toFixed(0)}%</span>
                  )}
                  {record.observed_date && <span>{record.observed_date.slice(0, 10)}</span>}
                </p>
                <pre className="aii-pre">{record.content}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recommendation.is_pending ? (
        <section className="aiw-panel">
          <h4 className="aiw-h3">Decide</h4>
          <p className="aiw-caption">
            The note is stored in the audit trail, which is where &ldquo;who decided this, and
            why&rdquo; belongs.
          </p>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Field label="Note (optional)" error={noteError}>
              <TextInput
                value={note}
                onChange={(event) => onNote(event.target.value)}
                placeholder="Optional note"
              />
            </Field>
          </div>
          <div className="aii-row" style={{ marginTop: 'var(--space-3)' }}>
            <Button
              variant="primary"
              loading={deciding}
              onClick={() => onDecide('approve')}
              icon={<ThumbsUp size={16} aria-hidden="true" />}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              disabled={deciding}
              onClick={() => onDecide('reject')}
              icon={<ThumbsDown size={16} aria-hidden="true" />}
            >
              Reject
            </Button>
            <Button
              variant="secondary"
              disabled={deciding}
              onClick={() => onDecide('defer')}
              icon={<Clock size={16} aria-hidden="true" />}
            >
              Defer
            </Button>
          </div>
        </section>
      ) : (
        <p className="aiw-dashed">
          Already {recommendation.status}. Only an open recommendation can be decided — the API
          refuses the rest, so a decision cannot be silently overwritten.
        </p>
      )}
    </div>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  if (!priority) return null;

  const tone = priority === 'critical' ? 'danger' : priority === 'high' ? 'gold' : 'neutral';

  // The word carries the meaning, so no glyph beside it.
  return (
    <StatusBadge tone={tone} icon={false}>
      <span style={{ textTransform: 'capitalize' }}>{priority}</span>
    </StatusBadge>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <StatusBadge tone="neutral" icon={false}>
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </StatusBadge>
  );
}
