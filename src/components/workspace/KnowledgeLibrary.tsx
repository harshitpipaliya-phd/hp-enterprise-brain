import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Library, Search } from 'lucide-react';
import { PageHeader } from '../../ui';
import { knowledgeLibraryApi } from '../../api/knowledgeLibrary';
import type {
  FreshnessState,
  KnowledgeDetailData,
  KnowledgeFilters,
  KnowledgePage,
  KnowledgeSummary,
} from '../../api/knowledgeLibrary';
import { PanelSkeleton } from '../intelligence/parts';
import { EmptyState } from '../states/EmptyState';
import { ErrorState } from '../states/ErrorState';
import { StatTile } from '../knowledge/badges';
import { KnowledgeCard } from '../knowledge/KnowledgeCard';
import { KnowledgeDetail } from '../knowledge/KnowledgeDetail';
import '../knowledge/knowledge.css';

/**
 * KNOWLEDGE LIBRARY — the organization's RETRIEVE surface.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SCREEN IS FOR, AND WHAT IT REFUSES TO BE
 *
 * It answers four questions about a body of written knowledge: what does this
 * organization have, where did it come from, how fresh is it, and is anyone
 * using it. A filename, a size and a modified date answer none of those, which
 * is the difference between this and a document table.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING IS COMPUTED HERE
 *
 * Freshness, confidence and provenance are graded server-side in
 * KnowledgeGrading from config/knowledge.php. This component formats and lays
 * out. A second implementation of "stale" in the browser would be a second
 * definition of it, and the two would part company the first time the
 * threshold moved.
 *
 * The screen this replaced held a hardcoded list of ten category names, so it
 * offered filters matching nothing and hid the five categories that existed.
 * Every facet below is counted in SQL from what the tenant actually holds.
 */
