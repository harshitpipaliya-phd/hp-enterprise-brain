import type { AgentModuleKey } from '../../api/aiStack/agentTypes';
import type { ModuleProfileTool } from '../../api/aiStack/profile';

/**
 * Module catalogue and tool helpers for HP Brain's AI Stack agents.
 *
 * SAME EXPORTED NAMES AND HELPER SIGNATURES AS BEFORE, because the shared AI Stack
 * screens (Automations, Guardrails, Create Agent, Run Agent) import these by name —
 * but `AGENT_TOOLS`, the static list this file used to compile in, is gone. Which
 * tools exist, what their arguments are and whether each is actually available for
 * this tenant now comes from `GET /ai-intelligence/modules/{key}/profile` (see
 * `profile.ts` and `profile-context.tsx`), because that list is real backend
 * catalogue, tenant-measured, and was drifting out of sync with
 * `App\Domain\AiIntelligence\Reports\ModuleDataSourceCatalog` the moment either side
 * changed without the other.
 *
 * `AgentTool` is therefore exactly the profile's own tool shape — one type, not a
 * frontend mirror of a backend one — and `toolsForModule`/`findTool` take the
 * profile's `tools` array as their first argument rather than reading a module-level
 * constant, so a caller cannot reach for a tool the loaded profile never actually
 * offered.
 *
 * `AGENT_MODULES` remains a small static list of the eighteen HP Brain modules that
 * have an AI Stack, with a label and one-line description for cross-module display
 * (the agent library and analytics tabs, which are keyed by whichever module each row
 * already belongs to). It is not a source of per-tenant truth about any one module —
 * every screen that configures or runs an agent for a SPECIFIC module is always
 * opened already scoped to that module (`AgentManagement`'s only caller passes
 * `moduleFilter`), so nothing here ever needs to widen access beyond what the loaded
 * profile allows; the backend re-checks the tool belongs to the agent's module and is
 * on its allow-list on every create and every run regardless of what this list says.
 */

export interface AgentModule {
  key: AgentModuleKey;
  label: string;
  description: string;
}

/** The profile's own tool shape. See `ModuleProfileTool` in `api/aiStack/profile.ts`. */
export type AgentTool = ModuleProfileTool;

export const SHARED_MODULE = 'shared';

export const AGENT_MODULES: AgentModule[] = [
  { key: 'departments', label: 'Departments', description: 'Foundation › Departments' },
  { key: 'people', label: 'People', description: 'Foundation › People' },
  { key: 'capabilities', label: 'Capabilities', description: 'Foundation › Capabilities' },
  { key: 'signals', label: 'Signals', description: 'Intelligence Loop › Signals' },
  { key: 'evidence', label: 'Evidence', description: 'Intelligence Loop › Evidence' },
  { key: 'deliberation', label: 'Deliberation', description: 'Intelligence Loop › Deliberation' },
  { key: 'intelligence_workspace', label: 'Intelligence Workspace', description: 'Intelligence Loop › Intelligence Workspace' },
  { key: 'executions', label: 'Execution Center', description: 'Intelligence Loop › Execution Center' },
  { key: 'decision_analytics', label: 'Decision Intelligence', description: 'Analytics › Decision Intelligence' },
  { key: 'mental_models', label: 'Organizational Knowledge', description: 'Analytics › Organizational Knowledge' },
  { key: 'knowledge_graph', label: 'Graph Explorer', description: 'Knowledge › Graph Explorer' },
  { key: 'kasba', label: 'KASBA Explorer', description: 'Knowledge › KASBA Explorer' },
  { key: 'knowledge_library', label: 'Knowledge Library', description: 'Knowledge › Knowledge Library' },
  { key: 'organisational_memory', label: 'Memory', description: 'Knowledge › Memory' },
  { key: 'eso', label: 'ESO Library', description: 'Knowledge › ESO Library' },
  { key: 'agents', label: 'Agent Monitor', description: 'Automation › Agent Monitor' },
  { key: 'tasks', label: 'Task Orchestrator', description: 'Automation › Task Orchestrator' },
  { key: 'policies', label: 'Policy Management', description: 'Automation › Policy Management' },
];

export function findModule(key: string): AgentModule | undefined {
  return AGENT_MODULES.find((module) => module.key === key);
}

export function isKnownModule(key: string): boolean {
  return Boolean(findModule(key));
}

/** The permission key an agent in this module is gated on. */
export function rbacModuleKey(module: AgentModuleKey): string {
  return `agents.${module}`;
}

/**
 * Tools a Create Agent form may offer for one module, out of the tools its LOADED
 * PROFILE actually returned: the module's own plus anything carrying the shared
 * marker (HP Brain has none today — every profile tool is scoped to one module — but
 * the check costs nothing and keeps this working if that ever changes).
 *
 * `tools` is `useAiStackProfile().tools` at every real call site.
 */
export function toolsForModule(tools: AgentTool[], module: AgentModuleKey): AgentTool[] {
  return tools.filter((tool) => tool.module === module || tool.module === SHARED_MODULE);
}

export function findTool(tools: AgentTool[], key: string): AgentTool | undefined {
  return tools.find((tool) => tool.key === key);
}

/** The reason an allow-list is not acceptable for a module, or null if it is. */
export function validateToolsForModule(tools: AgentTool[], module: AgentModuleKey, toolKeys: string[]): string | null {
  const unique = Array.from(new Set(toolKeys));
  if (!unique.length) return 'Choose at least one tool.';

  const offered = new Set(toolsForModule(tools, module).map((tool) => tool.key));
  for (const key of unique) {
    const tool = findTool(tools, key);
    if (!tool) return `Unknown tool "${key}".`;
    if (!offered.has(key)) return `"${tool.label}" belongs to ${tool.module}, not ${module}.`;
    if (!tool.available) return `"${tool.label}" is not available yet.`;
  }
  return null;
}
