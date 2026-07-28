import { useState } from 'react';
import { api } from '../../api/intelligence';
import { graphApi } from '../../api/graph';
import { useTheme } from '../../hooks/useTheme';

interface Result {
  source: 'business' | 'graph';
  entityType: string;
  id: string;
  headline: string;
}

/**
 * Global Search. Closes the duplication flagged in FEATURE_MATRIX.md — not
 * by deleting either backend (they're genuinely different: Postgres ILIKE
 * over business objects vs Neo4j substring match over all 17 graph node
 * labels), but by giving the user ONE search experience instead of two.
 * Results are clearly labeled by source so the distinction stays honest.
 */
export default function GlobalSearch({ tenantId }: { tenantId: string }) {
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
          merged.push({ source: 'business', entityType: r.entityType, id: r.id, headline: r.headline });
        }
      }
      if (graphResults.status === 'fulfilled') {
        for (const r of graphResults.value.results) {
          const p = r.properties;
          merged.push({ source: 'graph', entityType: r.labels[0], id: String(p.id), headline: String(p.title ?? p.name ?? p.statement ?? p.id) });
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
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 16 }}>Global Search</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search across everything..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
        />
        <button onClick={search}>Search</button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: theme.textMuted }}>Searching...</div>}
      {!loading && results.length === 0 && query && <p style={{ color: theme.textMuted }}>No results.</p>}

      <div style={{ display: 'grid', gap: 8 }}>
        {results.map((r, i) => (
          <div key={i} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>
              {r.entityType} · {r.source === 'business' ? 'business record' : 'knowledge graph'}
            </span>
            <div>{r.headline}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
