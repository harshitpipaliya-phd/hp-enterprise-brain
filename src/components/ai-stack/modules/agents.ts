import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Automation › Agent Monitor. Report source: `agents.runs` —
 * hpbrain_executors (human, system, AI and external) with status, trust level, current
 * workload against capacity, and counts of their runs, completed runs and failed runs
 * from hpbrain_eso_executions, with the last run date.
 */
export const agentsAiStack: AiStackModule = {
  key: 'agents',
  menuSlug: 'agents',
  label: 'Agent Monitor',
  records: 'executors',
  record: 'executor',
  route: 'agents',
  subjectEntityKey: 'executor',

  copy: {
    centralRisk:
      'judging an executor by its run counts. Failed runs and workload are operational records, not a performance rating; no answer may call an executor — least of all a human one — unreliable or underperforming, or raise or lower a trust level the record does not carry.',
    policyNamePlaceholder: 'Executor monitoring language policy',
    promptSystemDefault:
      'You describe the executors that carry out work. State each executor\'s type, status, trust level, workload, capacity and run counts exactly as recorded; never rate an executor\'s performance, never blame one for failed runs, and never change a trust level in what you say.',
    reportCanPrint: 'the trust levels, workloads and run counts come from the executor and execution records rather than from a model.',
    groundedOn: 'the executor records above — who or what carries out work, how loaded it is, how far it is trusted, and how its runs have ended.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Agent Monitor, so nothing here opens a case. The read-only tool agent on the Automations tab still reads agents.runs.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Agent Monitor, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads agents.runs.',
  },

  report: {
    defaultDataSource: 'agents.runs',
    filters: [
      { key: 'executor_type', label: 'Executor type', kind: 'text', placeholder: 'human, system, ai or external' },
      { key: 'status', label: 'Executor status', kind: 'text', placeholder: 'e.g. active' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'agents_report',
    emptyNote: 'No executors matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Executor run reader',
      description: 'Reads executors with type, status, trust level, workload and their run, completed and failed counts. Changes nothing.',
      module: 'agents',
      tools_allowed: ['agents.runs'],
      instructions:
        'Report executors and their run counts exactly as recorded. Failed runs are a count, not a verdict — never rate an executor, and never describe a human executor as underperforming.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Executors are readable, but HP Brain has no domain agent or approval workflow for the Agent Monitor — the agent here is the read-only tool agent below, which reads agents.runs and changes nothing.',

  operations: {
    agents_report: { key: 'agents_report', label: 'Executor run register', capability: null, uses: 'report_template', prefers: ['executor', 'agent'] },
    agents_note: { key: 'agents_note', label: 'Executor activity summarised', capability: 'generative', uses: 'prompt', prefers: ['executor'] },
    agents_agent_run: { key: 'agents_agent_run', label: 'Agent Monitor agent run', capability: 'agent', uses: 'agent' },
  },
};
