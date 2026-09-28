
/**
 * Client for one module's own AI usage and guardrails — `/api/ai/modules/{key}/*`.
 *
 * Shaped like `ai-policies.ts` and `ai-templates.ts` on purpose: same session read,
 * same envelope handling, same "the institute is never a parameter" rule. The module
 * key is the only thing a caller names, and it cannot widen access — the backend
 * derives the tenant from the bearer token and at worst the key matches no rows.
 *
 * WHY THE TYPES ADMIT ABSENCE EVERYWHERE
 *
 * Because the backend does. A count is a number; a cost is `number | null` with a
 * `cost_reason` beside it, and a section can come back `available: false` naming the
 * table this estate has not migrated. A screen built on types that promised figures
 * would have to invent them, which is the one thing these screens must not do.
 */

import { aiRequest } from '../aiIntelligence/client';

export interface AiModuleIdentity {
  key: string;
  label: string;
  /** False when the module has no `ai_modules` row — nothing can route its AI yet. */
  registered: boolean;
  status?: number;
  scope?: 'platform' | 'institute';
  /** conversational | generative | agent | workflow | ontology → on or off. */
  capabilities: Record<string, boolean>;
}

/** A section the estate cannot answer, and which table is missing. */
interface Unavailable {
  available: false;
  reason: string;
}

export interface AiModuleTurnDetail {
  available: boolean;
  total?: number;
  avg_duration_ms?: number | null;
  max_duration_ms?: number | null;
  by_status?: Record<string, number>;
  by_intent?: Array<{ intent: string; count: number }>;
}

export type AiModuleConversations =
  | Unavailable
  | {
      available: true;
      total: number;
      turns_recorded_on_conversation: number;
      distinct_users: number;
      first_activity: string | null;
      last_activity: string | null;
      by_status: Record<string, number>;
      turn_detail: AiModuleTurnDetail;
    };

export interface AiModuleRate {
  provider: string;
  model_id: string;
  label: string;
  /** Null when no price is published for the model. Cost then stays null too. */
  input_per_1k: number | null;
  output_per_1k: number | null;
}

export interface AiModuleTokens {
  outputs: number;
  /** Null: no metered call carries a "reviewed by a person" flag. Never a count of zero. */
  reviewed: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  avg_latency_ms: number | null;
  rate: AiModuleRate | null;
  cost: number | null;
  /** `recorded` came from the output rows, `computed` from tokens × rate. */
  cost_source: 'recorded' | 'computed' | 'unavailable';
  /** Why there is no money figure. Shown verbatim rather than paraphrased. */
  cost_reason: string | null;
}

export type AiModuleGeneration =
  | Unavailable
  | {
      available: true;
      total: number;
      by_status: Record<string, number>;
      tokens: AiModuleTokens;
    };

export type AiModuleReports =
  | Unavailable
  | {
      available: true;
      total: number;
      rows_reported: number;
      last_created: string | null;
      by_tool: Array<{ tool: string; count: number }>;
    };

export type AiModuleProvider =
  | Unavailable
  | {
      available: true;
      /** False when the module shares an unbound credential with every other module. */
      bound: boolean;
      provider: string | null;
      model: string | null;
      daily_limit: number | null;
      scope: 'platform' | 'institute' | null;
      daily_calls: Array<{ date: string; count: number }> | null;
    };

export interface AiModuleTurn {
  id: string;
  question: string;
  intent: string | null;
  confidence: number | null;
  status: string;
  duration_ms: number | null;
  user_id: string | null;
  conversation: string;
  created_at: string | null;
}

export interface AiModuleUsage {
  module: AiModuleIdentity;
  conversations: AiModuleConversations;
  generation: AiModuleGeneration;
  reports: AiModuleReports;
  provider: AiModuleProvider;
  recent_turns: AiModuleTurn[];
  daily: Array<{ date: string; turns: number }>;
}

export type AiModuleReview =
  | Unavailable
  | {
      available: true;
      templates: number;
      published: number;
      requires_review: number;
      allowed_as_evidence: number;
    };

/** One request a rule refused, with the verdict and the reason recorded. */
export interface AiModuleRefusal {
  id: string;
  reference: string;
  template_key: string | null;
  purpose: string | null;
  status: string;
  reason: string | null;
  provider: string | null;
  model: string | null;
  requested_by: string | null;
  requested_by_role: string | null;
  created_at: string | null;
}

