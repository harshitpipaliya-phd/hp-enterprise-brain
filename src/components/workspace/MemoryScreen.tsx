import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Search } from 'lucide-react';
import { PageHeader } from '../../ui';
import { organizationalMemoryApi } from '../../api/organizationalMemory';
import type {
  MemoryDetailData,
  MemoryFilters,
  MemoryPage,
  MemorySummary,
} from '../../api/organizationalMemory';
import { PanelSkeleton } from '../intelligence/parts';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { StatTile } from '../knowledge/badges';
import { MemoryCard } from '../knowledge/MemoryCard';
import { MemoryDetail } from '../knowledge/MemoryDetail';
import '../knowledge/knowledge.css';

/**
 * ORGANIZATIONAL MEMORY — the LEARN surface.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOT A DOCUMENT LIBRARY. THE LOOP, MADE LEGIBLE.
 *
 *   evidence → decision → execution → outcome → learning → reuse
 *
 * Each card renders that chain in order, and each step is allowed to say it is
 * empty. A screen where the chain always looks complete teaches the reader
 * nothing about the times it wasn't — and the broken ones are the ones worth
 * their attention.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SCREEN WILL NOT DO
 *
 * Every outcome in this installation is stored as result="improved". Most
 * carry metrics of {baseline:0, observed:0, changePercent:0} and no evidence
 * rows. The previous screen would have rendered that as a success with a
 * confidence percentage beside it. The server grades those as UNDETERMINED and
 * this screen prints the word — an intervention nobody measured is not a
 * success, and counting it as one is how a tool starts lying to its owner.
 *
 * The old implementation also called `fetch('/api/v1/events?type=...&limit=500')`
 * directly, with no tenant in the request: it pulled every tenant's grounding
 * events and filtered them in the browser by id. That call is gone. Scope is
 * decided server-side now, in OrganizationalMemoryController.
 */
