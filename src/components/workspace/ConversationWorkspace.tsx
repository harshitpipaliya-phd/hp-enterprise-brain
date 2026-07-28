import { useState, useEffect } from 'react';
import { conversationApi } from '../../api/conversation';
import { useTheme } from '../../hooks/useTheme';

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

/**
 * Conversation Workspace. Real: session list, pin/rename/delete, search,
 * message history, Prompt Library. NOT real yet: sending a message never
 * gets an assistant reply — that's the LLM vendor decision this project
 * has been waiting on. The UI says so directly rather than hiding behind a
 * spinner that never resolves.
 */
export default function ConversationWorkspace({ tenantId }: { tenantId: string }) {
  const theme = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadSessions = async () => {
    try {
      setSessions(searchQuery.trim() ? await conversationApi.searchSessions(tenantId, searchQuery) : await conversationApi.listSessions(tenantId));
    } catch (e: any) { setError(e.message); }
  };

  const loadPrompts = async () => {
    try { setPrompts(await conversationApi.listPromptTemplates(tenantId)); } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { loadSessions(); loadPrompts(); }, [tenantId]);
  useEffect(() => { const t = setTimeout(loadSessions, 300); return () => clearTimeout(t); }, [searchQuery]);

  const openSession = async (s: Session) => {
    setActive(s);
    try { setMessages(await conversationApi.getMessages(tenantId, s.id)); } catch (e: any) { setError(e.message); }
  };

  const createSession = async () => {
    try {
      const s = await conversationApi.createSession({ tenantId, title: 'New conversation' });
      await loadSessions();
      openSession(s);
    } catch (e: any) { setError(e.message); }
  };

  const send = async () => {
    if (!active || !draft.trim()) return;
    try {
      const result = await conversationApi.sendMessage(tenantId, active.id, draft);
      setMessages((m) => [...m, result.message]);
      setDraft('');
      if (result.note) setError(result.note);
    } catch (e: any) { setError(e.message); }
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24, backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 16 }}>Enterprise Copilot</h1>
      {error && (
        <div style={{ padding: 10, borderRadius: 6, backgroundColor: '#f59e0b20', color: '#f59e0b', marginBottom: 16, fontSize: 13 }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        <div>
          <button onClick={createSession} style={{ width: '100%', marginBottom: 12 }}>+ New Conversation</button>
          <input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                    autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(s.id)} onKeyDown={(e) => e.key === 'Enter' && commitRename(s.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', padding: 4, borderRadius: 4, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text }}
                  />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13 }}>{s.pinned ? '📌 ' : ''}{s.title}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button onClick={(e) => togglePin(s, e)} title="Pin" style={{ fontSize: 11 }}>{s.pinned ? 'Unpin' : 'Pin'}</button>
                      <button onClick={(e) => startRename(s, e)} title="Rename" style={{ fontSize: 11 }}>✎</button>
                      <button onClick={(e) => remove(s, e)} title="Delete" style={{ fontSize: 11 }}>✕</button>
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
              <div key={p.id} onClick={() => setDraft(p.template)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${theme.border}`, cursor: 'pointer', fontSize: 12 }}>
                {p.name}
              </div>
            ))}
          </div>
        </div>

        <div>
          {!active ? (
            <p style={{ color: theme.textMuted }}>Select or start a conversation.</p>
          ) : (
            <>
              <div style={{ minHeight: 300, marginBottom: 12, display: 'grid', gap: 8, alignContent: 'start' }}>
                {messages.length === 0 ? (
                  <p style={{ color: theme.textMuted }}>No messages yet — send the first one below.</p>
                ) : messages.map((m) => (
                  <div key={m.id} style={{
                    padding: 10, borderRadius: 8, maxWidth: '75%',
                    alignSelf: m.role === 'user' ? 'end' : 'start',
                    backgroundColor: m.role === 'user' ? '#3b82f620' : theme.surface,
                    border: `1px solid ${theme.border}`,
                  }}>
                    <div style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase' }}>{m.role}</div>
                    <div>{m.content}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ask the Enterprise Brain..."
                  style={{ flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${theme.border}`, backgroundColor: theme.surface, color: theme.text }}
                />
                <button onClick={send}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