export default function KnowledgeLibrary({
  tenantId,
  onNavigate,
}: {
  tenantId: string;
  onNavigate?: (view: string) => void;
}) {
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null);
  const [page, setPage] = useState<KnowledgePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<KnowledgeFilters>({ page: 1 });
  const [searchTerm, setSearchTerm] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<KnowledgeDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  /*
    ONE REQUEST PER KEYSTROKE IS A DENIAL OF SERVICE ON YOUR OWN API.

    The term is debounced into the filter object, and the filter object is what
    the effect depends on — so typing "turnaround" issues one search, not ten,
    and a slow response for "turn" cannot land after the one for "turnaround"
    and overwrite it (the effect's own `live` guard handles that).
  */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => (f.q === (searchTerm || undefined) ? f : { ...f, q: searchTerm || undefined, page: 1 }));
    }, 250);

    return () => window.clearTimeout(id);
  }, [searchTerm]);

  // The summary is per tenant, not per filter, so it is fetched once and not
  // re-requested every time the reader narrows the shelf.
  useEffect(() => {
    let live = true;

    knowledgeLibraryApi
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

    knowledgeLibraryApi
      .list(tenantId, filters)
      .then((data) => { if (live) setPage(data); })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'The knowledge library could not be loaded.');
      })
      .finally(() => { if (live) setLoading(false); });

    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, filterKey]);

  // Detail is fetched on open rather than shipped with every card, so the
  // shelf stays one small payload however much body text the assets carry.
  useEffect(() => {
    if (!openId) { setDetail(null); setDetailError(null); return; }

    let live = true;
    setDetailLoading(true);
    setDetailError(null);

    knowledgeLibraryApi
      .detail(tenantId, openId)
      .then((data) => { if (live) setDetail(data); })
      .catch((e: unknown) => {
        if (live) setDetailError(e instanceof Error ? e.message : 'This item could not be opened.');
      })
      .finally(() => { if (live) setDetailLoading(false); });

    return () => { live = false; };
  }, [tenantId, openId]);

  const set = useCallback((patch: Partial<KnowledgeFilters>) => {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }, []);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([k, v]) => k !== 'page' && v !== undefined && v !== '').length,
    [filters],
  );

  const headerRef = useRef<HTMLDivElement>(null);

  const goToPage = (n: number) => {
    setFilters((f) => ({ ...f, page: n }));
    headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---------------------------------------------------------- detail view -- */

  if (openId) {
    return (
      <div className="kb">
        <PageHeader
          variant="detail"
          icon={<Library />}
          eyebrow="Knowledge Library"
          title={detail?.title ?? 'Knowledge asset'}
          back={{ label: '← Back to Knowledge Library', onClick: () => setOpenId(null) }}
        />
        {detailLoading && !detail ? (
          <PanelSkeleton rows={6} />
        ) : detailError ? (
          <ErrorState message={detailError} onRetry={() => setOpenId(openId)} />
        ) : detail ? (
          <KnowledgeDetail
            asset={detail}
            actions={{
              onDepartment: onNavigate ? () => onNavigate('departments') : undefined,
              onCapability: onNavigate ? () => onNavigate('capabilities') : undefined,
              onPerson: onNavigate ? () => onNavigate('people') : undefined,
              onOpenKnowledge: (id) => setOpenId(id),
            }}
          />
        ) : null}
      </div>
    );
  }

  /* ------------------------------------------------------------ the shelf -- */

  const items = page?.items ?? [];
  const total = page?.total ?? 0;
  const allSeeded = summary !== null && summary.total > 0 && summary.observed === 0;

  return (
    <div className="kb">
      <div ref={headerRef} />
      <PageHeader
        variant="list"
        icon={<Library />}
        title="Knowledge Library"
        description="Find the knowledge behind how the organization works."
      />

      {summary && (
        <div className="kb-stats">
          <StatTile
            label="Knowledge assets"
            value={summary.total.toLocaleString()}
            hint="written down and retrievable"
            onClick={() => setFilters({ page: 1 })}
            active={activeFilters === 0}
          />
          <StatTile
            label="Recently added"
            value={summary.recentlyAdded.toLocaleString()}
            hint="created in the last 30 days"
          />
          <StatTile
            label="Frequently reused"
            value={summary.frequentlyReused.toLocaleString()}
            hint="marked as reused 5+ times"
            tone={summary.frequentlyReused > 0 ? 'good' : 'neutral'}
            onClick={() => set({ sort: 'reused' })}
            active={filters.sort === 'reused'}
          />
          <StatTile
            label="Stale"
            value={summary.stale.toLocaleString()}
            hint="untouched beyond the staleness threshold"
            tone={summary.stale > 0 ? 'crit' : 'good'}
            onClick={() => set({ freshness: summary.stale > 0 ? 'STALE' : undefined })}
            active={filters.freshness === 'STALE'}
          />
          <StatTile
            label="Categories"
            value={summary.categories.length.toLocaleString()}
            hint="types this organization actually uses"
          />
        </div>
      )}

      {/*
        THE HONEST HEADLINE ABOUT THIS DATA.

        Every asset on this shelf was written by a seeder. Saying so once, at
        the top, is the difference between a demonstration and a claim about
        the organization's own written knowledge — and it is far better to say
        it here than to let a client discover it later.
      */}
      {allSeeded && (
        <div className="kb-notice" role="status">
          <div>
            <b>All {summary.total} items here are demonstration data</b>
            <p>
              Every asset on this shelf was written by a seeder, not by this organization. The shelf, its
              grading and its search are live against the database — but nothing below is yet a record of
              what your teams have actually written down. Import or author real knowledge to replace it.
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
            placeholder="Search titles, content and tags…"
            aria-label="Search knowledge"
          />
        </label>

        <select
          className="kb-select"
          value={filters.category ?? ''}
          onChange={(e) => set({ category: e.target.value || undefined })}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {summary?.categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.value.replace(/[_-]+/g, ' ')} ({c.count})
            </option>
          ))}
        </select>

        <select
          className="kb-select"
          value={filters.department ?? ''}
          onChange={(e) => set({ department: e.target.value || undefined })}
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {summary?.departments.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label} ({d.count})
            </option>
          ))}
        </select>

        <select
          className="kb-select"
          value={filters.freshness ?? ''}
          onChange={(e) => set({ freshness: (e.target.value || undefined) as FreshnessState | undefined })}
          aria-label="Filter by freshness"
        >
          <option value="">Any freshness</option>
          <option value="FRESH">Fresh</option>
          <option value="AGING">Aging</option>
          <option value="STALE">Stale</option>
        </select>

        <select
          className="kb-select"
          value={filters.sort ?? 'recent'}
          onChange={(e) => set({ sort: e.target.value as KnowledgeFilters['sort'] })}
          aria-label="Sort"
        >
          <option value="recent">Recently updated</option>
          <option value="reused">Most reused</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>

        {activeFilters > 0 && (
          <button type="button" className="kb-clear" onClick={() => { setFilters({ page: 1 }); setSearchTerm(''); }}>
            Clear {activeFilters} filter{activeFilters === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {loading && !page ? (
        <div className="kb-shelf">
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={4} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setFilters((f) => ({ ...f }))} />
      ) : items.length === 0 ? (
        /*
          TWO DIFFERENT EMPTIES, TWO DIFFERENT ANSWERS.

          A filter that matched nothing is the reader's own doing and is fixed
          by clearing it. An empty library is a fact about the organization and
          is fixed by adding knowledge. Showing one message for both would send
          half the readers to the wrong action.
        */
        activeFilters > 0 ? (
          <EmptyState
            icon="search"
            title="No knowledge matches these filters"
            description={`The library holds ${summary?.total ?? 0} item${(summary?.total ?? 0) === 1 ? '' : 's'}, but none match what you have narrowed to. Clearing the filters will bring the shelf back.`}
            action={
              <button type="button" className="u-btn u-btn-secondary" onClick={() => { setFilters({ page: 1 }); setSearchTerm(''); }}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="inbox"
            title="No knowledge has been written down yet"
            description="This library holds policies, SOPs, templates and lessons your organization records deliberately. Nothing has been added for this tenant, and nothing is inferred on its behalf — an empty shelf is the honest state, not a broken screen."
            action={
              onNavigate ? (
                <button type="button" className="u-btn u-btn-primary" onClick={() => onNavigate('ingestion')}>
                  Connect a source
                </button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <p className="kb-resultline">
            Showing {items.length} of {total.toLocaleString()} item{total === 1 ? '' : 's'}
            {filters.q && <> matching “{filters.q}”</>}.
          </p>

          <div className="kb-shelf">
            {items.map((asset) => (
              <KnowledgeCard
                key={asset.id}
                asset={asset}
                onOpen={() => setOpenId(asset.id)}
                onDepartment={onNavigate ? () => onNavigate('departments') : undefined}
              />
            ))}
          </div>

          {page && page.pages > 1 && (
            <div className="kb-pager">
              <button type="button" onClick={() => goToPage(page.page - 1)} disabled={page.page <= 1}>
                ← Previous
              </button>
              <span className="kb-pager__n">
                Page {page.page} of {page.pages}
              </span>
              <button type="button" onClick={() => goToPage(page.page + 1)} disabled={page.page >= page.pages}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
