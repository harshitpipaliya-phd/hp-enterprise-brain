/**
 * AI Stack → Automations, for any module.
 *
 * ONE AGENT REGISTRY, NOT TWO
 *
 * This is the point of the tab. Everything on it is a row in a store the rest of the
 * platform already reads: the backend manifest panel at the top is the `ai_agents` row the
 * chatbot resolves, run through the same `AgentRunner`, writing to the same `ai_cases`,
 * `ai_evidence`, `ai_recommendations` and `workflow_approvals`. The tool agents below are
 * configurations on the central Agent Management engine, scoped to this module. There is
 * no AI-Stack copy of either.
 *
 * TWO KINDS OF AUTOMATION, AND THE DIFFERENCE IS REAL
 *
 * 1. A backend domain agent (top), when the module is bound to one. It detects, opens a
 *    case, cites records as evidence, explains, and drafts something that stops at a human
 *    approval.
 *
 * 2. Tool agents (bottom). Each is allowed one or more read/draft tools from this module's
 *    catalogue. These are what an operator builds for themselves; the presets are simply
 *    the useful ones written out so nobody has to re-derive a tool allow-list.
 *
 * WHEN A MODULE HAS NO BOUND AGENT, THE PANEL SAYS SO AND WHY
 *
 * Most modules have none — and in HP Brain, as in G2G, none do: every descriptor sets
 * `boundAgent: null`. That is not a gap to paper over. A module with no manifest cannot
 * open a case, cannot raise a recommendation and has nothing for a person to approve — so
 * the panel prints the reason recorded for it and points at what the module does have. An
 * empty panel with a disabled Run button would leave somebody looking for a feature that
 * was never claimed. The bound-agent panel is kept, unchanged, so a module that is ever
 * bound to one gets it without this file being rewritten.
 *
 * PERMISSIONS
 *
 * The tool agents are gated on `agents.<module>` — in HP Brain the `settings.manage`
 * permission, which the Admin and Tenant admin roles hold — and re-checked server-side by
 * `/ai-intelligence/tool-agents` before anything is created or run.
 *
 * A bound backend agent is deliberately NOT gated on that key in this client. Its
 * authority is the manifest's own `allowed_roles` and `required_permissions`, enforced by
 * `AgentRunner` on the server. Adding a second, different frontend gate in front of it
 * would mean a user who is allowed to run it is told they are not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Info,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Workflow,
  XCircle,
} from 'lucide-react';

import { Button, Field, TextInput } from '../../ui';
import { AgentManagement } from './agents/AgentManagement';
import { RunAgentDialog } from './agents/RunAgentDialog';
import { useBrainResource } from './agents/useBrainResource';
import { usePermission } from './adapters/use-permission';
import { createAgent, fetchAgents, fetchRuns, setAgentStatus } from '../../api/aiStack/agents';
import type { Agent, AgentRun, CreateAgentInput } from '../../api/aiStack/agentTypes';
import { findTool, type AgentTool } from './agentRegistry';
import { listAgentRuns, listAgents, listPendingApprovals, resolveApproval, runAgent } from './adapters/domain-agents';
import type { AgentRunResult, PendingApproval } from './adapters/domain-agents';
import { logModuleOperation, readModuleWorkspaceSession } from './module-ai-stack';
import { useAiStackProfile } from './profile-context';

import { AiStackCard, AiStackCardHeading, AiStackPill, formatWhen } from './ai-stack-chrome';
import { aiStackRbacKey, type AiStackBoundAgent, type AiStackModule } from './ai-stack-module';
import './aiStackScreens-b.css';

/** The manifest as the agent registry returns it. Loosely typed — it is a config row. */
interface AgentManifestRow {
  agent_key?: string;
  name?: string;
  purpose?: string;
  description?: string;
  max_verb?: string;
  may_execute_actions?: boolean | number;
  authorized_workflow_keys?: string[] | string;
  allowed_roles?: string[];
  allowed_tools?: string[];
  [key: string]: unknown;
}

