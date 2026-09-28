import { useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '../../ui';
import { api } from '../../api/intelligence';
import { graphApi } from '../../api/graph';
import { useTheme } from '../../hooks/useTheme';

interface Result {
  source: 'business' | 'graph';
  entityType: string;
  id: string;
  headline: string;
  /**
   * The full underlying row, when the endpoint sent one. The business search
   * already returns it (`record`) and previously discarded it at merge time;
   * the graph search's `properties` serves the same role. Kept only for the
   * one thing neither `id` nor `headline` carries: an evidence row's
   * `signalId`, needed to open the chain it supports.
   */
  record?: Record<string, unknown>;
}

interface Navigators {
  onOpenDepartment?: (departmentId: string) => void;
  onOpenPerson?: (personId: string) => void;
  onOpenChain?: (signalId: string) => void;
  onOpenCase?: (caseId: string) => void;
}

/**
 * The click handler for one result, or undefined when this application has
 * nowhere to send it.
 *
 * BOTH SEARCH BACKENDS NAME THE SAME RECORDS DIFFERENTLY. The business
 * search's own entityType values are lowercase table-ish names (`signals`,
 * `cases`, `evidence`, …); the graph search's are the graph's node labels
 * (`Signal`, `Case`, `Evidence`, `Department`, `Person`, …). Both spellings
 * are matched here because they can point at the exact same
 * hpbrain_signals/hpbrain_cases/hpbrain_evidence row — a result is not
 * misrouted by treating them as different destinations, it is just left
 * unclickable for no reason.
 */
function destinationFor(result: Result, nav: Navigators): (() => void) | undefined {
  switch (result.entityType) {
    case 'Department':
      return nav.onOpenDepartment ? () => nav.onOpenDepartment!(result.id) : undefined;
    case 'Person':
      return nav.onOpenPerson ? () => nav.onOpenPerson!(result.id) : undefined;
    case 'Signal':
    case 'signals':
      return nav.onOpenChain ? () => nav.onOpenChain!(result.id) : undefined;
    case 'Case':
    case 'cases':
      return nav.onOpenCase ? () => nav.onOpenCase!(result.id) : undefined;
    case 'Evidence':
    case 'evidence': {
      // There is no standalone evidence screen — the honest destination is
      // the chain of the signal this evidence supports, where the evidence
      // itself is shown in context. Null/missing signalId (the schema allows
      // it) leaves the result unclickable rather than opening the wrong chain.
      const signalId = result.record?.signalId ?? result.record?.signal_id;
      return nav.onOpenChain && typeof signalId === 'string' && signalId !== ''
        ? () => nav.onOpenChain!(signalId)
        : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Global Search. Closes the duplication flagged in FEATURE_MATRIX.md — not
 * by deleting either backend (they're genuinely different: Postgres ILIKE
 * over business objects vs Neo4j substring match over all 17 graph node
 * labels), but by giving the user ONE search experience instead of two.
 * Results are clearly labeled by source so the distinction stays honest.
 *
 * OPENING A RESULT NEVER TREATS A DISPLAY LABEL AS AN ID. `entityType` and
 * `id` come straight from the endpoint that found the row — the business
 * search's own `entityType` (signals/evidence/cases/recommendations/
 * learnings/capabilities — it does not search Department or Person at all)
 * or the graph search's node label (which does: Department, Person, Student,
 * Signal, and others). Only the types this application actually has a
 * destination for become clickable:
 *
 *   Department → that department's own intelligence screen
 *   Person     → that person's own intelligence screen
 *   Signal     → its full Signal Chain
 *
 * Everything else renders exactly as it did before — inert, not a dead
 * button pretending to go somewhere.
 */
export default function GlobalSearch({
  tenantId,
  onOpenDepartment,
  onOpenPerson,
  onOpenChain,
  onOpenCase,
}: {
  tenantId: string;
  onOpenDepartment?: (departmentId: string) => void;
  onOpenPerson?: (personId: string) => void;
  onOpenChain?: (signalId: string) => void;
  onOpenCase?: (caseId: string) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [businessResults, graphResults] = await Promise.allSettled([
        api.search(tenantId, query),
        graphApi.search(tenantId, query),
      ]);

      const merged: Result[] = [];
      if (businessResults.status === 'fulfilled') {
        for (const r of businessResults.value.results) {
          merged.push({ source: 'business', entityType: r.entityType, id: r.id, headline: r.headline, record: r.record });
        }
      }
      if (graphResults.status === 'fulfilled') {
        for (const r of graphResults.value.results) {
          const p = r.properties;
          merged.push({ source: 'graph', entityType: r.labels[0], id: String(p.id), headline: String(p.title ?? p.name ?? p.statement ?? p.id), record: p });
        }
      }
      const seen = new Set<string>();
      const deduped = merged.filter((r) => {
        const key = `${r.entityType}:${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setResults(deduped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 800, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <PageHeader
        variant="list"
        icon={<Search />}
        title="Global Search"
        description="One query across every record this organization holds — people, departments, capabilities, signals and evidence."
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search across everything..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
        />
        <button onClick={search}>Search</button>
      </div>

      {error && <div style={{ color: 'var(--status-crit)', marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: theme.textMuted }}>Searching...</div>}
      {!loading && results.length === 0 && query && <p style={{ color: theme.textMuted }}>No results.</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        {results.map((r, i) => {
          const open = destinationFor(r, { onOpenDepartment, onOpenPerson, onOpenChain, onOpenCase });

          return (
            <div
              key={i}
              role={open ? 'button' : undefined}
              tabIndex={open ? 0 : undefined}
              onClick={open}
              onKeyDown={open ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
              style={{
                padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`,
                cursor: open ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>
                {r.entityType} · {r.source === 'business' ? 'business record' : 'knowledge graph'}
              </span>
              <div>{r.headline}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
