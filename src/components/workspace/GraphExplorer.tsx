import { useState } from 'react';
import { graphApi } from '../../api/graph';
import { useTheme } from '../../hooks/useTheme';

interface GraphNode {
  labels: string[];
  properties: Record<string, unknown>;
}
interface GraphRelationship {
  type: string;
  direction: 'outgoing' | 'incoming';
  otherNode: GraphNode;
}
interface HistoryEntry {
  label: string;
  id: string;
}

const LABEL_COLOR: Record<string, string> = {
  Case: '#8b5cf6', Hypothesis: '#8b5cf6', Signal: '#3b82f6', Evidence: '#3b82f6',
  Recommendation: '#f59e0b', Decision: '#f59e0b', Risk: '#ef4444', Policy: '#ef4444',
  Organization: '#22c55e', Department: '#22c55e', Person: '#22c55e', Capability: '#22c55e',
};

function nodeLabel(node: GraphNode): string {
  const p = node.properties;
  return String(p.title ?? p.name ?? p.statement ?? p.id ?? node.labels[0]);
}

/**
 * Knowledge Graph Explorer. Search a node, see its details, browse its
 * relationships, click into a related node — the actual functional
 * requirements (search, details panel, expand/navigate) without adding a
 * canvas/physics graph-rendering dependency. History trail gives the
 * "go back" experience.
 */
export default function GraphExplorer({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [current, setCurrent] = useState<{ label: string; id: string; node: GraphNode } | null>(null);
  const [related, setRelated] = useState<GraphRelationship[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await graphApi.search(tenantId, query);
      setSearchResults(result.results);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openNode = async (label: string, id: string, pushHistory = true) => {
    setLoading(true);
    setError(null);
    try {
      const [entity, relatedResult] = await Promise.all([
        graphApi.getEntity(tenantId, label, id),
        graphApi.getRelated(tenantId, label, id),
      ]);
      if (pushHistory && current) setHistory((h) => [...h, { label: current.label, id: current.id }]);
      setCurrent({ label, id, node: entity });
      setRelated(relatedResult.related);
      setSearchResults([]);
      setQuery('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    openNode(previous.label, previous.id, false);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 16 }}>Knowledge Graph Explorer</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search a Case, Signal, Recommendation..."
          style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
        />
        <button onClick={runSearch}>Search</button>
        {history.length > 0 && <button onClick={goBack}>← Back</button>}
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ color: theme.textMuted, marginBottom: 16 }}>Loading...</div>}

      {searchResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3>Search Results</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {searchResults.map((n) => (
              <div
                key={String(n.properties.id)}
                onClick={() => openNode(n.labels[0], String(n.properties.id))}
                style={{ padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${LABEL_COLOR[n.labels[0]] ?? theme.border}`, cursor: 'pointer' }}
              >
                <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase' }}>{n.labels[0]}</span>
                <div>{nodeLabel(n)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h3>Node Details — {current.label}</h3>
            <div style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface }}>
              {Object.entries(current.node.properties).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${theme.border}` }}>
                  <span style={{ color: theme.textMuted, fontSize: 12 }}>{key}</span>
                  <span style={{ fontSize: 13, maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3>Related Entities ({related.length})</h3>
            {related.length === 0 ? (
              <p style={{ color: theme.textMuted }}>No connected entities.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {related.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => openNode(r.otherNode.labels[0], String(r.otherNode.properties.id))}
                    style={{ padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 11, color: theme.textMuted }}>
                      {r.direction === 'outgoing' ? '→' : '←'} {r.type} · {r.otherNode.labels[0]}
                    </span>
                    <div>{nodeLabel(r.otherNode)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!current && searchResults.length === 0 && !loading && (
        <p style={{ color: theme.textMuted }}>Search for an entity to begin exploring the graph.</p>
      )}
    </div>
  );
}