/** One case a backend agent opened, as its own result describes it. */
interface AgentCase {
  case_id: number | string;
  subject_name?: string;
  subject_label?: string;
  severity?: string;
  priority_score?: number;
  signals?: Array<{ signal_key?: string; severity?: string; score?: number; evidence_count?: number }>;
  explanation?: { narrative?: string; governance_passed?: boolean; reason_refused?: string | null };
  recommendation?: {
    id?: number | string | null;
    status?: string;
    governance_passed?: boolean;
    reason_refused?: string | null;
    title?: string;
  } | null;
}

export function AiStackAutomationsScreen({ module }: { module: AiStackModule }) {
  const rbacKey = aiStackRbacKey(module);
  // The module's agent presets, live from its loaded profile — an administrator can
  // publish, edit or retire one without a frontend redeploy. `module.presets` (the
  // descriptor's compiled-in list) is no longer read here.
  const profile = useAiStackProfile();
  const presets: CreateAgentInput[] = profile.presets;

  // Tool agents, on the central Agent Management engine.
  const agents = useBrainResource(() => fetchAgents({ module: module.key }), [module.key]);
  const runs = useBrainResource(() => fetchRuns({ module: module.key, limit: 100 }), [module.key]);
  const canCreate = usePermission(rbacKey, 'create');
  const canRun = usePermission(rbacKey, 'update');

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  /** The agent each preset resolves to in this tenant, matched by name. */
  const configured = useMemo(() => {
    const map = new Map<string, Agent>();

    for (const preset of presets) {
      const match = (agents.data ?? []).find((agent) => agent.name === preset.name && agent.status !== 'archived');
      if (match) map.set(preset.name, match);
    }

    return map;
  }, [agents.data, presets]);

  const refreshAll = useCallback(() => {
    agents.refresh();
    runs.refresh();
    setConsoleKey((key) => key + 1);
  }, [agents, runs]);

  const enable = useCallback(
    async (preset: CreateAgentInput) => {
      setBusy(preset.name);
      setNote(null);
      try {
        const agent = await createAgent(preset);
        setNote(`${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The agent could not be enabled.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const toggle = useCallback(
    async (agent: Agent) => {
      setBusy(agent.name);
      setNote(null);
      const next = agent.status === 'active' ? 'paused' : 'active';
      try {
        await setAgentStatus(agent.id, next);
        setNote(`${agent.name} is now ${next}.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const closeRun = useCallback(() => setRunning(null), []);

  /**
   * What to say about rights, and only when it is actually the obstacle.
   *
   * It names the key, because the failure this replaces was a message that told people to
   * ask for a right without saying what it was called.
   */
  const rightsNote =
    canCreate === false && configured.size === 0
      ? `Your role cannot enable tool agents for the ${module.label} module. Ask an administrator for ${rbacKey} create rights — in HP Brain that is the settings.manage permission, held by the Admin and Tenant admin roles.`
      : canRun === false && configured.size > 0
        ? `Your role can see these agents but cannot run or pause them (${rbacKey} update rights).`
        : null;

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className="ais-b-stack-lg">
      {module.boundAgent ? <BoundAgentPanel module={module} agent={module.boundAgent} /> : <NoBoundAgentPanel module={module} />}

      <section className="ais-b-panel" aria-labelledby={`ais-tool-agents-${module.key}`}>
        <div className="ais-row ais-row--between" style={{ alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          <div className="ais-minw0">
            <h2 id={`ais-tool-agents-${module.key}`} className="ais-b-h2">
              {module.label} tool agents
            </h2>
            <p className="ais-b-lead">
              Each one runs on the central Agent Management engine, scoped to the {module.label} module. The read agents
              answer from this organisation&apos;s own {module.records}; a drafter writes text and sends nothing. Every
              run is recorded against the person who pressed Run.
            </p>
          </div>

          <button type="button" onClick={refreshAll} disabled={refreshing} className="ais-btn ais-btn--sm ais-b-shrink0">
            <RefreshCw size={14} className={refreshing ? 'ais-spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div aria-live="polite">
          {agents.error && !agents.data && (
            <p className="ais-b-callout ais-b-callout--error ais-b-mt4" role="alert">
              {agents.error}
            </p>
          )}
          {rightsNote && (
            <p className="ais-b-callout ais-b-callout--warning ais-b-mt4">
              <Lock size={14} aria-hidden="true" />
              {rightsNote}
            </p>
          )}
          {note && <p className="ais-b-callout ais-b-callout--info ais-b-mt4">{note}</p>}
        </div>

        {presets.length > 0 && (
          <div className="ais-b-grid-3" style={{ marginTop: 'var(--space-5)' }}>
            {presets.map((preset) => (
              <PresetCard
                key={preset.name}
                preset={preset}
                agent={configured.get(preset.name) ?? null}
                runs={runs.data ?? []}
                tools={profile.tools}
                checking={agents.loading && !agents.data}
                busy={busy === preset.name}
                canCreate={canCreate === true}
                canRun={canRun === true}
                onEnable={() => void enable(preset)}
                onToggle={(agent) => void toggle(agent)}
                onRun={setRunning}
              />
            ))}
          </div>
        )}
      </section>

      <div>
        <h3 className="ais-b-h3">{module.label} agent management</h3>
        <AgentManagement key={consoleKey} moduleFilter={module.key} embedded />
      </div>

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={closeRun}
          onRan={() => {
            runs.refresh();
            setConsoleKey((key) => key + 1);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The module has no backend manifest — say so, and say what that means
// ---------------------------------------------------------------------------

/**
 * Why there is no Run button, and what the module does have instead.
 *
 * This is the honest state for most modules, and it is written out rather than left as an
 * absence because "where is the agent" is the first question somebody has on this tab. The
 * reason is the one the descriptor records for the module, so the screen and the backend
 * cannot give different answers.
 */
function NoBoundAgentPanel({ module }: { module: AiStackModule }) {
  return (
    <AiStackCard>
      <AiStackCardHeading
        title={`${module.label} has no agent of its own`}
        hint="What that means for cases, recommendations and approvals in this module."
      />

      <div className="ais-b-stack-sm ais-b-card-pad">
        <p className="ais-b-callout">
          <Info size={16} className="ais-b-faint" aria-hidden="true" />
          <span>
            {module.noAgentReason ??
              `No agent manifest is bound to the ${module.label} module, so nothing here opens a case or raises a recommendation.`}
          </span>
        </p>

        <ul className="ais-b-grid-facts">
          <NoAgentFact title="No cases" detail={`Nothing detects a condition in the ${module.records} and opens a case against it.`} />
          <NoAgentFact
            title="No approval queue"
            detail="Nothing raises a recommendation, so there is nothing here for a person to approve or reject."
          />
          <NoAgentFact
            title="Tool agents still run"
            detail={`The agents below read this organisation's own ${module.records} as the person who presses Run.`}
          />
        </ul>

        <p className="ais-b-xs ais-b-faint" style={{ margin: 0 }}>
          This is a statement about configuration, not a fault. A module gains a manifest by an administrator
          registering one in <span className="ais-mono">ai_agents</span> and binding it to the module; until then this
          panel would have nothing true to show, and a disabled Run button would suggest otherwise.
        </p>
      </div>
    </AiStackCard>
  );
}

function NoAgentFact({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="ais-b-fact">
      <p className="ais-b-strong" style={{ margin: 0, fontSize: 14 }}>
        {title}
      </p>
      <p className="ais-b-2xs" style={{ margin: '2px 0 0' }}>
        {detail}
      </p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The backend agent a module is bound to — the one the chatbot uses
// ---------------------------------------------------------------------------

/** The execution stages a run passes through, in the order a reader should see them. */
type StageState = 'pending' | 'ran' | 'skipped' | 'failed';

interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
}

function BoundAgentPanel({ module, agent: bound }: { module: AiStackModule; agent: AiStackBoundAgent }) {
  const [manifest, setManifest] = useState<AgentManifestRow | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(bound.filters.map((filter) => [filter.key, filter.key === 'limit' ? '50' : ''])),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState('');

  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [deciding, setDeciding] = useState<number | null>(null);
  const [token, setToken] = useState(0);

  // `setLoading(true)` lives here rather than in the effect body. Calling setState
  // synchronously inside an effect triggers a cascading render, and the spinner belongs to
  // the act of asking for a reload, not to the effect that carries it out.
  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const context = readModuleWorkspaceSession();

    // Settled, not all: the manifest, the run log and the approval queue are three reads
    // and one failing must not blank the other two.
    void Promise.allSettled([
      listAgents(context),
      listAgentRuns(context, bound.agentKey, 20),
      listPendingApprovals(context, 50),
    ]).then(([agentList, runList, approvalList]) => {
      if (cancelled) return;

      if (agentList.status === 'fulfilled') {
        const found = (agentList.value.agents ?? []).find(
          (row) => (row as AgentManifestRow).agent_key === bound.agentKey,
        ) as AgentManifestRow | undefined;

        setManifest(found ?? null);
        setManifestError(
          found
            ? ''
            : `No active manifest for ${bound.fallbackName} is registered for your role in this organisation. It cannot run until an administrator registers one.`,
        );
      } else {
        setManifestError(agentList.reason instanceof Error ? agentList.reason.message : 'The agent registry could not be read.');
      }

      setHistory(runList.status === 'fulfilled' ? (runList.value.runs ?? []) : []);
      setApprovals(
        approvalList.status === 'fulfilled'
          ? (approvalList.value.approvals ?? []).filter((approval) => approval.workflow_key === bound.workflowKey)
          : [],
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, bound.agentKey, bound.workflowKey, bound.fallbackName]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRunError('');

    /** A positive integer, or undefined so the backend applies its own default. */
    const positive = (value: string) => {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };

    // Only the filters this manifest actually reads — declared on the descriptor. Offering
    // one it ignores would be a control that silently does nothing.
    const input = Object.fromEntries(
      bound.filters
        .map((filter) => [filter.key, positive(filters[filter.key] ?? '')] as const)
        .filter(([, value]) => value !== undefined),
    );

    try {
      const outcome = await runAgent(readModuleWorkspaceSession(), bound.agentKey, input);

      setResult(outcome);

      logModuleOperation(module, `${module.key}_agent_run`, {
        status: outcome.status === 'completed' ? 'completed' : 'failed',
        message: outcome.summary,
        agentRunId: outcome.run_id === null ? null : String(outcome.run_id),
        result: { status: outcome.status, filters: input, ...outcome.counters },
      });

      reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The agent could not be run.';
      setRunError(message);
      // Recorded as a failure rather than swallowed: a run that was refused is a thing the
      // Activity tab should show, and it is the only place the reason survives.
      logModuleOperation(module, `${module.key}_agent_run`, { status: 'failed', message });
    } finally {
      setRunning(false);
    }
  };

  const decide = async (approval: PendingApproval, decision: 'approved' | 'rejected') => {
    setDeciding(approval.id);
    setApprovalNote('');

    try {
      const summary = await resolveApproval(readModuleWorkspaceSession(), approval.id, decision);
      setApprovalNote(
        `Approval #${approval.id} ${decision}. The ${bound.workflowKey} run is now ${summary.status}${
          summary.current_step ? ` at "${summary.current_step}"` : ''
        }.`,
      );
      reload();
    } catch (cause) {
      setApprovalNote(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
    } finally {
      setDeciding(null);
    }
  };

  const cases = useMemo<AgentCase[]>(() => {
    const found = result?.result?.cases;

    return Array.isArray(found) ? (found as unknown as AgentCase[]) : [];
  }, [result]);

  const stages = useMemo(
    () => buildStages(bound, result, runError, cases, approvals.length),
    [bound, result, runError, cases, approvals.length],
  );

  const workflowKeys = useMemo(() => {
    const raw = manifest?.authorized_workflow_keys;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',').map((key) => key.trim()).filter(Boolean);
    return [];
  }, [manifest]);

  return (
    <AiStackCard>
      <AiStackCardHeading
        title={manifest?.name ?? bound.fallbackName}
        hint="The agent this module is bound to, and the same one the chatbot runs. One manifest, one run log, one approval queue."
        actions={
          <button type="button" onClick={reload} className="ais-btn ais-btn--sm">
            <RefreshCw size={14} className={loading ? 'ais-spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="ais-stack ais-b-card-pad">
        {manifestError && (
          <p className="ais-b-callout ais-b-callout--warning" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            {manifestError}
          </p>
        )}

        {manifest && (
          <div className="ais-b-box ais-b-box--inset">
            <div className="ais-row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <span className="ais-b-icon-tile" aria-hidden="true">
                <Bot size={18} />
              </span>
              <div className="ais-b-flex1">
                <p className="ais-b-title">{manifest.name ?? bound.fallbackName}</p>
                <p className="ais-b-xs ais-b-mt1" style={{ marginBottom: 0 }}>
                  {manifest.purpose ?? manifest.description}
                </p>
                <p className="ais-row ais-b-2xs ais-b-mt2" style={{ marginBottom: 0 }}>
                  <span className="ais-mono">{bound.agentKey}</span>
                  <AiStackPill tone="blue">may {String(manifest.max_verb ?? 'recommend')}</AiStackPill>
                  {/* The single most important fact about an agent, so it is stated rather
                      than left to be inferred from the absence of a button. */}
                  <AiStackPill tone={manifest.may_execute_actions ? 'amber' : 'green'}>
                    {manifest.may_execute_actions ? 'can execute actions' : 'cannot act without a person'}
                  </AiStackPill>
                  {workflowKeys.map((key) => (
                    <span key={key} className="ais-b-inline-icon ais-mono">
                      <Workflow size={11} aria-hidden="true" />
                      {key}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="ais-form-grid ais-b-mt4">
              {bound.filters.map((filter) => (
                <Field key={filter.key} label={filter.label}>
                  <TextInput
                    value={filters[filter.key] ?? ''}
                    onChange={(event) => setFilters((current) => ({ ...current, [filter.key]: event.target.value }))}
                    inputMode="numeric"
                    placeholder={filter.placeholder}
                  />
                </Field>
              ))}
            </div>

            <div className="ais-row ais-b-mt3" style={{ gap: 'var(--space-3)' }}>
              <Button
                variant="primary"
                onClick={() => void run()}
                loading={running}
                icon={<Play size={16} aria-hidden="true" />}
              >
                {running ? 'Running…' : 'Run agent'}
              </Button>

              <p className="ais-b-2xs" style={{ margin: 0 }}>
                The organisation comes from your session, not from this form. The sweep reports how much it actually
                read, so &quot;nothing found&quot; is never confused with &quot;nothing read&quot;.
              </p>
            </div>
          </div>
        )}

        <div aria-live="polite" className="ais-stack">
          {runError && (
            <p className="ais-b-callout ais-b-callout--error" role="alert">
              <XCircle size={16} aria-hidden="true" />
              {runError}
            </p>
          )}

          {(result || runError) && <StageTrace stages={stages} />}

          {result && cases.length > 0 && <CaseList cases={cases} />}

          {result && cases.length === 0 && !runError && (
            <p className="ais-b-box ais-b-text" style={{ margin: 0, color: 'var(--content-secondary)' }}>
              {result.result?.message ?? result.summary}
            </p>
          )}
        </div>

        <ApprovalQueue
          approvals={approvals}
          deciding={deciding}
          note={approvalNote}
          onDecide={(approval, decision) => void decide(approval, decision)}
        />

        <RunHistory runs={history} agentName={manifest?.name ?? bound.fallbackName} />
      </div>
    </AiStackCard>
  );
}

/**
 * The stages a run actually passed through, derived from what came back.
 *
 * Every state here is read off the result rather than assumed from a successful HTTP
 * status. A run that opened no case reports `skipped` on the stages that depend on one,
 * and a refused recommendation reports the governance reason — so a partly-completed run
 * is never shown as a finished one.
 */
function buildStages(
  bound: AiStackBoundAgent,
  result: AgentRunResult | null,
  runError: string,
  cases: AgentCase[],
  pendingApprovals: number,
): Stage[] {
  if (runError) {
    return [
      { key: 'request', label: 'Your request', state: 'ran', detail: `Sent to ${bound.fallbackName}.` },
      { key: 'agent', label: 'Agent', state: 'failed', detail: runError },
      { key: 'data', label: 'Records', state: 'pending', detail: 'Not reached.' },
    ];
  }

  if (!result) return [];

  const counters = result.counters ?? {
    signals_detected: 0,
    evidence_collected: 0,
    cases_opened: 0,
    recommendations_drafted: 0,
  };

  const withRecommendation = cases.filter((entry) => entry.recommendation?.id);
  const refused = cases.filter((entry) => entry.recommendation && entry.recommendation.governance_passed === false);
  const awaiting = withRecommendation.filter((entry) => entry.recommendation?.status === 'pending_approval');

  return [
    { key: 'request', label: 'Your request', state: 'ran', detail: bound.sweepDescription },
    {
      key: 'agent',
      label: 'Agent',
      state: result.status === 'completed' ? 'ran' : 'failed',
      detail: `${bound.agentKey} finished as ${result.status}.`,
    },
    {
      key: 'data',
      label: 'Real records',
      state: counters.signals_detected > 0 ? 'ran' : 'skipped',
      detail:
        counters.signals_detected > 0
          ? `${counters.signals_detected} signal(s) raised from the organisation's own records.`
          : 'Nothing in scope met a detector threshold, or too little was recorded to judge.',
    },
    {
      key: 'evidence',
      label: 'Evidence',
      state: counters.evidence_collected > 0 ? 'ran' : 'skipped',
      detail:
        counters.evidence_collected > 0
          ? `${counters.evidence_collected} record(s) stored and cited.`
          : 'Nothing to cite, because nothing was detected.',
    },
    {
      key: 'analysis',
      label: 'Analysis',
      state: counters.cases_opened > 0 ? 'ran' : 'skipped',
      detail:
        counters.cases_opened > 0
          ? `${counters.cases_opened} case(s) opened, each explained from its own cited evidence.`
          : 'No case was warranted at the configured severity.',
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      state: counters.recommendations_drafted > 0 ? 'ran' : refused.length > 0 ? 'failed' : 'skipped',
      detail:
        counters.recommendations_drafted > 0
          ? `${counters.recommendations_drafted} drafted.${refused.length ? ` ${refused.length} refused by governance.` : ''}`
          : refused.length > 0
            ? `${refused.length} refused by governance — see the reason on each case below.`
            : 'Nothing to recommend.',
    },
    {
      key: 'approval',
      label: 'Human approval',
      state: awaiting.length > 0 || pendingApprovals > 0 ? 'pending' : 'skipped',
      detail:
        awaiting.length > 0 || pendingApprovals > 0
          ? `Waiting on a person. ${pendingApprovals} approval(s) in the queue below.`
          : 'Nothing is waiting at this gate.',
    },
    {
      key: 'action',
      label: 'Action',
      state: 'pending',
      // Stated plainly, because "pending" on this row is not a delay — it is the design.
      detail: 'This agent may not act. Anything that follows requires a person approving it.',
    },
  ];
}

function StageTrace({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  return (
    <div className="ais-b-box">
      <p className="ais-b-overline">What happened</p>
      <ol className="ais-b-stages">
        {stages.map((stage, index) => (
          <li key={stage.key} className={`ais-b-stage ais-b-stage--${stage.state}`}>
            <span className="ais-b-stage-num">{index + 1}</span>
            <span className="ais-minw0">
              <span className="ais-b-stage-label">
                {stage.label}
                <span className="ais-b-stage-state">{stage.state}</span>
              </span>
              <span className="ais-b-stage-detail">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CaseList({ cases }: { cases: AgentCase[] }) {
  return (
    <div className="ais-b-stack-sm">
      <p className="ais-b-overline">Cases opened ({cases.length})</p>

      {cases.map((entry) => (
        <div key={entry.case_id} className="ais-b-box">
          <div className="ais-row ais-row--between">
            <p className="ais-b-title">{entry.subject_name ?? entry.subject_label ?? `Case #${entry.case_id}`}</p>
            <div className="ais-row">
              {entry.severity && <AiStackPill tone={severityTone(entry.severity)}>{entry.severity}</AiStackPill>}
              <span className="ais-mono ais-b-2xs">case #{entry.case_id}</span>
            </div>
          </div>

          {/* Every figure here came from the agent's own result. Nothing is recomputed in
              the browser, so this cannot disagree with the case record. */}
          {entry.signals && entry.signals.length > 0 && (
            <p className="ais-b-chips ais-b-mt1" style={{ marginBottom: 0 }}>
              {entry.signals.map((signal, index) => (
                <span key={`${entry.case_id}-${signal.signal_key ?? index}`} className="ais-b-chip ais-b-chip--mono">
                  {signal.signal_key ?? 'signal'}
                  {signal.severity ? ` · ${signal.severity}` : ''}
                </span>
              ))}
            </p>
          )}

          {entry.explanation?.narrative && <p className="ais-b-callout ais-b-mt2">{entry.explanation.narrative}</p>}

          {entry.explanation?.governance_passed === false && entry.explanation.reason_refused && (
            <p className="ais-b-check ais-b-warn ais-b-mt2">
              <TriangleAlert size={12} aria-hidden="true" />
              Explanation refused: {entry.explanation.reason_refused}
            </p>
          )}

          {entry.recommendation && (
            <div className="ais-row ais-b-xs ais-b-mt2">
              <ChevronRight size={14} className="ais-b-faint" aria-hidden="true" />
              <span>{entry.recommendation.title ?? 'Recommendation drafted'}</span>
              <AiStackPill tone={entry.recommendation.status === 'pending_approval' ? 'amber' : 'gray'}>
                {entry.recommendation.status ?? 'drafted'}
              </AiStackPill>
              {entry.recommendation.governance_passed === false && entry.recommendation.reason_refused && (
                <span className="ais-b-warn">refused: {entry.recommendation.reason_refused}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApprovalQueue({
  approvals,
  deciding,
  note,
  onDecide,
}: {
  approvals: PendingApproval[];
  deciding: number | null;
  note: string;
  onDecide: (approval: PendingApproval, decision: 'approved' | 'rejected') => void;
}) {
  return (
    <div className="ais-b-box">
      <p className="ais-b-overline">
        <Gavel size={14} aria-hidden="true" />
        Waiting for a person ({approvals.length})
      </p>

      <div aria-live="polite">
        {note && <p className="ais-b-callout ais-b-callout--info ais-b-mt2">{note}</p>}
      </div>

      {approvals.length === 0 ? (
        <p className="ais-b-xs ais-b-faint ais-b-mt2" style={{ marginBottom: 0 }}>
          Nothing from this workflow is waiting on a decision.
        </p>
      ) : (
        <ul className="ais-b-list-reset ais-b-stack-xs ais-b-mt3">
          {approvals.map((approval) => (
            <li key={approval.id} className="ais-b-approval">
              <div className="ais-minw0">
                <p style={{ margin: 0, fontWeight: 500 }}>
                  Approval #{approval.id} · run #{approval.run_id}
                  {approval.step_key ? ` · ${approval.step_key}` : ''}
                </p>
                <p style={{ margin: '2px 0 0', opacity: 0.8 }}>
                  {approval.subject_entity_key ? `${approval.subject_entity_key} #${approval.subject_id}` : 'no subject'}
                  {approval.case_id ? ` · case #${approval.case_id}` : ''}
                  {approval.expires_at ? ` · expires ${formatWhen(approval.expires_at)}` : ''}
                </p>
              </div>

              <div className="ais-row ais-b-shrink0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onDecide(approval, 'approved')}
                  disabled={deciding === approval.id}
                  icon={<CheckCircle2 size={14} aria-hidden="true" />}
                  aria-label={`Approve approval ${approval.id}`}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onDecide(approval, 'rejected')}
                  disabled={deciding === approval.id}
                  icon={<XCircle size={14} aria-hidden="true" />}
                  aria-label={`Reject approval ${approval.id}`}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunHistory({ runs, agentName }: { runs: Array<Record<string, unknown>>; agentName: string }) {
  return (
    <div className="ais-b-box">
      <p className="ais-b-overline">
        <ShieldCheck size={14} aria-hidden="true" />
        Recent runs of this agent
      </p>

      {runs.length === 0 ? (
        <p className="ais-b-xs ais-b-faint ais-b-mt2" style={{ marginBottom: 0 }}>
          No run of {agentName} has been recorded for this organisation yet.
        </p>
      ) : (
        <ul className="ais-b-list-reset ais-b-stack-xs ais-b-mt3">
          {runs.slice(0, 10).map((entry, index) => {
            const status = String(entry.status ?? 'unknown');

            return (
              <li key={String(entry.id ?? index)} className="ais-row ais-b-xs">
                <AiStackPill
                  tone={status === 'completed' ? 'green' : status === 'rejected' ? 'amber' : status === 'failed' ? 'red' : 'gray'}
                >
                  {status}
                </AiStackPill>
                <span className="ais-mono ais-b-2xs">{String(entry.run_reference ?? entry.id ?? '')}</span>
                <span className="ais-b-faint">{formatWhen(String(entry.started_at ?? entry.created_at ?? ''))}</span>
                <span className="ais-b-truncate ais-minw0">{String(entry.summary ?? entry.error ?? '')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function severityTone(severity: string): 'red' | 'amber' | 'blue' | 'gray' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'red';
    case 'high':
      return 'amber';
    case 'moderate':
      return 'blue';
    default:
      return 'gray';
  }
}

// ---------------------------------------------------------------------------
// Tool-agent preset card
// ---------------------------------------------------------------------------

function PresetCard({
  preset,
  agent,
  runs,
  tools,
  checking,
  busy,
  canCreate,
  canRun,
  onEnable,
  onToggle,
  onRun,
}: {
  preset: CreateAgentInput;
  agent: Agent | null;
  runs: AgentRun[];
  tools: AgentTool[];
  checking: boolean;
  busy: boolean;
  canCreate: boolean;
  canRun: boolean;
  onEnable: () => void;
  onToggle: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
}) {
  const tool = findTool(tools, preset.tools_allowed[0] ?? '');
  const lastRun = agent ? (runs.find((run) => run.agent_id === agent.id) ?? null) : null;

  return (
    <div className="ais-b-preset">
      <div className="ais-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 'var(--space-3)' }}>
        <span className="ais-b-icon-tile" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div className="ais-minw0">
          <h3 className="ais-b-title">{preset.name}</h3>
          <p className="ais-b-xs ais-b-mt1" style={{ marginBottom: 0 }}>
            {preset.description}
          </p>
        </div>
      </div>

      <p className="ais-b-2xs ais-b-mt3" style={{ marginBottom: 0 }}>
        <span className="ais-mono">{tool?.key}</span> ·{' '}
        <span className={tool?.risk === 'read' ? 'ais-b-ok' : undefined}>{tool?.risk} risk</span>
        {tool?.kind === 'mcp' && <> · reads live records</>}
        {agent && (
          <>
            {' '}
            · <span className="ais-mono">{agent.id}</span> ·{' '}
            <span className={agent.status === 'active' ? 'ais-b-ok' : 'ais-b-warn'} style={{ fontWeight: 600 }}>
              {agent.status}
            </span>
          </>
        )}
      </p>

      <div className="ais-b-preset-actions" aria-live="polite">
        {checking ? (
          <span className="ais-b-xs ais-b-faint">Checking…</span>
        ) : agent ? (
          <div className="ais-row">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRun(agent)}
              disabled={busy || agent.status !== 'active' || !canRun}
              icon={<Play size={12} aria-hidden="true" />}
              aria-label={`Run ${agent.name}`}
            >
              Run
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onToggle(agent)}
              disabled={busy || !canRun}
              icon={agent.status === 'active' ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
              aria-label={`${agent.status === 'active' ? 'Pause' : 'Resume'} ${agent.name}`}
            >
              {agent.status === 'active' ? 'Pause' : 'Resume'}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onEnable}
            disabled={busy || !canCreate}
            aria-label={`Enable ${preset.name}`}
          >
            {busy ? 'Enabling…' : 'Enable agent'}
          </Button>
        )}

        {lastRun && (
          <p className="ais-b-2xs ais-b-mt2" style={{ marginBottom: 0 }}>
            Last run{' '}
            <span
              className={lastRun.status === 'success' ? 'ais-b-ok' : lastRun.status === 'denied' ? 'ais-b-warn' : undefined}
              style={{ fontWeight: 600 }}
            >
              {lastRun.status}
            </span>{' '}
            ·{' '}
            {new Date(lastRun.started_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            by {lastRun.acting_user_name || lastRun.acting_user_id}
            {lastRun.error && (
              <span className="ais-b-warn ais-b-mt1" style={{ display: 'block' }}>
                {lastRun.error}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
