/**
 * Conversational AI — the assistant, its grounding, and its transcripts.
 *
 * Ported from G2G's app/ai/conversational-ai/page.tsx. Same sections, copy and
 * flow; HP Brain's primitives and the console's aii- layout in place of Tailwind,
 * and `go('providers')` in place of a Next link.
 *
 * WHY THE GROUNDING PANEL IS THE FIRST THING ON THE SCREEN
 *
 * "This assistant is grounded in your data" is a claim, and an administrator has no
 * way to check it from a chat window — a wrong answer looks the same whether the
 * model was given bad figures or none at all. The panel shows exactly what the
 * assistant was told, so a wrong answer becomes diagnosable: either the figure it
 * used is listed here and the model misread it, or it is not listed and the model
 * should have refused.
 *
 * WHY FAILED TURNS ARE RENDERED
 *
 * A transcript that quietly drops the turns that failed shows a person asking three
 * questions and receiving two answers, with nothing to say the third ever happened.
 * The API returns the error on the turn, and this screen shows it in place.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Send, Sparkles } from 'lucide-react';

import {
  askAssistant,
  fetchConversation,
  fetchConversations,
  fetchGroundingContext,
  type ConversationSummary,
  type ConversationTurn,
  type GroundingFact,
} from '../../../api/aiIntelligence/conversations';
import { describeAiError } from '../../../api/aiIntelligence/client';
import { Alert, Button, TextInput } from '../../../ui';
import { CapabilityShell } from '../CapabilityShell';
import { LoadingLine, Notice, formatWhen } from '../console-ui';
import { useConsoleNav } from '../consoleNav';
import './aiScreens.css';

export default function ConversationalScreen() {
  return (
    <CapabilityShell slug="conversational-ai">
      <ConversationalConsole />
    </CapabilityShell>
  );
}

function ConversationalConsole() {
  const { go } = useConsoleNav();
  const inputId = React.useId();

  const [facts, setFacts] = React.useState<GroundingFact[] | null>(null);
  const [grounded, setGrounded] = React.useState<boolean | null>(null);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [turns, setTurns] = React.useState<ConversationTurn[]>([]);

  const [message, setMessage] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [error, setError] = React.useState('');
  /** Set when the failure is "no credential" rather than "the provider broke". */
  const [needsCredential, setNeedsCredential] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);
  /**
   * What a screen reader hears when an answer lands. A separate region rather than
   * making the transcript live: the transcript is re-read from the server after
   * every question, and a live transcript would re-announce the whole conversation.
   */
  const [announcement, setAnnouncement] = React.useState('');

  /*
   * The session key is generated once and kept in a ref.
   *
   * A ref rather than state because it must NOT change: every question carries it,
   * and a new key opens a new conversation — which is how a chat loses its memory
   * with nothing appearing to be wrong.
   *
   * Generated inside `ensureSessionKey` rather than during render. `crypto.randomUUID()`
   * is impure and writing a ref while rendering is not allowed, so doing it here
   * tripped two React rules at once — and both were right: a render that assigns a
   * ref can run twice in development and produce two different keys.
   */
  const sessionKey = React.useRef<string | null>(null);

  /** Called from the submit handler, where a side effect is legitimate. */
  const ensureSessionKey = React.useCallback(() => {
    sessionKey.current ??=
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return sessionKey.current;
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([fetchGroundingContext(), fetchConversations()])
      .then(([context, list]) => {
        if (cancelled) return;
        setFacts(context.facts);
        setGrounded(context.grounded);
        setConversations(list.conversations);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  React.useEffect(() => {
    if (selected === null) return;

    let cancelled = false;

    fetchConversation(selected)
      .then((data) => {
        if (!cancelled) setTurns(data.turns);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [selected, reloadToken]);

  const reload = React.useCallback(() => setReloadToken((token) => token + 1), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const text = message.trim();
    if (text === '' || asking) return;

    setAsking(true);
    setError('');
    setNeedsCredential(false);
    setAnnouncement('');

    // Shown immediately, before the round trip. A chat that swallows the question
    // until the answer arrives reads as though the send button did nothing.
    setTurns((current) => [
      ...current,
      {
        id: `pending-${Date.now()}`,
        turn_index: current.length + 1,
        role: 'user',
        content: text,
        provider: null,
        model: null,
        input_tokens: null,
        output_tokens: null,
        latency_ms: null,
        error: null,
        created_at: null,
      },
    ]);
    setMessage('');

    try {
      const result = await askAssistant({ message: text, session_key: ensureSessionKey() });

      if (result.answer === null) {
        setError(result.error ?? 'The assistant could not answer.');
        setNeedsCredential(result.configured === false);
        setAnnouncement(`No answer. ${result.error ?? 'The assistant could not answer.'}`);
      } else {
        setAnnouncement(`Assistant: ${result.answer}`);
      }

      // Re-read from the server rather than appending the answer locally: the
      // transcript is the record, and a screen built from optimistic appends drifts
      // from it the first time a turn fails.
      setSelected(result.conversation_id);
      reload();
    } catch (cause) {
      setError(describeAiError(cause));
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="aiw-section" aria-labelledby={`${inputId}-heading`}>
      <header className="aiw-section-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="aiw-h2" id={`${inputId}-heading`}>Assistant</h2>
          <p className="aiw-desc">
            Answers questions about this organisation from the figures below. It has no access to
            any individual person&rsquo;s record.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={reload} icon={<RefreshCw size={14} aria-hidden="true" />}>
          Refresh
        </Button>
      </header>

      <GroundingPanel facts={facts} grounded={grounded} />

      {error && (
        <Alert tone="danger">
          {error}
          {needsCredential && (
            <>
              {' '}
              <button type="button" className="aii-link" onClick={() => go('providers')}>
                Add a credential under AI Providers
              </button>
            </>
          )}
        </Alert>
      )}

      <p className="u-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div className="aiw-chat-layout">
        <div className="aiw-chat-box">
          <div className="aiw-chat-scroll">
            {turns.length === 0 ? (
              <p className="aiw-chat-empty">
                Ask something to start. Try &ldquo;how many signals are open?&rdquo;
              </p>
            ) : (
              <ul className="aii-chat" aria-label="Transcript" tabIndex={0}>
                {turns.map((turn) => (
                  <TurnBubble key={turn.id} turn={turn} />
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={submit} className="aiw-chat-form">
            <label htmlFor={inputId} className="u-sr-only">Ask the assistant</label>
            <div className="aiw-grow">
              <TextInput
                id={inputId}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask about signals, evidence, decisions, departments…"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              loading={asking}
              disabled={message.trim() === ''}
              icon={<Send size={16} aria-hidden="true" />}
            >
              Ask
            </Button>
          </form>
        </div>

        <ConversationList
          conversations={conversations}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            // Opening a transcript continues it: the next question carries that
            // conversation's key, so it lands in the thread on screen rather than
            // in this tab's own and the view jumping away from what was opened.
            const opened = conversations.find((c) => c.id === id);
            if (opened?.session_key) sessionKey.current = opened.session_key;
          }}
        />
      </div>
    </section>
  );
}

/** What the assistant was told. See the file note for why this leads. */
function GroundingPanel({ facts, grounded }: { facts: GroundingFact[] | null; grounded: boolean | null }) {
  if (facts === null) {
    return <LoadingLine>Loading grounding context…</LoadingLine>;
  }

  if (grounded === false || facts.length === 0) {
    return (
      <Notice icon="database">
        No figures could be read for this organisation, so the assistant has nothing to ground an
        answer in. It will answer questions about how the platform works and say when it would
        need data it does not have.
      </Notice>
    );
  }

  return (
    <div className="aiw-panel">
      <h3 className="aiw-h3 aiw-title-icon">
        <Sparkles size={14} aria-hidden="true" />
        What the assistant knows about this organisation
      </h3>
      <p className="aiw-caption">
        These figures are read live and sent with every question. Counts and taxonomy only — never
        an individual&rsquo;s record.
      </p>
      <dl className="aiw-facts">
        {facts.map((fact) => (
          <div key={fact.label} className="aiw-fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user';

  if (turn.error) {
    return (
      <li className="aii-bubble aii-bubble--error">
        <p className="aiw-bubble-title">
          <AlertTriangle size={14} aria-hidden="true" />
          No answer
        </p>
        <p className="aiw-bubble-sub">{turn.error}</p>
      </li>
    );
  }

  return (
    <li className={`aii-bubble ${isUser ? 'aii-bubble--user' : 'aii-bubble--assistant'}`}>
      <span className="u-sr-only">{isUser ? 'You: ' : 'Assistant: '}</span>
      {turn.content}
      {/* Which model answered and what it cost, on the turn rather than the
          conversation — a model can be reconfigured mid-conversation. */}
      {!isUser && turn.model && (
        <p className="aii-bubble-meta">
          {turn.model}
          {turn.output_tokens !== null && ` · ${turn.output_tokens} tokens`}
          {turn.latency_ms !== null && ` · ${turn.latency_ms}ms`}
        </p>
      )}
    </li>
  );
}

function ConversationList({
  conversations,
  selected,
  onSelect,
}: {
  conversations: ConversationSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="aii-card aii-card--flush" style={{ alignSelf: 'start' }}>
      <div className="aii-card-head">
        <h3 className="aii-card-title">Conversations</h3>
      </div>
      {conversations.length === 0 ? (
        <p className="aii-card-body aii-small aii-muted" style={{ margin: 0 }}>
          Nothing yet. Transcripts are stored, so they survive a restart.
        </p>
      ) : (
        <ul className="aiw-list" style={{ border: 0, borderRadius: 0, maxHeight: '24rem', overflowY: 'auto' }}>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className="aiw-list-btn"
                aria-current={selected === conversation.id ? 'true' : undefined}
                onClick={() => onSelect(conversation.id)}
              >
                <span className="aiw-list-body">
                  <span className="aiw-list-title aiw-list-title--sm" style={{ display: 'block' }}>
                    {conversation.title ?? `Conversation ${conversation.id.slice(0, 8)}`}
                  </span>
                  <span className="aiw-meta" style={{ display: 'block' }}>
                    {conversation.turn_count} turns
                    {conversation.last_turn_at && ` · ${formatWhen(conversation.last_turn_at)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