export default function MemoryScreen({
  tenantId,
  onNavigate,
}: {
  tenantId: string;
  onNavigate?: (view: string) => void;
}) {
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [page, setPage] = useState<MemoryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<MemoryFilters>({ page: 1 });
  const [searchTerm, setSearchTerm] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemoryDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => (f.q === (searchTerm || undefined) ? f : { ...f, q: searchTerm || undefined, page: 1 }));
    }, 250);

    return () => window.clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    let live = true;

    organizationalMemoryApi
      .summary(tenantId)
      .then((data) => { if (live) setSummary(data); })
      .catch(() => { if (live) setSummary(null); });

    return () => { live = false; };
  }, [tenantId]);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    organizationalMemoryApi
      .list(tenantId, filters)
      .then((data) => { if (live) setPage(data); })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Organizational memory could not be loaded.');
      })
      .finally(() => { if (live) setLoading(false); });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterKey]);

  useEffect(() => {
    if (!openId) { setDetail(null); setDetailError(null); return; }

    let live = true;
    setDetailLoading(true);
    setDetailError(null);

    organizationalMemoryApi
      .detail(tenantId, openId)
      .then((data) => { if (live) setDetail(data); })
      .catch((e: unknown) => {
        if (live) setDetailError(e instanceof Error ? e.message : 'This memory could not be opened.');
      })
      .finally(() => { if (live) setDetailLoading(false); });

    return () => { live = false; };
  }, [tenantId, openId]);

  const set = useCallback((patch: Partial<MemoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }, []);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([k, v]) => k !== 'page' && v !== undefined && v !== '').length,
    [filters],
  );

  /* ---------------------------------------------------------- detail view -- */

  if (openId) {
    return (
      <div className="kb">
        <PageHeader
          variant="detail"
          icon={<Database />}
          eyebrow="Organizational Memory"
          title={detail?.title ?? 'Memory'}
          back={{ label: '← Back to Memory', onClick: () => setOpenId(null) }}
        />
        {detailLoading && !detail ? (
          <PanelSkeleton rows={8} />
        ) : detailError ? (
          <ErrorState message={detailError} onRetry={() => setOpenId(openId)} />
        ) : detail ? (
          <MemoryDetail
            memory={detail}
            actions={{
              onDecision: onNavigate ? () => onNavigate('decisionintel') : undefined,
              onEvidence: onNavigate ? () => onNavigate('evidence') : undefined,
              onExecution: onNavigate ? () => onNavigate('esolibrary') : undefined,
              onOpenMemory: (id) => setOpenId(id),
            }}
          />
        ) : null}
      </div>
    );
  }

  /* ------------------------------------------------------------- the feed -- */

  const items = page?.items ?? [];
  const total = page?.total ?? 0;
  const allSeeded = summary !== null && summary.total > 0 && summary.observed === 0;

  return (
    <div className="kb">
      <PageHeader
        variant="list"
        icon={<Database />}
        title="Organizational Memory"
        description="What the organization has learned from experience."
      />

      {summary && (
        <div className="kb-stats">
          <StatTile
            label="Memories"
            value={summary.total.toLocaleString()}
            hint="learnings written from recorded outcomes"
            onClick={() => { setFilters({ page: 1 }); setSearchTerm(''); }}
            active={activeFilters === 0}
          />
          <StatTile
            label="Worked"
            value={summary.successfulInterventions.toLocaleString()}
            hint="outcomes that improved AND were measured"
            tone={summary.successfulInterventions > 0 ? 'good' : 'neutral'}
          />
          <StatTile
            label="Failed"
            value={summary.failedInterventions.toLocaleString()}
            hint="outcomes recorded as a regression"
            tone={summary.failedInterventions > 0 ? 'crit' : 'neutral'}
          />
          {/*
            THE COUNTER THAT KEEPS THE OTHER TWO HONEST.

            Without it, seven outcomes labelled "improved" with zero metrics
            would have to land somewhere — and wherever they landed they would
            be wrong. They are neither successes nor failures; they are
            interventions nobody measured, and that is its own finding.
          */}
          <StatTile
            label="Unmeasured"
            value={summary.unmeasuredInterventions.toLocaleString()}
            hint="labelled, but no metric or evidence behind it"
            tone={summary.unmeasuredInterventions > 0 ? 'warn' : 'neutral'}
          />
          <StatTile
            label="Reused learnings"
            value={summary.reusedLearnings.toLocaleString()}
            hint="reached again from a separate outcome"
            onClick={() => set({ reusable: true })}
            active={filters.reusable === true}
          />
          <StatTile
            label="Recent"
            value={summary.recentLearning.toLocaleString()}
            hint="written in the last 30 days"
          />
        </div>
      )}

      {allSeeded && (
        <div className="kb-notice" role="status">
          <div>
            <b>All {summary.total} memories here are demonstration data</b>
            <p>
              Every learning below was written by a seeder rather than produced by this organization's own
              loop. The chain, the grading and the evidence links are live against the database — but nothing
              here is yet a record of something your teams lived through. Run the loop to record real
              outcomes, and real memory will replace this.
            </p>
          </div>
        </div>
      )}

      <div className="kb-controls">
        <label className="kb-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search lessons, patterns and domains…"
            aria-label="Search memory"
          />
        </label>

        <select
          className="kb-select"
          value={filters.domain ?? ''}
          onChange={(e) => set({ domain: e.target.value || undefined })}
          aria-label="Filter by domain"
        >
          <option value="">All domains</option>
          {summary?.domains.map((d) => (
            <option key={d.value} value={d.value}>
              {d.value} ({d.count})
            </option>
          ))}
        </select>

        <select
          className="kb-select"
          value={filters.pattern ?? ''}
          onChange={(e) => set({ pattern: e.target.value || undefined })}
          aria-label="Filter by pattern"
        >
          <option value="">All patterns</option>
          {summary?.patterns.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value.replace(/[_-]+/g, ' ')} ({p.count})
            </option>
          ))}
        </select>

        {activeFilters > 0 && (
          <button type="button" className="kb-clear" onClick={() => { setFilters({ page: 1 }); setSearchTerm(''); }}>
            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {loading && !page ? (
        <div className="mem-feed">
          <PanelSkeleton rows={5} />
          <PanelSkeleton rows={5} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setFilters((f) => ({ ...f }))} />
      ) : items.length === 0 ? (
        activeFilters > 0 ? (
          <EmptyState
            icon="search"
            title="No memories match these filters"
            description={`Memory holds ${summary?.total ?? 0} learning${(summary?.total ?? 0) === 1 ? '' : 's'}, but none match what you have narrowed to.`}
            action={
              <button type="button" className="u-btn u-btn-secondary" onClick={() => { setFilters({ page: 1 }); setSearchTerm(''); }}>
                Clear filters
              </button>
            }
          />
        ) : (
          /*
            AN EMPTY MEMORY IS EXPLAINED BY THE LOOP THAT FILLS IT.

            "No learnings yet" tells the reader nothing they can act on. A
            learning exists only after a decision has been executed and its
            outcome recorded, so the empty state names that sequence and points
            at the step where their organization currently stands.
          */
          <EmptyState
            icon="inbox"
            title="This organization has not recorded a learning yet"
            description="A memory is written when a decision is executed and its outcome is recorded — evidence, decision, execution, outcome, then learning. Nothing is inferred on the organization's behalf, so until that sequence completes at least once, this screen is honestly empty."
            action={
              onNavigate ? (
                <button type="button" className="u-btn u-btn-primary" onClick={() => onNavigate('decisionintel')}>
                  Open Decision Intelligence
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <p className="kb-resultline">
            Showing {items.length} of {total.toLocaleString()} memor{total === 1 ? 'y' : 'ies'}
            {filters.q && <> matching “{filters.q}”</>}.
            {summary && summary.distinctPatterns > 0 && (
              <>
                {' '}
                Across {summary.distinctPatterns} distinct pattern{summary.distinctPatterns === 1 ? '' : 's'}.
              </>
            )}
          </p>

          <div className="mem-feed">
            {items.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onOpen={() => setOpenId(memory.id)}
                onDecision={onNavigate ? () => onNavigate('decisionintel') : undefined}
                onEvidence={onNavigate ? () => onNavigate('evidence') : undefined}
              />
            ))}
          </div>

          {page && page.pages > 1 && (
            <div className="kb-pager">
              <button type="button" onClick={() => set({ page: page.page - 1 })} disabled={page.page <= 1}>
                ← Previous
              </button>
              <span className="kb-pager__n">
                Page {page.page} of {page.pages}
              </span>
              <button type="button" onClick={() => set({ page: page.page + 1 })} disabled={page.page >= page.pages}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
