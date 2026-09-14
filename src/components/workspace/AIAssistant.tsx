import { useEffect, useMemo, useState } from 'react';
import { HeaderActions, PageHeader } from '../../ui';
import type React from 'react';
import { Brain, History, MessageSquare, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../../api/intelligence';
import { graphApi } from '../../api/graph';
import { conversationApi } from '../../api/conversation';
import { aiApi } from '../../api/ai';
import { useTheme } from '../../hooks/useTheme';
import { contextPayload, type ScreenObject } from '../../utils/screenContext';

interface SearchResult {
  source: 'business' | 'graph';
  entityType: string;
  id: string;
  headline: string;
  record?: Record<string, unknown>;
}

interface Session {
  id: string;
  title: string;
  pinned: boolean;
  contextType: string | null;
  updatedDate: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdDate: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

interface AIExecution {
  id: string;
  serviceName: string;
  provider: string;
  model: string | null;
  status: 'success' | 'failed' | 'not_configured';
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  error: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdDate: string;
}

interface ProviderStatus { name: string; available: boolean }

type AssistantTab = 'context' | 'conversation' | 'operations';

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--status-good)',
  failed: 'var(--status-crit)',
  not_configured: 'var(--status-warn)',
};

/**
 * AI Assistant consolidates the previous Global Search, Copilot and AI
 * Workspace screens. It deliberately does not add a free-form answer surface:
 * questions are scoped to a selected result and persisted through the existing
 * conversation backend, while AI operation history remains read-only.
 */
