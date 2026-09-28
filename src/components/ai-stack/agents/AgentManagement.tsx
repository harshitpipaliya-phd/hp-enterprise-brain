import React, { useCallback, useMemo, useState } from 'react';
import { Activity, BarChart3, Bot, Play, Plus, RefreshCw, ScrollText, type LucideIcon } from 'lucide-react';

import { Button, Modal } from '../../../ui';
import { fetchAgents, fetchRunsIndex, setAgentStatus, type AgentRunsSummary } from '../../../api/aiStack/agents';
import type { Agent, AgentRun, AgentStatus } from '../../../api/aiStack/agentTypes';
import { AGENT_MODULES, findModule, findTool, type AgentTool } from '../agentRegistry';
import { useAiStackProfile } from '../profile-context';

import { BreakdownBars, Card, ErrorState, HeroHeader, LoadingState, MetricTiles, Pill } from './primitives';
import { useBrainResource } from './useBrainResource';
import { CreateAgentForm, RiskPill } from './CreateAgentForm';
import { RunAgentDialog } from './RunAgentDialog';

/**
 * Agent Management — the one surface every module's agents share.
 *
 * Five tabs, the shape of a mature agent console: the Library (every configured
 * agent), a Dashboard (what ran, how it went), Create agent, the Run log (the
 * audit record, row per execution) and Analytics (runs by module, agent and
 * outcome).
 *
 * A module's own screen embeds this same component with `moduleFilter` set, so
 * one module sees only its own agents and can only create its own agents — and
 * there is still exactly one engine, one store and one log behind both views.
 */

type TabKey = 'library' | 'dashboard' | 'create' | 'runs' | 'analytics';

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'library', label: 'Agentic library', icon: Bot },
  { key: 'dashboard', label: 'Agent dashboard', icon: Activity },
  { key: 'create', label: 'Create agent', icon: Plus },
  { key: 'runs', label: 'Run log', icon: ScrollText },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export function AgentManagement({
  moduleFilter,
  embedded = false,
  initialTab = 'library',
}: {
  /** Restrict every tab to one module (and lock Create agent to it). */
  moduleFilter?: string;
  /** Skip the hero header when rendered inside another module's page. */
  embedded?: boolean;
  initialTab?: TabKey;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [running, setRunning] = useState<Agent | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Always rendered beneath a module's AI Stack (see agentRegistry.ts's note on
  // AGENT_MODULES) — this module's own profile, for the tool catalogue tool chips
  // and the Run dialog read rather than a compiled-in list.
  const profile = useAiStackProfile();

  const agents = useBrainResource(() => fetchAgents({ module: moduleFilter }), [moduleFilter]);
  const runsIndex = useBrainResource(() => fetchRunsIndex({ module: moduleFilter, limit: 200 }), [moduleFilter]);

  const refresh = useCallback(() => {
    agents.refresh();
    runsIndex.refresh();
  }, [agents, runsIndex]);

  const changeStatus = useCallback(
    async (agent: Agent, status: AgentStatus) => {
      setNote(null);
      try {
        await setAgentStatus(agent.id, status);
        setNote(`${agent.name} is now ${status}.`);
        agents.refresh();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      }
    },
    [agents],
  );

  const moduleLabel = moduleFilter ? (findModule(moduleFilter)?.label ?? moduleFilter) : null;
  const agentRows = agents.data ?? [];
  const runRows = runsIndex.data?.runs ?? [];
  const runSummary = runsIndex.data?.summary ?? null;

  const body = (() => {
    if ((agents.loading && !agents.data) || (runsIndex.loading && !runsIndex.data)) return <LoadingState label="Loading agents" />;
    if (agents.error && !agents.data) return <ErrorState message={agents.error} onRetry={refresh} />;

    switch (tab) {
      case 'library':
        return (
          <LibraryTab
            agents={agentRows}
            runs={runRows}
            tools={profile.tools}
            onRun={setRunning}
            onStatus={changeStatus}
            onCreate={() => setTab('create')}
          />
        );
      case 'dashboard':
        return <DashboardTab agents={agentRows} runs={runRows} summary={runSummary} moduleLabel={moduleLabel} />;
      case 'create':
        return (
          <CreateAgentForm
            lockedModule={moduleFilter}
            onCreated={(agent) => {
              setNote(`${agent.name} created as ${agent.id}${agent.status === 'active' ? ' and activated' : ''}.`);
              agents.refresh();
              setTab('library');
            }}
          />
        );
      case 'runs':
        return <RunLogTab runs={runRows} error={runsIndex.error} />;
      case 'analytics':
        return <AnalyticsTab agents={agentRows} runs={runRows} summary={runSummary} />;
    }
  })();

  const refreshing = agents.refreshing || runsIndex.refreshing;

  return (
    <div className={embedded ? undefined : 'ais-b-am--page'}>
      {!embedded && (
        <HeroHeader
          breadcrumb="HP Brain · Automation"
          title="Agent management"
          description="Configure agents per module, decide which tools each may call, and see every run — recorded against the person who ran it, under that module's rights."
          actions={<RefreshButton onClick={refresh} refreshing={refreshing} />}
          meta={
            <>
              <span>{agentRows.length} agents</span>
              <span>{runRows.length} runs logged</span>
              {moduleLabel && <span>Scoped to {moduleLabel}</span>}
            </>
          }
        />
      )}

      <div className="ais-b-am-bar">
        <nav className="ais-b-am-tabs" aria-label="Agent management sections">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
              className="ais-b-am-tab"
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        {embedded && <RefreshButton onClick={refresh} refreshing={refreshing} />}
      </div>

      <div aria-live="polite">
        {note && <p className="ais-b-callout ais-b-callout--info ais-b-callout--lg ais-b-am-note">{note}</p>}
      </div>

      {body}

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={() => setRunning(null)}
          onRan={() => {
            runsIndex.refresh();
          }}
        />
      )}
    </div>
  );
}

