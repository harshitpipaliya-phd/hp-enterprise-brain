
/**
 * The seam between a module's screens and its AI Stack, for any module.
 *
 * WHAT THIS FILE IS FOR
 *
 * A module's screens do that module's work — schedule a meeting, allocate a room, publish
 * a circular. They should not also each know how to find the configured agent, which
 * prompt is published this week, or what an execution ledger entry looks like. This is the
 * one place that knows, so a screen adds AI by calling one function.
 *
 * It is `lib/fees/fees-ai-stack.ts`, `lib/attendance/attendance-ai-stack.ts`,
 * `lib/admissions/admissions-ai-stack.ts` and `lib/students/students-ai-stack.ts` with the
 * module lifted out into a parameter. Those four files are the same file four times, and
 * this exists so the next five modules are not the same file nine times. THOSE FOUR ARE
 * NOT MODIFIED AND NOTHING HERE IMPORTS FROM THEM: folding a working module into an
 * abstraction on the way past is how the working module breaks.
 *
 * WHAT IS DECLARED AND WHAT IS LOOKED UP
 *
 * Declared, by each module's descriptor: the catalogue of operations and which AI
 * capability each leans on. That mapping is application knowledge and belongs next to the
 * module's routes.
 *
 * Looked up, always, at runtime: every actual record. The agent comes from the Agent
 * Management engine's own store, the prompt and report layout from `ai_templates` where
 * `module_key` is this module's. Nothing in this file contains a template key, an agent
 * name or an id, and the module key is never defaulted — a caller that does not name one
 * gets an error rather than somebody else's records.
 *
 * WHY RECORDING NEVER BLOCKS
 *
 * A meeting has been saved and a room has been allocated before any of this runs. Every
 * entry point below is best-effort: it resolves what it can, records what it can, and
 * returns false rather than throwing. Losing a ledger line is bad; failing a warden's save
 * because the audit table was busy is worse. Nothing here is on the critical path of a
 * module operation, and nothing in it may become so.
 */

import { fetchAgents } from '../../api/aiStack/agents';
import type { Agent } from '../../api/aiStack/agentTypes';
import { recordModuleActivitySafely, type RecordModuleActivityInput } from '../../api/aiStack/module';
import { fetchTemplates, type AiTemplateRow } from '../../api/aiIntelligence/templates';
import type { WorkspaceSession } from '../../api/aiStack/workspace';

import type { AiStackModule, AiStackOperationSpec } from './ai-stack-module';
import { getAccessToken } from '../../utils/authTokens';
import { getAuthTenantId } from '../../utils/tenant';

/**
 * The signed-in session, for the workspace calls these screens make.
 *
 * HP BRAIN PORT: read from HP Brain's own JWT, not G2G's or LMS_K12's session keys.
 * Nothing in it is ever posted — the backend derives the tenant from the bearer token —
 * and there is no default organisation and no academic year in HP Brain.
 */
export function readModuleWorkspaceSession(): WorkspaceSession {
  if (typeof window === 'undefined') return {};

  const token = getAccessToken();
  if (!token) return {};

  return {
    token,
    baseUrl: null,
    instituteId: getAuthTenantId(),
    academicYear: '',
    termId: '',
  };
}

/** Everything configured for one module right now, as the database and engine report it. */
export interface ModuleAiStackSnapshot {
  /** Published, offered report layouts for this module. */
  reportTemplates: AiTemplateRow[];
  /** Published prompts for this module. */
  prompts: AiTemplateRow[];
  /** Active agents for this module from the Agent Management engine. */
  agents: Agent[];
  /** True when neither store could be read — the caller records without artefacts. */
  degraded: boolean;
}

const EMPTY_SNAPSHOT: ModuleAiStackSnapshot = {
  reportTemplates: [],
  prompts: [],
  agents: [],
  degraded: true,
};

/**
 * One in-flight load per module, shared by every caller in the page.
 *
 * A list screen, a report screen and a text field can all ask at once; they should cause
 * one pair of requests, not three. Keyed BY MODULE rather than held in a single slot,
 * because two modules' AI Stacks can be open in one session — a flat memo would hand the
 * second module the first one's templates, which is the exact cross-module leak the whole
 * design is built to prevent.
 *
 * Cached for the lifetime of the page: long enough that typing in a field is instant,
 * short enough that a template published in another tab is picked up on the next
 * navigation.
 */
const snapshots = new Map<string, Promise<ModuleAiStackSnapshot>>();

export function resolveModuleAiStack(moduleKey: string): Promise<ModuleAiStackSnapshot> {
  const existing = snapshots.get(moduleKey);

  if (existing) return existing;

  const loading = loadSnapshot(moduleKey).catch(() => EMPTY_SNAPSHOT);
  snapshots.set(moduleKey, loading);

  return loading;
}

/** Drop one module's cache, so a screen that has just published a template sees it. */
export function refreshModuleAiStack(moduleKey: string): void {
  snapshots.delete(moduleKey);
}

async function loadSnapshot(moduleKey: string): Promise<ModuleAiStackSnapshot> {
  // Settled, not all: the template store and the agent engine are different systems and
  // one being unreachable must not cost the caller the other.
  const [templates, agents] = await Promise.allSettled([
    fetchTemplates(moduleKey, true),
    fetchAgents({ module: moduleKey }),
  ]);

  const rows = templates.status === 'fulfilled' ? templates.value.templates : [];
  const published = rows.filter((row) => row.status === 'published');

  return {
    reportTemplates: published.filter((row) => row.kind === 'report'),
    prompts: published.filter((row) => row.kind === 'prompt'),
    agents: agents.status === 'fulfilled' ? agents.value.filter((agent) => agent.status === 'active') : [],
    degraded: templates.status === 'rejected' && agents.status === 'rejected',
  };
}

