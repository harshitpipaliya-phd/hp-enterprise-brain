import React from 'react';
import {
  createWorkspaceSession,
  getSessionMessages,
  sendMessage as sendWorkspaceMessage,
} from '../../api/aiWorkspace';

/**
 * Minimal AI Workspace conversation surface.
 *
 * GOES THROUGH THE api/ MODULES, NOT RAW fetch(). The first version called
 * fetch('/api/v1/...') directly, which sent no Authorization header — so every
 * request 401'd — and hardcoded a same-origin path, ignoring VITE_API_URL. Both
 * concerns are handled once in api/client.ts; nothing here should reimplement
 * them.
 *
 * A session is created on the first message and reused afterwards. The earlier
 * version opened a new session per message, so the thread on screen was never
 * the thread on the server.
 */
export const AiWorkspace: React.FC<{ tenantId: string; userId: string }> = ({ tenantId }) => {
  const [messages, setMessages] = React.useState<any[]>([]);
  const [input, setInput] = React.useState('');
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadMessages = React.useCallback(
    async (id: string) => {
      setMessages(await getSessionMessages(tenantId, id));
    },
    [tenantId],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setError(null);

    try {
      let id = sessionId;
      if (!id) {
        const session = await createWorkspaceSession(tenantId, text.slice(0, 50));
        id = session.id as string;
        setSessionId(id);
      }

      await sendWorkspaceMessage(tenantId, id, text);
      setInput('');
      await loadMessages(id);
    } catch (e: any) {
      // Surfaced rather than swallowed: a failed send that still clears the
      // input looks exactly like a successful one.
      setError(e?.message ?? 'Failed to send message');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
            <span className="inline-block rounded bg-gray-100 p-2">{msg.content}</span>
          </div>
        ))}
      </div>
      {error && (
        <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="border-t p-4">
        <input
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          className="w-full rounded border p-2"
          placeholder="Ask a question..."
        />
      </div>
    </div>
  );
};
