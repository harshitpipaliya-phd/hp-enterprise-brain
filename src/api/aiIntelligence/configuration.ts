/**
 * Client for AI Providers & Model Management — `/ai-intelligence/configuration`.
 *
 * Ported from G2G's lib/intelligence/ai-configuration.ts. The write half of what
 * `capabilities.ts` reads. It is a separate file for the same reason the controller
 * behind it is a separate controller: the endpoints that can change a credential
 * are worth being able to find in one place.
 *
 * NOTHING HERE EVER RECEIVES AN API KEY BACK. A configuration arrives with
 * `key_preview` — four characters either side of a mask — which is enough to tell two
 * credentials apart and not enough to use one. The key travels in one direction only:
 * into `createAiConfiguration` / `updateAiConfiguration`.
 *
 * Differences from G2G's contract: the organisation is `tenant_id` (G2G's
 * `sub_institute_id`), and every id is a UUID string. Platform rows — shared across
 * the estate — carry `tenant_id === '*'` where G2G used a null `sub_institute_id`.
 */

import { aiRequest } from './client';

/** The tenant id the server gives rows shared across the whole estate. */
export const PLATFORM_TENANT_ID = '*';

export interface AiModuleOption {
  key: string;
  label: string;
  description: string;
  /** True when this module resolves its provider through the saved configuration. */
  wired: boolean;
  consumer: string;
}

export interface AiProviderOption {
  key: string;
  label: string;
  /** False when the platform has no client shape that can call this provider. */
  driveable: boolean;
  api_type: string;
  docs: string;
}

export interface AiModelOption {
  id: string;
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens: number | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  sort_order: number;
  status: number;
  /** `platform` rows are shared across the estate and read-only to an organisation. */
  scope: 'platform' | 'institute' | 'tenant' | string;
  /** '*' on platform rows. Optional: the scope field is the primary signal. */
  tenant_id?: string | null;
}

export interface AiConfigurationOptions {
  modules: AiModuleOption[];
  providers: AiProviderOption[];
  models: Record<string, AiModelOption[]>;
  active_driver: string;
}

export interface AiConfigurationRow {
  id: string;
  ai_module: string | null;
  module_label: string;
  module_wired: boolean;
  provider: string;
  provider_label: string;
  api_type: string;
  model: string | null;
  account_email: string | null;
  api_limit: string | number | null;
  status: number;
  scope: 'platform' | 'institute' | 'tenant' | string;
  editable: boolean;
  key_preview: string | null;
  updated_at: string | null;
  /** '*' on platform rows. */
  tenant_id?: string | null;
}

/** What a module resolves to right now, including modules with nothing saved. */
export interface AiResolvedRow {
  module: string;
  module_label: string;
  description: string;
  wired: boolean;
  provider: string;
  provider_label: string;
  model: string | null;
  source: 'module' | 'module_platform' | 'pool' | 'pool_platform' | 'env' | 'config';
  scope: string;
  key_id: string | null;
  has_key: boolean;
  driveable: boolean;
}

export interface AiConfigurationIndex {
  tenant_id: string;
  configurations: AiConfigurationRow[];
  resolved: AiResolvedRow[];
}

export interface AiModelIndex {
  tenant_id: string;
  providers: AiProviderOption[];
  models: Record<string, AiModelOption[]>;
}

export interface AiConfigurationPayload {
  ai_module: string;
  provider: string;
  model: string | null;
  /** Omitted on edit to leave the stored credential untouched. */
  api_key?: string;
  account_email?: string | null;
  api_limit?: number | null;
  status?: number;
}

export interface AiModelPayload {
  provider: string;
  model_id: string;
  label: string;
  max_output_tokens?: number | null;
  input_cost_per_1k?: number | null;
  output_cost_per_1k?: number | null;
  sort_order?: number;
  status?: number;
}

/**
 * True for a row shared across the estate. `scope` is what G2G checked; `tenant_id`
 * is HP Brain's marker ('*'), and an explicit null tenant is treated as platform too
 * — defensively, because a row with no owner must never look editable.
 */
export function isPlatformRow(row: { scope?: string | null; tenant_id?: string | null }): boolean {
  if (row.scope === 'platform') return true;
  if (row.tenant_id === PLATFORM_TENANT_ID) return true;
  return 'tenant_id' in row && row.tenant_id === null;
}

export function fetchAiConfigurationOptions(): Promise<AiConfigurationOptions> {
  return aiRequest<AiConfigurationOptions>('/configuration/options');
}

export function fetchAiConfigurations(): Promise<AiConfigurationIndex> {
  return aiRequest<AiConfigurationIndex>('/configuration');
}

export function createAiConfiguration(
  payload: AiConfigurationPayload,
): Promise<{ configuration: AiConfigurationRow }> {
  return aiRequest('/configuration', 'POST', payload);
}

export function updateAiConfiguration(
  id: string,
  payload: AiConfigurationPayload,
): Promise<{ configuration: AiConfigurationRow }> {
  return aiRequest(`/configuration/${encodeURIComponent(id)}`, 'PUT', payload);
}

export function retireAiConfiguration(id: string): Promise<{ id: string }> {
  return aiRequest(`/configuration/${encodeURIComponent(id)}`, 'DELETE');
}

export function fetchAiModels(): Promise<AiModelIndex> {
  return aiRequest<AiModelIndex>('/configuration-models');
}

export function createAiModel(payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return aiRequest('/configuration-models', 'POST', payload);
}

export function updateAiModel(id: string, payload: AiModelPayload): Promise<{ model: AiModelOption }> {
  return aiRequest(`/configuration-models/${encodeURIComponent(id)}`, 'PUT', payload);
}