/**
 * Pick the record an operation should use, from what is actually published.
 *
 * Preference is a nudge, not a rule: a spec that prefers "summary" gets the summary prompt
 * when one exists and the newest published prompt when it does not. Returning something
 * reasonable matters more than returning nothing, and returning nothing is still correct
 * when the module has published nothing at all.
 */
function pick(rows: AiTemplateRow[], prefers: string[] = []): AiTemplateRow | null {
  if (rows.length === 0) return null;

  for (const hint of prefers) {
    const needle = hint.toLowerCase();
    const match = rows.find(
      (row) => row.template_key.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle),
    );
    if (match) return match;
  }

  // Newest first. `updated_at` can be null on rows that predate the column.
  return [...rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
}

function specFor(module: AiStackModule, operation: string): AiStackOperationSpec | null {
  return module.operations[operation] ?? null;
}

/** The report layout a report operation should cite, or null when none is published. */
export async function moduleReportTemplateFor(
  module: AiStackModule,
  operation: string,
): Promise<AiTemplateRow | null> {
  const snapshot = await resolveModuleAiStack(module.key);

  return pick(snapshot.reportTemplates, specFor(module, operation)?.prefers);
}

/** The prompt a generative operation should use, or null when none is published. */
export async function modulePromptFor(
  module: AiStackModule,
  operation: string,
): Promise<AiTemplateRow | null> {
  const snapshot = await resolveModuleAiStack(module.key);

  return pick(snapshot.prompts, specFor(module, operation)?.prefers);
}

/** The active agent of this module that may run one tool, or null when none is configured. */
export async function moduleAgentForTool(module: AiStackModule, toolKey: string): Promise<Agent | null> {
  const snapshot = await resolveModuleAiStack(module.key);

  return snapshot.agents.find((agent) => agent.tools_allowed.includes(toolKey)) ?? null;
}

/** What a module screen knows about the thing it just did. */
export interface ModuleOperationDetails {
  status?: RecordModuleActivityInput['status'];
  /** A sentence a person reading the ledger would want. */
  message?: string;
  /** The record it was about, if one. */
  subjectId?: string | null;
  subjectLabel?: string | null;
  /** Report name, run reference — whatever identifies this run. */
  reference?: string | null;
  /** Figures and filters worth keeping. Kept small; this is a ledger, not a warehouse. */
  result?: Record<string, unknown> | null;
  /** Set when the caller already knows the artefact, e.g. the generation it just ran. */
  templateId?: string | null;
  promptId?: string | null;
  agent?: Agent | null;
  agentRunId?: string | null;
  tool?: string | null;
  workflow?: string | null;
}

/**
 * Record one module operation in the AI Stack ledger.
 *
 * Resolves whatever the operation's spec says it uses, unless the caller has already
 * supplied it, then writes the entry. Returns whether the entry landed; callers are
 * expected to ignore that, and none of them should await it on a path a user is waiting on.
 */
export async function recordModuleOperation(
  module: AiStackModule,
  operation: string,
  details: ModuleOperationDetails = {},
): Promise<boolean> {
  const spec = specFor(module, operation);

  if (!spec) {
    console.warn(`[${module.key}-ai] "${operation}" is not a known operation of this module; not recorded.`);
    return false;
  }

  let templateId = details.templateId ?? null;
  let promptId = details.promptId ?? null;
  let agent = details.agent ?? null;

  try {
    if (spec.uses === 'report_template' && templateId === null) {
      templateId = (await moduleReportTemplateFor(module, operation))?.id ?? null;
    } else if (spec.uses === 'prompt' && promptId === null) {
      promptId = (await modulePromptFor(module, operation))?.id ?? null;
    } else if (spec.uses === 'agent' && agent === null && details.tool) {
      agent = await moduleAgentForTool(module, details.tool);
    }
  } catch {
    // Resolution is a nicety. An entry naming no artefact is still a true entry, and far
    // better than no entry at all.
  }

  return recordModuleActivitySafely(module.key, {
    operation,
    operation_label: spec.label,
    capability: spec.capability,
    status: details.status ?? 'completed',
    message: details.message,
    subject_entity_key: details.subjectId ? module.subjectEntityKey : undefined,
    subject_id: details.subjectId ?? undefined,
    subject_label: details.subjectLabel ?? undefined,
    reference: details.reference ?? undefined,
    template_id: templateId ?? undefined,
    prompt_id: promptId ?? undefined,
    agent_id: agent?.id ?? undefined,
    agent_name: agent?.name ?? undefined,
    agent_run_id: details.agentRunId ?? undefined,
    workflow: details.workflow ?? undefined,
    tool: details.tool ?? undefined,
    result: details.result ?? undefined,
  });
}

/**
 * Fire-and-forget form, for the end of an operation that has already succeeded.
 *
 * Exists so a call site cannot accidentally make the ledger part of a user's wait: this
 * returns nothing to await, and swallows everything.
 */
export function logModuleOperation(
  module: AiStackModule,
  operation: string,
  details: ModuleOperationDetails = {},
): void {
  void recordModuleOperation(module, operation, details).catch(() => undefined);
}
