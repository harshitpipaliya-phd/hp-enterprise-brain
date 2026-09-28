
/**
 * Client for one module's AI Stack profile — `GET /ai-intelligence/modules/{module}/profile`.
 *
 * This is what replaces the hardcoded catalogues this AI Stack used to compile in:
 * `agentRegistry.ts`'s static `AGENT_TOOLS`, and each `modules/*.ts` descriptor's
 * `label`, `report.filters`, `report.defaultDataSource`-bound argument shapes and
 * `presets`. Every module screen fetches this once when its AI Stack opens (see
 * `profile-context.tsx`) and reads it instead of a value compiled into the bundle.
 *
 * `data_sources[].arguments` and `tools[].available` are REAL, tenant-measured facts —
 * `available` is false when a source's tables are missing or its ERP entity is unmapped
 * for this tenant, never assumed true just because the source is registered.
 */

import { aiRequest } from '../aiIntelligence/client';

export interface ModuleProfileCapabilities {
  conversational: boolean;
  generative: boolean;
  agent: boolean;
  workflow: boolean;
  ontology: boolean;
}

export interface ModuleProfileIdentity {
  key: string;
  label: string;
  description: string;
  icon: string | null;
  capabilities: ModuleProfileCapabilities;
  /** The AI capability keys (`conversational_ai`, …) this module's own calls resolve. */
  registry_keys: string[];
}

export interface ModuleProfileArgument {
  key: string;
  type: 'integer' | 'string' | 'boolean';
  description: string;
  /** Never present for an argument this source does not accept. */
  default?: string | number | boolean;
  min?: number;
  max?: number;
  values?: string[];
}

export interface ModuleProfileColumn {
  key: string;
  label: string;
}

export interface ModuleProfileDataSource {
  name: string;
  label: string;
  description: string;
  columns: ModuleProfileColumn[];
  arguments: ModuleProfileArgument[];
}

export interface ModuleProfileTool {
  key: string;
  label: string;
  description: string;
  module: string;
  /** Every HP Brain AI Stack tool is `read` today; typed as `string` for forward-compat. */
  risk: string;
  kind: string;
  /** A measured fact for this tenant — never assumed true because the tool is registered. */
  available: boolean;
  example_input: Record<string, unknown>;
}

export interface ModuleProfilePreset {
  name: string;
  description: string;
  module: string;
  tools_allowed: string[];
  instructions: string;
  status: 'draft' | 'active';
}

export interface ModuleProfile {
  module: ModuleProfileIdentity;
  data_sources: ModuleProfileDataSource[];
  tools: ModuleProfileTool[];
  presets: ModuleProfilePreset[];
}

export function fetchModuleProfile(moduleKey: string): Promise<ModuleProfile> {
  return aiRequest<ModuleProfile>(`/modules/${encodeURIComponent(moduleKey)}/profile`);
}
