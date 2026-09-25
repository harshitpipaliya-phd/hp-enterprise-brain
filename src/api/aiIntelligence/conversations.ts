/**
 * Client for Conversational AI — `/ai-intelligence/ask` and the transcript reads.
 *
 * Ported from G2G's lib/intelligence/ai-conversations.ts. The paths and shapes are
 * G2G's; the differences are HP Brain's: the organisation is `tenant_id` rather
 * than `sub_institute_id`, and every id is a UUID string.
 *
 * These endpoints resolve the provider through the central configuration and store
 * every turn as a row, so nothing an administrator configures under AI Providers is
 * bypassed and nothing the assistant says is lost on a restart.
 */

import { aiRequest } from './client';

export interface ConversationSummary {
  id: string;
  session_key: string;
  title: string | null;
  module_key: string | null;
  turn_count: number;
  status: string;
  last_turn_at: string | null;
  created_at: string | null;
}

export interface ConversationTurn {
  id: string;
  turn_index: number;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  /** Set when this turn failed. The transcript keeps it rather than hiding it. */
  error: string | null;
  created_at: string | null;
}

export interface AskResult {
  conversation_id: string;
  session_key: string;
  /** Null when the assistant could not answer — `error` then says why. */
  answer: string | null;
  /** False when the organisation has no figures, so the answer rests on nothing. */
  grounded?: boolean;
  truncated?: boolean;
  usage?: {
    provider: string;
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    finish_reason: string | null;
    truncated: boolean;
  };
  error?: string;
  /**
   * False means no credential is configured — a normal state with a known fix,
   * not a fault. The screen uses it to choose between "add a key" and "try again".
   */
  configured?: boolean;
}

/** One fact the assistant was given about this organisation. */
export interface GroundingFact {
  label: string;
  value: string;
}

export function askAssistant(input: {
  message: string;
  session_key?: string;
  module_key?: string | null;
}): Promise<AskResult> {
  return aiRequest<AskResult>('/ask', 'POST', input);
}

export function fetchGroundingContext(): Promise<{
  tenant_id: string;
  grounded: boolean;
  facts: GroundingFact[];
}> {
  return aiRequest('/grounding-context');
}

export function fetchConversations(): Promise<{
  tenant_id: string;
  conversations: ConversationSummary[];
}> {
  return aiRequest('/conversations');
}

export function fetchConversation(id: string): Promise<{
  conversation: ConversationSummary;
  turns: ConversationTurn[];
}> {
  return aiRequest(`/conversations/${encodeURIComponent(id)}`);
}