/** Totals over EVERY refused/failed call from this module — not just the recent list below. */
export interface AiModuleRefusalTotals {
  refused: number;
  failed: number;
  total: number;
}

export interface AiModuleGuardrails {
  module: AiModuleIdentity;
  capabilities: Record<string, boolean>;
  review: AiModuleReview;
  refusals: AiModuleRefusal[];
  refusal_counts: Array<{ status: string; count: number }>;
  /** Null only when this deployment cannot attribute a call to a module at all. */
  refusal_totals: AiModuleRefusalTotals | null;
}

/**
 * G2G PORT: the transport below is G2G's `aiRequest` (Sanctum token, G2G envelope
 * handling, the AI base URL). Everything else — every type, every exported function and
 * its signature — is LMS_K12's `lib/intelligence/ai-module.ts` unchanged, because the
 * screens that import it are LMS_K12's shared AI Stack screens, unchanged. The backend
 * answering these paths is hp_erp's AiModuleController / AiModuleModelController.
 */
async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  return aiRequest<T>(path, (init.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE', init.body);
}

export function fetchModuleUsage(moduleKey: string): Promise<AiModuleUsage> {
  return call<AiModuleUsage>(`/modules/${encodeURIComponent(moduleKey)}/usage`);
}

export function fetchModuleGuardrails(moduleKey: string): Promise<AiModuleGuardrails> {
  return call<AiModuleGuardrails>(`/modules/${encodeURIComponent(moduleKey)}/guardrails`);
}

// ---------------------------------------------------------------------------
// Activity — the execution ledger
// ---------------------------------------------------------------------------

/**
 * The AI Stack records one operation used.
 *
 * Every slot is optional and each is a real configured record: a template or prompt
 * resolved by the backend out of `ai_templates` (and refused outright if it belongs to
 * another module), an agent as the Agent Management engine issued it. An operation that
 * used no template reports none — a ledger row saying "no template" is worth more than
 * one that names a plausible file.
 */
export interface AiModuleActivityArtifact {
  id: string;
  key: string;
  name: string;
  kind: string;
  version: number;
  status: string;
}

export interface AiModuleActivityUsed {
  template?: AiModuleActivityArtifact;
  prompt?: AiModuleActivityArtifact;
  agent?: { id: string | null; name: string | null; run_id: string | null; source: string };
  workflow?: string;
  tool?: string;
}

export type AiModuleActivityStatus = 'completed' | 'failed' | 'denied' | 'skipped';

export interface AiModuleActivityEntry {
  id: string;
  operation: string;
  operation_label: string | null;
  capability: string | null;
  status: AiModuleActivityStatus;
  outcome: string | null;
  message: string | null;
  actor_id: string | null;
  actor_label: string | null;
  subject_entity_key: string | null;
  subject_id: string | null;
  subject_label: string | null;
  reference: string | null;
  used: AiModuleActivityUsed;
  result: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AiModuleActivity {
  module: AiModuleIdentity;
  available: boolean;
  reason?: string;
  total: number;
  entries: AiModuleActivityEntry[];
  by_operation: Array<{ operation: string; outcome: string; count: number }>;
}

/** What a module screen reports after it has finished doing something. */
export interface RecordModuleActivityInput {
  /** Stable slug for the operation, e.g. `fee_collection`. */
  operation: string;
  operation_label?: string;
  /** The `ai_modules` capability this leaned on: generative, agent, conversational… */
  capability?: string | null;
  status: AiModuleActivityStatus;
  message?: string;
  subject_entity_key?: string | null;
  subject_id?: string | null;
  subject_label?: string | null;
  reference?: string | null;
  template_id?: string | null;
  prompt_id?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_run_id?: string | null;
  workflow?: string | null;
  tool?: string | null;
  result?: Record<string, unknown> | null;
}

export function fetchModuleActivity(
  moduleKey: string,
  filter: { operation?: string; outcome?: string; subjectId?: number; limit?: number } = {},
): Promise<AiModuleActivity> {
  const params = new URLSearchParams();
  if (filter.operation) params.set('operation', filter.operation);
  if (filter.outcome) params.set('outcome', filter.outcome);
  if (filter.subjectId) params.set('subject_id', String(filter.subjectId));
  if (filter.limit) params.set('limit', String(filter.limit));
  const query = params.toString();

  return call<AiModuleActivity>(`/modules/${encodeURIComponent(moduleKey)}/activity${query ? `?${query}` : ''}`);
}

/**
 * Write one entry into the module's ledger.
 *
 * Deliberately returns rather than throws on a failed write — see
 * `recordModuleActivitySafely`, which is what module screens actually call.
 */
export function recordModuleActivity(
  moduleKey: string,
  input: RecordModuleActivityInput,
): Promise<{ recorded: boolean; id: string | null }> {
  // Undefined keys are stripped so an omitted field is genuinely omitted rather than
  // arriving as null and tripping a `nullable|integer` rule on something it shouldn't.
  const body = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

  return call<{ recorded: boolean; id: string | null }>(
    `/modules/${encodeURIComponent(moduleKey)}/activity`,
    { method: 'POST', body },
  );
}

/**
 * Record an entry, and never let the recording break the thing being recorded.
 *
 * THIS IS THE ONE MODULE SCREENS SHOULD CALL. A fee has been collected and a receipt
 * issued by the time this runs; if the ledger write fails — offline, token expired,
 * table locked — the correct behaviour is a console warning and a returned `false`, not
 * an error thrown into a component that has already succeeded at its actual job. Losing
 * a ledger line is bad. Showing a parent an error after taking their money is worse.
 */
export async function recordModuleActivitySafely(
  moduleKey: string,
  input: RecordModuleActivityInput,
): Promise<boolean> {
  try {
    const result = await recordModuleActivity(moduleKey, input);
    return result.recorded;
  } catch (cause) {
    console.warn(`[ai-activity] ${moduleKey}.${input.operation} was not recorded:`, cause);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Models — this module's own choice, managed inside this module
// ---------------------------------------------------------------------------

/**
 * WHY THESE LIVE HERE AND NOT IN `ai-configuration.ts`
 *
 * That client talks to the central console under AI & Intelligence, which configures AI
 * CAPABILITIES for the whole estate and writes `ai_api_keys` and `ai_models`.
 *
 * These talk to `/api/ai/modules/{key}/models`, which configures ONE PRODUCT MODULE and
 * writes `ai_module_model_bindings`. The two never touch the same row, and nothing here
 * links to the other: the AI Stack inside a module is decentralised, so choosing a model
 * in Fees is something you finish in Fees.
 *
 * A save is not a screen preference. `AiConfigurationResolver` consults these bindings
 * ahead of the central configuration and the three places that build a model client pass
 * the product module through, so it changes what this module's next call runs on.
 */

/** What this module's next call of one kind would actually use. */
export interface AiModuleEffectiveModel {
  provider: string;
  provider_label: string;
  model: string | null;
  /**
   * How it was decided, in the resolver's own vocabulary. `module_binding` and
   * `module_binding_platform` mean this module's own choice won; anything else means it
   * is inheriting what the rest of the estate uses.
   */
  source: string;
  scope: string;
  has_credential: boolean;
  max_output_tokens: number | null;
}

/** This module's own saved choice, when it has made one. */
export interface AiModuleBinding {
  provider: string | null;
  model: string | null;
  api_key_id: string | null;
  max_output_tokens: number | null;
  scope: 'platform' | 'institute';
  /**
   * False for a platform row: it is the estate's default for this module, and a school
   * overrides it rather than edits it.
   */
  editable: boolean;
  updated_at: string | null;
}

export interface AiModuleModelRow {
  /** The AI capability — `conversational_ai`, `generative_ai`, `agent_reasoning`. */
  capability: string;
  label: string;
  description: string;
  /**
   * False means the platform still reaches its provider its own way for this capability,
   * so a choice is stored but not yet read. Said plainly rather than implying a binding
   * that does not exist.
   */
  wired: boolean;
  binding: AiModuleBinding | null;
  effective: AiModuleEffectiveModel;
}

export interface AiModuleModelOption {
  key: string;
  label: string;
  max_output_tokens: number | null;
  scope: string;
}

export interface AiModuleProviderOption {
  key: string;
  label: string;
  default_model: string | null;
  models: AiModuleModelOption[];
}

export interface AiModuleCredentialOption {
  id: string;
  provider: string;
  /** The AI capability this credential is for — a row is only pickable for its OWN capability. */
  capability: string;
  label: string;
  daily_limit: number | null;
  scope: string;
  /** 0 = disabled. A disabled credential is listed (so it can be re-enabled here) but not selectable as a binding. */
  status: number;
}

export interface AiModuleModelIndex {
  module: { key: string };
  rows: AiModuleModelRow[];
  providers: AiModuleProviderOption[];
  credentials: AiModuleCredentialOption[];
}

export interface AiModuleModelSaveInput {
  capability: string;
  provider: string;
  model?: string | null;
  api_key_id?: string | null;
  max_output_tokens?: number | null;
}

export interface AiModuleModelSaved {
  capability: string;
  binding: AiModuleBinding;
  effective: AiModuleEffectiveModel;
}

export interface AiModuleModelCleared {
  capability: string;
  cleared: boolean;
  effective: AiModuleEffectiveModel;
}

/** What this module runs on, and what it could run on. */
export function fetchModuleModels(moduleKey: string): Promise<AiModuleModelIndex> {
  return call<AiModuleModelIndex>(`/modules/${encodeURIComponent(moduleKey)}/models`);
}

/** Save this module's choice for one capability. Applies to this module only. */
export function saveModuleModel(
  moduleKey: string,
  input: AiModuleModelSaveInput,
): Promise<AiModuleModelSaved> {
  return call<AiModuleModelSaved>(`/modules/${encodeURIComponent(moduleKey)}/models`, {
    method: 'PUT',
    body: input,
  });
}

/** Return this module to whatever the rest of the estate is configured to use. */
export function clearModuleModel(moduleKey: string, capability: string): Promise<AiModuleModelCleared> {
  return call<AiModuleModelCleared>(
    `/modules/${encodeURIComponent(moduleKey)}/models?capability=${encodeURIComponent(capability)}`,
    { method: 'DELETE' },
  );
}

/** Whether a resolution came from this module's own choice rather than the estate's. */
export function isModuleOwnChoice(effective: AiModuleEffectiveModel): boolean {
  return effective.source.startsWith('module_binding');
}

/**
 * A credential this module added for itself — distinct from `AiModuleCredentialOption`,
 * which is any credential the module may *pick*. This is the shape returned right after
 * adding or editing one of its own.
 */
export interface AiModuleOwnCredential {
  id: string;
  provider: string;
  label: string;
  daily_limit: number | null;
  status?: number;
  scope: 'institute';
}

export interface AiModuleModelCreateInput {
  capability: string;
  provider: string;
  /** A model id. Added to this school's own model catalogue if it is not in it yet. */
  model: string;
  model_label?: string | null;
  api_key: string;
  account_email?: string | null;
  api_limit?: number | null;
  max_output_tokens?: number | null;
}

export interface AiModuleModelCreated {
  capability: string;
  credential: AiModuleOwnCredential;
  model_id: string | null;
  binding: AiModuleBinding | null;
  effective: AiModuleEffectiveModel;
}

export interface AiModuleModelUpdateInput {
  model?: string | null;
  model_label?: string | null;
  api_key?: string | null;
  account_email?: string | null;
  api_limit?: number | null;
  /** `false` disables the credential; `true` re-enables it. */
  status?: boolean;
}

export interface AiModuleModelUpdated {
  capability: string;
  credential: AiModuleOwnCredential;
  effective: AiModuleEffectiveModel;
}

/**
 * Add a brand-new model + credential from inside this module, and use it here
 * immediately. This is "Add New Model" — distinct from `saveModuleModel`, which only
 * picks among credentials that already exist. Writes a school-owned row; never touches
 * the platform/estate default. See `AiModuleModelController::storeCredential`.
 */
export function createModuleModelCredential(
  moduleKey: string,
  input: AiModuleModelCreateInput,
): Promise<AiModuleModelCreated> {
  return call<AiModuleModelCreated>(`/modules/${encodeURIComponent(moduleKey)}/models/credentials`, {
    method: 'POST',
    body: input,
  });
}

/**
 * Edit, or enable/disable, a credential this module added for itself. Refused for a
 * platform-scoped credential — those remain the central console's to change.
 */
export function updateModuleModelCredential(
  moduleKey: string,
  credentialId: string,
  input: AiModuleModelUpdateInput,
): Promise<AiModuleModelUpdated> {
  return call<AiModuleModelUpdated>(
    `/modules/${encodeURIComponent(moduleKey)}/models/credentials/${encodeURIComponent(credentialId)}`,
    { method: 'PUT', body: { ...input, status: input.status === undefined ? undefined : input.status ? 1 : 0 } },
  );
}
