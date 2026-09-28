/**
 * Client for AI Policies — `/ai-intelligence/policies`.
 *
 * Ported from G2G's lib/intelligence/ai-policies.ts. The paths and shapes are
 * G2G's; the differences are HP Brain's: the organisation is `tenant_id` rather
 * than `sub_institute_id`, every id is a UUID string, and a platform row carries
 * `tenant_id === '*'` where G2G stored null.
 *
 * A policy is three records that only mean something together: the policy, its
 * switches, and the scopes it applies to. They are sent and received as one payload
 * for that reason — a partial save would leave a policy on the screen that governs
 * nothing.
 */

import { aiRequest } from './client';

/** The `tenant_id` a shared platform row carries. */
export const PLATFORM_TENANT_ID = '*';

export interface AiPolicyOption {
  value: string;
  label: string;
}

export interface AiPolicyRuleCatalogItem {
  key: string;
  label: string;
  default: boolean;
}

export interface AiPolicyAssignment {
  id: string;
  policy_id: string;
  /**
   * What the assignment scopes to. The kinds come from `/policies/options`
   * (`scope_types`) — HP Brain offers organisation, module, department and
   * position — and `scope_id` is one of that kind's `scope_targets` ids.
   */
  scope_type: string;
  scope_id: string | null;
  tenant_id: string | null;
  status: number;
}

/** A row a scope can point at. The id is what an assignment stores. */
export interface AiPolicyScopeTarget {
  id: string;
  label: string;
}

/** One module a policy can be scoped to. The id is looked up, never hardcoded. */
export interface AiPolicyModuleOption {
  id: string;
  key: string;
  label: string;
}

export interface AiPolicyRow {
  id: string;
  /** `'*'` on a shared platform policy (G2G stored null; null is still read as platform). */
  tenant_id: string | null;
  /** A platform worked example. */
  is_example?: number;
  /** A shared baseline policy. Visible to every organisation, editable by none. */
  is_platform: boolean;
  editable: boolean;
  name: string;
  description: string | null;
  policy_type: string;
  status: number;
  require_disclosure: number;
  require_acknowledgement: number;
  ai_detection_required: number;
  plagiarism_check_required: number;
  detection_provider: string | null;
  detection_threshold: number | null;
  rules: Record<string, boolean>;
  assignments: AiPolicyAssignment[];
  /** Module keys this policy governs, resolved from its `module` assignments. */
  module_keys?: string[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AiPolicyOptions {
  policy_types: AiPolicyOption[];
  rule_catalogue: AiPolicyRuleCatalogItem[];
  scope_types: AiPolicyOption[];
  /**
   * The real rows each scope can name, keyed by scope type.
   *
   * A scope with nothing in this deployment arrives as an empty list, and the form
   * then offers the scope without a picker rather than offering ids that match
   * nothing.
   */
  scope_targets: Record<string, AiPolicyScopeTarget[]>;
  /** The same modules with their key — what a module scopes a new policy by. */
  modules: AiPolicyModuleOption[];
}

export interface AiPolicyIndex {
  tenant_id: string;
  /** The module the list was narrowed to, or null for every policy. */
  module_key?: string | null;
  /** The module ids that key resolved to — what a new assignment must name. */
  module_ids?: string[];
  policies: AiPolicyRow[];
}

export interface AiPolicyPayload {
  name: string;
  description?: string | null;
  policy_type: string;
  status?: number;
  require_disclosure?: number;
  require_acknowledgement?: number;
  ai_detection_required?: number;
  plagiarism_check_required?: number;
  detection_provider?: string | null;
  detection_threshold?: number | null;
  rules: Record<string, boolean>;
  assignments: Array<{
    scope_type: string;
    scope_id: string | null;
    status?: number;
  }>;
}

/**
 * Whether a policy is a shared platform one. `is_platform` is trusted when set;
 * `'*'` is HP Brain's marker and null, G2G's, is read the same way.
 */
export function isPlatformPolicy(row: Pick<AiPolicyRow, 'is_platform' | 'tenant_id'>): boolean {
  return row.is_platform === true || row.tenant_id === PLATFORM_TENANT_ID || row.tenant_id === null;
}

export function fetchAiPolicyOptions(): Promise<AiPolicyOptions> {
  return aiRequest<AiPolicyOptions>('/policies/options');
}

/** Policies for one module. Omit `moduleKey` for every policy the organisation can see. */
export function fetchAiPolicies(moduleKey?: string | null): Promise<AiPolicyIndex> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : '';

  return aiRequest<AiPolicyIndex>(`/policies${query}`);
}

export function createAiPolicy(payload: AiPolicyPayload): Promise<{ policy: AiPolicyRow }> {
  return aiRequest('/policies', 'POST', payload);
}

/**
 * Save an edit. `action` is `forked` when the policy was a shared platform one — the
 * save then wrote this organisation its own copy, which takes precedence, and left the
 * platform row intact for everyone else.
 */
export function updateAiPolicy(
  id: string,
  payload: AiPolicyPayload,
): Promise<{ policy: AiPolicyRow; action?: 'updated' | 'forked'; forked_from?: string }> {
  return aiRequest(`/policies/${encodeURIComponent(id)}`, 'PUT', payload);
}

export function retireAiPolicy(id: string): Promise<{ id: string }> {
  return aiRequest(`/policies/${encodeURIComponent(id)}`, 'DELETE');
}