function RefreshButton({ onClick, refreshing }: { onClick: () => void; refreshing: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={refreshing} className="ais-btn ais-btn--sm">
      <RefreshCw size={14} className={refreshing ? 'ais-spin' : undefined} aria-hidden="true" />
      Refresh
    </button>
  );
}

// ---- Library ---------------------------------------------------------------

const STATUS_TONE: Record<AgentStatus, 'gray' | 'blue' | 'green' | 'amber'> = {
  draft: 'gray',
  active: 'green',
  paused: 'amber',
  archived: 'gray',
};

function LibraryTab({
  agents,
  runs,
  tools,
  onRun,
  onStatus,
  onCreate,
}: {
  agents: Agent[];
  runs: AgentRun[];
  tools: AgentTool[];
  onRun: (agent: Agent) => void;
  onStatus: (agent: Agent, status: AgentStatus) => void;
  onCreate: () => void;
}) {
  const lastRunByAgent = useMemo(() => {
    const map = new Map<string, AgentRun>();
    for (const run of runs) if (!map.has(run.agent_id)) map.set(run.agent_id, run);
    return map;
  }, [runs]);

  if (!agents.length) {
    return (
      <Card className="ais-b-empty-card">
        <Bot size={28} aria-hidden="true" />
        <p className="ais-empty-title">No agents yet</p>
        <p className="ais-empty-body">Create the first one. It runs only when a person presses Run, and only as that person.</p>
        <div className="ais-empty-action">
          <Button variant="primary" size="sm" onClick={onCreate}>
            Create agent
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="ais-b-overflow">
      <div className="ais-table-wrap">
        <table className="ais-table ais-b-minw-64 ais-b-td-tight">
          <thead>
            <tr>
              {['Id', 'Name', 'Module', 'Tenant', 'Tools allowed', 'Status', 'Created by', 'Created', 'Last run', 'Actions'].map((label) => (
                <th key={label} scope="col" className="ais-th">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const last = lastRunByAgent.get(agent.id);
              return (
                <tr key={agent.id}>
                  <td className="ais-mono ais-muted">{agent.id}</td>
                  <td>
                    <p className="ais-b-strong" style={{ margin: 0 }}>{agent.name}</p>
                    {agent.description && <p className="ais-b-xs" style={{ margin: 0 }}>{agent.description}</p>}
                  </td>
                  <td>{findModule(agent.module)?.label ?? agent.module}</td>
                  <td className="ais-mono ais-muted">{agent.tenant_id}</td>
                  <td>
                    <div className="ais-b-chips">
                      {agent.tools_allowed.map((key) => {
                        const tool = findTool(tools, key);
                        return (
                          <span key={key} title={key} className="ais-b-chip">
                            {tool?.label ?? key}
                            {tool && <RiskPill risk={tool.risk} />}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <Pill tone={STATUS_TONE[agent.status]}>{agent.status}</Pill>
                  </td>
                  <td>{agent.created_by_name || <span className="ais-mono">{agent.created_by}</span>}</td>
                  <td className="ais-b-nowrap ais-b-xs">{formatWhen(agent.created_at)}</td>
                  <td className="ais-b-nowrap ais-b-xs">
                    {last ? (
                      <>
                        <RunStatusPill status={last.status} /> <span>{formatWhen(last.started_at)}</span>
                      </>
                    ) : (
                      <span className="ais-faint">—</span>
                    )}
                  </td>
                  <td className="ais-b-nowrap">
                    <div className="ais-b-am-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onRun(agent)}
                        disabled={agent.status !== 'active'}
                        icon={<Play size={12} aria-hidden="true" />}
                        aria-label={`Run ${agent.name}`}
                      >
                        Run
                      </Button>
                      {agent.status === 'draft' && <SmallButton label={`Activate ${agent.name}`} onClick={() => onStatus(agent, 'active')}>Activate</SmallButton>}
                      {agent.status === 'active' && <SmallButton label={`Pause ${agent.name}`} onClick={() => onStatus(agent, 'paused')}>Pause</SmallButton>}
                      {agent.status === 'paused' && <SmallButton label={`Resume ${agent.name}`} onClick={() => onStatus(agent, 'active')}>Resume</SmallButton>}
                      {agent.status !== 'archived' && <SmallButton label={`Archive ${agent.name}`} onClick={() => onStatus(agent, 'archived')}>Archive</SmallButton>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SmallButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} aria-label={label}>
      {children}
    </Button>
  );
}

// ---- Dashboard -------------------------------------------------------------

/**
 * `summary` is the backend's own totals over EVERY run the filters match, counted in
 * SQL — not the (capped) page of `runs` this tab also received. It should be present
 * whenever the runs store exists at all (`AiStackToolAgentController::runs()` always
 * returns one, even when empty), so "—" here means the summary itself is genuinely
 * absent, not a stand-in for a real zero.
 */
function DashboardTab({
  agents,
  runs,
  summary,
  moduleLabel,
}: {
  agents: Agent[];
  runs: AgentRun[];
  summary: AgentRunsSummary | null;
  moduleLabel: string | null;
}) {
  const summaryAvailable = summary !== null;
  const successRate = summary && summary.total > 0 ? Math.round((summary.succeeded / summary.total) * 100) : 0;
  const avgKnown = summary?.avg_duration_ms !== null && summary?.avg_duration_ms !== undefined;

  return (
    <>
      <MetricTiles
        metrics={[
          { key: 'agents', label: 'Agents', value: agents.length, hint: moduleLabel ? `in ${moduleLabel}` : 'all modules' },
          { key: 'active', label: 'Active', value: agents.filter((agent) => agent.status === 'active').length },
          { key: 'total', label: 'Total runs', value: summary?.total ?? 0, available: summaryAvailable },
          { key: 'today', label: 'Runs today', value: summary?.today ?? 0, available: summaryAvailable },
          {
            key: 'rate',
            label: 'Success rate',
            value: successRate,
            available: summaryAvailable,
            hint: summary ? `${summary.succeeded} of ${summary.total} runs` : undefined,
          },
          { key: 'denied', label: 'Denied', value: summary?.denied ?? 0, available: summaryAvailable, hint: 'refused by rights' },
          {
            key: 'avg',
            label: 'Avg duration',
            value: summary?.avg_duration_ms ?? 0,
            available: avgKnown,
            hint: avgKnown ? 'milliseconds' : undefined,
          },
          { key: 'users', label: 'Distinct users', value: summary?.distinct_users ?? 0, available: summaryAvailable },
        ]}
      />
      <h2 className="ais-b-h3">
        Recent runs <span className="ais-faint" style={{ fontWeight: 400 }}>({Math.min(runs.length, 10)})</span>
      </h2>
      <RunTable runs={runs.slice(0, 10)} compact />
    </>
  );
}

// ---- Run log ---------------------------------------------------------------

function RunLogTab({ runs, error }: { runs: AgentRun[]; error: string }) {
  const [open, setOpen] = useState<AgentRun | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (error && !runs.length) return <ErrorState message={error} />;
  return (
    <>
      <RunTable runs={runs} onOpen={setOpen} />
      {open && <RunDetail run={open} onClose={close} />}
    </>
  );
}

function RunStatusPill({ status }: { status: AgentRun['status'] }) {
  return <Pill tone={status === 'success' ? 'green' : status === 'denied' ? 'amber' : 'gray'}>{status}</Pill>;
}

function RunTable({ runs, compact = false, onOpen }: { runs: AgentRun[]; compact?: boolean; onOpen?: (run: AgentRun) => void }) {
  if (!runs.length) {
    return (
      <Card className="ais-b-card-pad">
        <p className="ais-b-text ais-faint" style={{ margin: 0 }}>
          No runs logged yet. Every run — allowed or refused — is recorded here with the person who made it.
        </p>
      </Card>
    );
  }

  return (
    <Card className="ais-b-overflow">
      <div className={compact ? 'ais-b-scroll' : 'ais-b-scroll ais-b-scroll-36'}>
        <table className="ais-table ais-b-minw-64 ais-b-sticky-head ais-b-td-tight">
          <thead>
            <tr>
              {['Run', 'Agent', 'Module', 'Tenant', 'When', 'Acting user', 'Input', 'Output', 'Result'].map((label) => (
                <th key={label} scope="col" className="ais-th">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                onClick={onOpen ? () => onOpen(run) : undefined}
                onKeyDown={
                  onOpen
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpen(run);
                        }
                      }
                    : undefined
                }
                tabIndex={onOpen ? 0 : undefined}
                aria-label={onOpen ? `Open run ${run.id}` : undefined}
                className={onOpen ? 'ais-b-row-click' : undefined}
              >
                <td className="ais-mono ais-muted">{run.id}</td>
                <td>
                  <p className="ais-b-strong" style={{ margin: 0 }}>{run.agent_name}</p>
                  <p className="ais-mono ais-b-3xs" style={{ margin: 0 }}>{run.agent_id}</p>
                </td>
                <td>{findModule(run.module)?.label ?? run.module}</td>
                <td className="ais-mono ais-muted">{run.tenant_id}</td>
                <td className="ais-b-nowrap ais-b-xs">
                  {formatWhen(run.started_at)}
                  <span className="ais-faint"> · {run.duration_ms} ms</span>
                </td>
                <td>
                  <p style={{ margin: 0 }}>{run.acting_user_name || <span className="ais-mono">{run.acting_user_id}</span>}</p>
                  <p className="ais-b-2xs" style={{ margin: 0 }}>
                    {run.acting_profile_name || 'role unknown'} · user <span className="ais-mono">{run.acting_user_id}</span>
                  </p>
                </td>
                <td className="ais-b-cell-trunc ais-mono ais-muted" title={JSON.stringify(run.input)}>
                  {summariseInput(run)}
                </td>
                <td className="ais-b-cell-trunc ais-b-xs" title={run.output ? JSON.stringify(run.output) : run.error ?? ''}>
                  {run.output ? summariseOutput(run.output) : <span className="ais-b-warn">{run.error}</span>}
                </td>
                <td>
                  <RunStatusPill status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onOpen && <p className="ais-b-table-foot">Select a run to see its full input and output.</p>}
    </Card>
  );
}

function RunDetail({ run, onClose }: { run: AgentRun; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={run.id}
      description={`${run.agent_name} · ${findModule(run.module)?.label ?? run.module} · tenant ${run.tenant_id} · ${formatWhen(run.started_at)} · ${run.duration_ms} ms`}
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="ais-b-stack-sm">
        <p className="ais-b-xs" style={{ margin: 0 }}>
          <RunStatusPill status={run.status} />{' '}
          Run by {run.acting_user_name || 'user'} <span className="ais-mono">{run.acting_user_id}</span> as{' '}
          {run.acting_profile_name || 'unknown role'}
          {run.acting_profile_id && <span className="ais-mono"> ({run.acting_profile_id})</span>} · trigger {run.trigger}
        </p>
        <div className="ais-grid-2">
          <div>
            <p className="ais-b-overline">Input</p>
            <pre className="ais-pre ais-b-pre-scroll ais-b-mt1">{JSON.stringify(run.input, null, 2)}</pre>
            <p className="ais-b-2xs ais-b-mt2">Tools used: {run.tools_used.length ? run.tools_used.join(', ') : 'none'}</p>
          </div>
          <div>
            <p className="ais-b-overline">{run.output ? 'Output' : 'Error'}</p>
            <pre className={`ais-pre ais-b-pre-scroll ais-b-mt1${run.output ? '' : ' ais-b-pre-warn'}`}>
              {run.output ? JSON.stringify(run.output, null, 2) : run.error}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Analytics -------------------------------------------------------------

/**
 * `summary` (the backend's totals over every matching run) drives the two headline
 * tiles that have a real backend total to draw on; the four breakdowns below them have
 * no backend "group by module/agent/user/outcome" endpoint, so they are still counted
 * over the fetched page and say so in their heading when the page might not be
 * everything.
 */
function AnalyticsTab({ agents, runs, summary }: { agents: Agent[]; runs: AgentRun[]; summary: AgentRunsSummary | null }) {
  const byModule = AGENT_MODULES.map((module) => ({ label: module.label, value: runs.filter((run) => run.module === module.key).length })).filter((row) => row.value);
  const byAgent = agents.map((agent) => ({ label: agent.name, value: runs.filter((run) => run.agent_id === agent.id).length })).sort((a, b) => b.value - a.value);
  const byOutcome = (['success', 'failure', 'denied'] as const).map((status) => ({ label: status, value: runs.filter((run) => run.status === status).length }));
  const byUser = Object.entries(
    runs.reduce<Record<string, number>>((acc, run) => {
      const key = run.acting_user_name || run.acting_user_id || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const pageIsPartial = summary !== null && summary.total > runs.length;
  const avgKnown = summary?.avg_duration_ms !== null && summary?.avg_duration_ms !== undefined;

  return (
    <>
      <MetricTiles
        metrics={[
          { key: 'runs', label: 'Total runs', value: summary?.total ?? 0, available: summary !== null },
          {
            key: 'avg',
            label: 'Avg duration',
            value: summary?.avg_duration_ms ?? 0,
            available: avgKnown,
            hint: avgKnown ? 'milliseconds' : undefined,
          },
          { key: 'agents', label: 'Agents run', value: byAgent.filter((row) => row.value).length, hint: `of ${agents.length}` },
          { key: 'users', label: 'Distinct users', value: summary?.distinct_users ?? 0, available: summary !== null },
        ]}
      />
      <div className="ais-grid-2">
        <AnalyticsPanel title="Runs by outcome" data={byOutcome} partial={pageIsPartial} />
        <AnalyticsPanel title="Runs by module" data={byModule} partial={pageIsPartial} />
        <AnalyticsPanel title="Runs by agent" data={byAgent} partial={pageIsPartial} />
        <AnalyticsPanel title="Runs by acting user" data={byUser} partial={pageIsPartial} />
      </div>
    </>
  );
}

function AnalyticsPanel({
  title,
  data,
  partial,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  /** True when more runs exist than this breakdown could see — say so, not a silent undercount. */
  partial?: boolean;
}) {
  return (
    <Card className="ais-b-overflow">
      <div className="ais-b-panel-head">
        <h2 className="ais-b-title">{title}</h2>
        {partial && <span className="ais-b-2xs ais-faint">of the most recent runs fetched, not every run</span>}
      </div>
      <BreakdownBars data={data} />
    </Card>
  );
}

// ---- Helpers ---------------------------------------------------------------

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function summariseInput(run: AgentRun): string {
  const tool = typeof run.input.tool === 'string' ? run.input.tool : '';
  const args = run.input.arguments && typeof run.input.arguments === 'object' ? (run.input.arguments as Record<string, unknown>) : {};
  const keys = Object.keys(args);
  return `${tool || '(no tool)'}${keys.length ? ` · ${keys.join(', ')}` : ''}`;
}

function summariseOutput(output: Record<string, unknown>): string {
  if (typeof output.message === 'string') return output.message.replace(/\s+/g, ' ').trim();
  return Object.entries(output)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}