export default function AIAssistant({ tenantId, context }: { tenantId: string; context?: ScreenObject | null }) {
  const theme = useTheme();
  const [tab, setTab] = useState<AssistantTab>('context');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [sessionQuery, setSessionQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [executions, setExecutions] = useState<AIExecution[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  /**
   * What this conversation is about: a result searched for HERE, or the object
   * the reader arrived from.
   *
   * WHY THIS IS ONE VALUE AND NOT TWO BRANCHES. Every scoped behaviour on this
   * screen — whether a conversation may be started, what it is titled, and the
   * `Context:` line each message carries — asked `selectedResult` directly, so
   * arriving from a person's profile left the New Conversation button DISABLED
   * and `send()` returning early. The context would have been threaded all the
   * way from PersonApp and then had nowhere to go.
   *
   * A searched result wins, because it is a choice the reader made on this
   * screen; the screen they came from is the fallback. Both produce the same
   * shape, so the three call sites below stay single-branch.
   */
  const scope = useMemo(
    () => (selectedResult
      ? { type: selectedResult.entityType, id: selectedResult.id }
      : context
        ? { type: context.objectType, id: context.objectId }
        : null),
    [selectedResult, context],
  );

  const selectedEvidence = useMemo(() => {
    if (!selectedResult) return [];
    if (selectedResult.entityType.toLowerCase() === 'evidence') return [selectedResult.id];

    const record = selectedResult.record ?? {};
    const direct = record.evidence_id ?? record.evidenceId ?? record.id;
    if (typeof direct === 'string' && selectedResult.entityType.toLowerCase().includes('evidence')) return [direct];
    return [];
  }, [selectedResult]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const [businessResults, graphResults] = await Promise.allSettled([
        api.search(tenantId, query),
        graphApi.search(tenantId, query),
      ]);

      const merged: SearchResult[] = [];
      if (businessResults.status === 'fulfilled') {
        for (const r of businessResults.value.results) {
          merged.push({
            source: 'business',
            entityType: r.entityType,
            id: r.id,
            headline: r.headline,
            record: r.record,
          });
        }
      }
      if (graphResults.status === 'fulfilled') {
        for (const r of graphResults.value.results) {
          const p = r.properties;
          merged.push({
            source: 'graph',
            entityType: r.labels[0],
            id: String(p.id),
            headline: String(p.title ?? p.name ?? p.statement ?? p.id),
            record: p,
          });
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
      setSelectedResult(deduped[0] ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const loadSessions = async () => {
    try {
      setSessions(sessionQuery.trim()
        ? await conversationApi.searchSessions(tenantId, sessionQuery)
        : await conversationApi.listSessions(tenantId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadPrompts = async () => {
    try { setPrompts(await conversationApi.listPromptTemplates(tenantId)); } catch (e: any) { setError(e.message); }
  };

  const loadOperations = async () => {
    setOperationsLoading(true);
    setError(null);
    try {
      const [providerData, executionData] = await Promise.all([aiApi.providers(), aiApi.executions(tenantId)]);
      setProviders(providerData.providers);
      setActiveProvider(providerData.active);
      setExecutions(executionData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setOperationsLoading(false);
    }
  };

  useEffect(() => { loadSessions(); loadPrompts(); loadOperations(); }, [tenantId]);
  useEffect(() => {
    const t = window.setTimeout(loadSessions, 300);
    return () => window.clearTimeout(t);
  }, [sessionQuery]);

  const openSession = async (s: Session) => {
    setActive(s);
    setTab('conversation');
    try { setMessages(await conversationApi.getMessages(tenantId, s.id)); } catch (e: any) { setError(e.message); }
  };

  /*
    OPEN A CONVERSATION, CARRYING THE SCREEN THE READER CAME FROM.

    `screen`, `objectId` and `objectType` are HINTS. The server resolves the
    object itself — by primary key AND tenant key, from the tenant in the
    verified token — and records it on the session only if it found a real row.
    An id from another organization comes back `object.present: false` and the
    conversation is created with no subject, so nothing here needs to be, or can
    be, trusted.

    WITH NO SCREEN CONTEXT THE REQUEST IS UNCHANGED. contextPayload() returns an
    empty object, so a conversation scoped by a searched result sends exactly the
    `{ tenantId, title }` body this app has always sent.

    The title names the scope, from whichever source supplied it.
  */
  const createSession = async () => {
    const title = scope ? `Context: ${scope.type} ${scope.id.slice(0, 8)}` : 'Context conversation';
    try {
      const s = await conversationApi.createSession({ tenantId, title, ...contextPayload(context) });
      await loadSessions();
      await openSession(s);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const send = async () => {
    // `scope` rather than `selectedResult`: a conversation opened from a
    // person's profile has a subject and no search result, and this returning
    // early was what made such a conversation unusable.
    if (!active || !draft.trim() || !scope) return;
    const scopedContent = [
      `Context: ${scope.type} ${scope.id}`,
      selectedEvidence.length ? `Evidence refs: ${selectedEvidence.join(', ')}` : 'Evidence refs: none displayed for this result',
      '',
      draft.trim(),
    ].join('\n');

    try {
      const result = await conversationApi.sendMessage(tenantId, active.id, scopedContent);
      setMessages((m) => [...m, result.message]);
      setDraft('');
      if (result.note) setError(result.note);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const togglePin = async (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    await conversationApi.setPinned(tenantId, s.id, !s.pinned);
    await loadSessions();
  };

  const startRename = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenaming(s.id);
    setRenameValue(s.title);
  };

  const commitRename = async (id: string) => {
    if (renameValue.trim()) await conversationApi.rename(tenantId, id, renameValue.trim());
    setRenaming(null);
    await loadSessions();
  };

  const remove = async (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${s.title}"?`)) return;
    await conversationApi.deleteSession(tenantId, s.id);
    if (active?.id === s.id) { setActive(null); setMessages([]); }
    await loadSessions();
  };

  const successCount = executions.filter((e) => e.status === 'success').length;
  const totalLatency = executions.filter((e) => e.latencyMs != null).reduce((s, e) => s + (e.latencyMs ?? 0), 0);
  const avgLatency = executions.length ? Math.round(totalLatency / executions.length) : 0;

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <PageHeader
        variant="list"
        icon={<Sparkles />}
        title="AI Assistant"
        description="Scoped to selected organization records. Select a result before asking; answers and actions are not generated outside that context."
        actions={(
          <HeaderActions>
            <button type="button" className="u-btn u-btn-secondary" onClick={loadOperations}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
          </HeaderActions>
        )}
      />

      {error && (
        <div style={{ padding: 10, borderRadius: 6, backgroundColor: 'var(--status-warn)20', color: 'var(--status-warn)', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <TabButton active={tab === 'context'} onClick={() => setTab('context')} icon={<Search size={14} />}>Context Search</TabButton>
        <TabButton active={tab === 'conversation'} onClick={() => setTab('conversation')} icon={<MessageSquare size={14} />}>Scoped Conversation</TabButton>
        <TabButton active={tab === 'operations'} onClick={() => setTab('operations')} icon={<History size={14} />}>AI Operations</TabButton>
      </div>

      {tab === 'context' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 16 }}>
          <section>
            {/*
              WHAT THE ASSISTANT WAS OPENED OVER, stated rather than implied.

              One line, in the tab that already exists, above the search that
              already exists. It is worth saying out loud because the reader
              cannot otherwise tell whether a conversation started here will
              carry the person they were just looking at — and a context the
              reader cannot see is a context they cannot correct.

              Absent when there is none: "no object" needs no banner.
            */}
            {context && (
              <div
                data-testid="assistant-screen-context"
                style={{
                  marginBottom: 12, padding: '8px 10px', borderRadius: 6,
                  border: `1px solid ${theme.border}`, backgroundColor: theme.surface,
                  color: theme.textMuted, fontSize: 12,
                }}
              >
                Opened from <strong style={{ color: theme.text }}>{context.objectType} {context.objectId}</strong>
                {' '}— a new conversation will resolve this object.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Find the screen object this question is about..."
                style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
              />
              <button onClick={search}>Search</button>
            </div>

            {searching && <div style={{ color: theme.textMuted }}>Searching...</div>}
            {!searching && results.length === 0 && query && <p style={{ color: theme.textMuted }}>No results.</p>}

            <div style={{ display: 'grid', gap: 8 }}>
              {results.map((r) => (
                <button
                  key={`${r.source}-${r.entityType}-${r.id}`}
                  type="button"
                  onClick={() => setSelectedResult(r)}
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${selectedResult?.id === r.id && selectedResult?.entityType === r.entityType ? 'var(--action-primary)' : theme.border}`,
                    backgroundColor: selectedResult?.id === r.id && selectedResult?.entityType === r.entityType ? 'var(--surface-card)' : 'transparent',
                    color: theme.text,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>
                    {r.entityType} · {r.source === 'business' ? 'business record' : 'knowledge graph'}
                  </span>
                  <div>{r.headline}</div>
                </button>
              ))}
            </div>
          </section>

          <ContextPanel theme={theme} selectedResult={selectedResult} selectedEvidence={selectedEvidence} onOpenConversation={() => setTab('conversation')} />
        </div>
      )}

      {tab === 'conversation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
          <aside>
            {/* Enabled by EITHER scope — see the `scope` note above. Without
                the second source this button stayed disabled for a reader who
                arrived from the very object they wanted to ask about. */}
            <button onClick={createSession} disabled={!scope} style={{ width: '100%', marginBottom: 12 }}>
              + New Context Conversation
            </button>
            <input
              placeholder="Search conversations..."
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text, marginBottom: 12, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'grid', gap: 4 }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => openSession(s)}
                  style={{ padding: 8, borderRadius: 6, cursor: 'pointer', backgroundColor: active?.id === s.id ? theme.surface : 'transparent', border: `1px solid ${active?.id === s.id ? theme.border : 'transparent'}` }}
                >
                  {renaming === s.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={(e) => e.key === 'Enter' && commitRename(s.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '100%', padding: 4, borderRadius: 4, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}
                    />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{s.pinned ? 'Pinned: ' : ''}{s.title}</span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button onClick={(e) => togglePin(s, e)} title="Pin" style={{ fontSize: 11 }}>{s.pinned ? 'Unpin' : 'Pin'}</button>
                        <button onClick={(e) => startRename(s, e)} title="Rename" style={{ fontSize: 11 }}>Rename</button>
                        <button onClick={(e) => remove(s, e)} title="Delete" style={{ fontSize: 11 }}>Delete</button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: 14 }}>Prompt Library</h3>
            <div style={{ display: 'grid', gap: 4 }}>
              {prompts.length === 0 ? (
                <p style={{ color: theme.textMuted, fontSize: 12 }}>No saved prompts yet.</p>
              ) : prompts.map((p) => (
                <button key={p.id} onClick={() => setDraft(p.template)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 12, textAlign: 'left', background: 'transparent', color: theme.text }}>
                  {p.name}
                </button>
              ))}
            </div>
          </aside>

          <section>
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <ShieldCheck size={16} aria-hidden="true" />
                <strong>Current scope</strong>
              </div>
              {selectedResult ? (
                <p style={{ margin: '6px 0 0', color: theme.textMuted, fontSize: 13 }}>
                  {selectedResult.entityType} {selectedResult.id}. {selectedEvidence.length ? `Cites evidence ${selectedEvidence.join(', ')}.` : 'No evidence citation is displayed for this selected result.'}
                </p>
              ) : (
                <p style={{ margin: '6px 0 0', color: theme.textMuted, fontSize: 13 }}>Select a result in Context Search before starting or sending a conversation.</p>
              )}
            </div>

            {!active ? (
              <p style={{ color: theme.textMuted }}>Select or start a context conversation.</p>
            ) : (
              <>
                <div style={{ minHeight: 300, marginBottom: 12, display: 'grid', gap: 8, alignContent: 'start' }}>
                  {messages.length === 0 ? (
                    <p style={{ color: theme.textMuted }}>No messages yet. This surface stores scoped questions; it does not fabricate broad answers.</p>
                  ) : messages.map((m) => (
                    <div key={m.id} style={{
                      padding: 10,
                      borderRadius: 8,
                      maxWidth: '75%',
                      justifySelf: m.role === 'user' ? 'end' : 'start',
                      backgroundColor: m.role === 'user' ? 'var(--chart-1)20' : theme.surface,
                      border: `1px solid ${theme.border}`,
                    }}>
                      <div style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>{m.role}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Ask only about the selected context..."
                    disabled={!selectedResult}
                    style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
                  />
                  <button onClick={send} disabled={!selectedResult}>Send</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'operations' && (
        <section>
          <p style={{ color: theme.textMuted, marginTop: 0, fontSize: 13 }}>
            Active provider: <strong style={{ color: theme.text }}>{activeProvider}</strong>. Switch via the AI_PROVIDER environment variable.
          </p>
          <h3>Provider Status</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
            {providers.map((p) => (
              <div key={p.name} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${p.available ? 'var(--status-good)' : theme.border}` }}>
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: p.available ? 'var(--status-good)' : theme.textMuted }}>{p.available ? 'Configured' : 'Not configured'}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Stat theme={theme} label="Total Executions" value={String(executions.length)} />
            <Stat theme={theme} label="Successful" value={String(successCount)} />
            <Stat theme={theme} label="Avg Latency" value={`${avgLatency}ms`} />
          </div>

          <h3>Execution History</h3>
          {operationsLoading ? (
            <div>Loading...</div>
          ) : executions.length === 0 ? (
            <p style={{ color: theme.textMuted }}>No AI executions yet. Try Summarize on the Evidence Workspace.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {executions.map((e) => (
                <div key={e.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${STATUS_COLOR[e.status]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                    <span><strong>{e.serviceName}</strong> <span style={{ color: theme.textMuted }}>via {e.provider}{e.model ? ` (${e.model})` : ''}</span></span>
                    <span style={{ fontSize: 11, color: STATUS_COLOR[e.status] }}>{e.status}</span>
                  </div>
                  {e.error && <div style={{ fontSize: 11, color: 'var(--status-crit)', marginTop: 4 }}>{e.error}</div>}
                  <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>
                    {e.entityType && e.entityId ? `${e.entityType} ${e.entityId} · ` : ''}
                    {e.inputTokens != null && `${e.inputTokens + (e.outputTokens ?? 0)} tokens · `}
                    {e.latencyMs != null && `${e.latencyMs}ms · `}
                    {new Date(e.createdDate).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--action-primary)' : 'var(--border-default)'}`,
        backgroundColor: active ? 'var(--surface-card)' : 'transparent',
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function ContextPanel({
  theme, selectedResult, selectedEvidence, onOpenConversation,
}: {
  theme: ReturnType<typeof useTheme>;
  selectedResult: SearchResult | null;
  selectedEvidence: string[];
  onOpenConversation: () => void;
}) {
  return (
    <aside style={{ padding: 14, borderRadius: 8, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, alignSelf: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Brain size={16} aria-hidden="true" />
        <strong>Assistant Scope</strong>
      </div>
      {!selectedResult ? (
        <p style={{ color: theme.textMuted, fontSize: 13 }}>Choose a search result to define what the assistant may discuss.</p>
      ) : (
        <>
          <div style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>
            {selectedResult.entityType} · {selectedResult.source === 'business' ? 'business record' : 'knowledge graph'}
          </div>
          <div style={{ marginBottom: 8 }}>{selectedResult.headline}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12, overflowWrap: 'anywhere' }}>
            ID: {selectedResult.id}
          </div>
          <div style={{ padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: 'var(--surface-ground)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase' }}>Evidence citations available</div>
            <div style={{ marginTop: 4 }}>{selectedEvidence.length ? selectedEvidence.join(', ') : 'None displayed by this result'}</div>
          </div>
          <button onClick={onOpenConversation} style={{ width: '100%' }}>Ask About This Context</button>
        </>
      )}
    </aside>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.textMuted }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>{value}</div>
    </div>
  );
}
