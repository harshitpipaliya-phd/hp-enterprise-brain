import { useState, useEffect } from 'react';
import { api } from '../../api/intelligence';
import { aiApi } from '../../api/ai';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../Toast';

interface Evidence {
  id: string;
  signalId: string | null;
  source: string;
  evidenceType: string;
  content: Record<string, unknown>;
  provenance: Record<string, unknown>;
  confidence: number;
  observedDate: string;
  createdDate: string;
}

/**
 * Evidence Workspace (EPIC-002). The first incomplete item found by the
 * ground-truth audit — real, tested backend since Sprint 2, zero UI until
 * this screen. Shows provenance and freshness explicitly, since that's the
 * whole point of Evidence in this system: it's not fact until corroborated,
 * and it matters less as it ages (see Reasoning's confidence computation).
 */
export default function EvidenceWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const { showToast } = useToast();
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ signalId: '', source: 'internal', content: '', confidence: '0.7' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEvidence(await api.listEvidence(tenantId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const summarizeWithAI = async (item: Evidence) => {
    setSummarizingId(item.id);
    try {
      const note = String((item.content as any)?.note ?? JSON.stringify(item.content));
      const result = await aiApi.summarizeEvidence(note, item.id);
      if ('summary' in result) {
        showToast('info', result.summary);
      } else {
        showToast(result.providerConfigured ? 'error' : 'warning', result.error);
      }
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setSummarizingId(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.collectEvidence({
        tenantId,
        signalId: form.signalId || undefined,
        source: form.source,
        content: { note: form.content },
        provenance: { source: form.source, confidence: Number(form.confidence) },
        confidence: Number(form.confidence),
      });
      setForm({ signalId: '', source: 'internal', content: '', confidence: '0.7' });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const freshnessLabel = (observedDate: string): string => {
    const ageDays = (Date.now() - new Date(observedDate).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) return 'Fresh';
    if (ageDays < 30) return 'Recent';
    if (ageDays < 90) return 'Aging';
    return 'Stale';
  };
  const freshnessColor: Record<string, string> = { Fresh: '#22c55e', Recent: '#3b82f6', Aging: '#f59e0b', Stale: '#ef4444' };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Evidence Workspace</h1>
        <div>
          <button onClick={() => setShowForm((s) => !s)} style={{ marginRight: 8 }}>{showForm ? 'Cancel' : '+ Collect Evidence'}</button>
          <button onClick={load}>Refresh</button>
        </div>
      </header>
      <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 13 }}>
        Evidence is proof, not fact — freshness and provenance matter as much as confidence. Stale evidence corroborates less, even at the same stated confidence.
      </p>

      {showForm && (
        <form onSubmit={submit} style={{ padding: 16, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, marginBottom: 24, display: 'grid', gap: 8 }}>
          <input placeholder="Signal ID (optional)" value={form.signalId} onChange={(e) => setForm({ ...form, signalId: e.target.value })} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }} />
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}>
            <option value="internal">Internal</option>
            <option value="market_report">Market Report</option>
            <option value="competitor_data">Competitor Data</option>
            <option value="news">News</option>
            <option value="regulatory">Regulatory</option>
          </select>
          <textarea placeholder="What does this evidence show?" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required style={{ padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, minHeight: 60 }} />
          <label style={{ fontSize: 12, color: theme.textMuted }}>
            Confidence: {form.confidence}
            <input type="range" min="0" max="1" step="0.05" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} style={{ width: '100%' }} />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
        </form>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 16 }}>{error}</div>}
      {loading ? (
        <div>Loading evidence...</div>
      ) : evidence.length === 0 ? (
        <p style={{ color: theme.textMuted }}>No evidence collected yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Source</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Content</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Confidence</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Freshness</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>Signal</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: `1px solid ${theme.border}` }}>AI</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((e) => {
              const fresh = freshnessLabel(e.observedDate);
              return (
                <tr key={e.id}>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{e.source}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{String((e.content as any)?.note ?? JSON.stringify(e.content))}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>{Math.round(e.confidence * 100)}%</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, backgroundColor: `${freshnessColor[fresh]}20`, color: freshnessColor[fresh] }}>{fresh}</span>
                  </td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 12 }}>{e.signalId ?? '—'}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${theme.border}` }}>
                    <button onClick={() => summarizeWithAI(e)} disabled={summarizingId === e.id} style={{ fontSize: 11 }}>
                      {summarizingId === e.id ? 'Summarizing...' : '✦ Summarize'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
