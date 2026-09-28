import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Intelligence Loop › Execution Center. Report source: `executions.outcomes`
 * — hpbrain_eso_executions with the ESO run, status, executor type, start and completion
 * dates, the decision behind each and the latest outcome recorded against that decision.
 */
export const executionsAiStack: AiStackModule = {
  key: 'executions',
  menuSlug: 'executions',
  label: 'Execution Center',
  records: 'executions',
  record: 'execution',
  route: 'executions',
  subjectEntityKey: 'eso_execution',

  copy: {
    centralRisk:
      'claiming an execution caused an outcome. An outcome is recorded against the decision an execution served; no answer may say the execution produced it, call a running execution successful, or describe a failed or rolled-back one as anyone\'s fault.',
    policyNamePlaceholder: 'Execution outcome reporting policy',
    promptSystemDefault:
      'You summarise ESO executions and the outcomes recorded against their decisions. State each execution\'s ESO, status, executor type, dates and recorded outcome as given; never claim an execution caused an outcome, never call a running execution a success, and never assign blame for a failure.',
    reportCanPrint: 'the statuses, executor types, dates and outcomes come from the execution and outcome records rather than from a model.',
    groundedOn: 'the execution records above — which ESO ran, by what kind of executor, when, for which decision, and the outcome recorded for it.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Execution Center, so nothing here opens a case. The read-only tool agent on the Automations tab still reads executions.outcomes.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Execution Center, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads executions.outcomes.',
  },

  report: {
    defaultDataSource: 'executions.outcomes',
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'running, completed, failed or rolled_back' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'executions_report',
    emptyNote: 'No executions matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Execution outcome reader',
      description: 'Reads ESO executions with status, executor type, dates, decision and the latest recorded outcome. Changes nothing.',
      module: 'executions',
      tools_allowed: ['executions.outcomes'],
      instructions:
        'Report executions and outcomes exactly as recorded. A blank outcome means none has been measured yet. Never say an execution caused an outcome, and never blame anyone for a failed or rolled-back run.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Executions are readable, but HP Brain has no domain agent or approval workflow for the Execution Center — the agent here is the read-only tool agent below, which reads executions.outcomes and changes nothing.',

  operations: {
    executions_report: { key: 'executions_report', label: 'Execution and outcome register', capability: null, uses: 'report_template', prefers: ['execution', 'outcome'] },
    executions_note: { key: 'executions_note', label: 'Execution outcome summarised', capability: 'generative', uses: 'prompt', prefers: ['execution'] },
    executions_agent_run: { key: 'executions_agent_run', label: 'Execution Center agent run', capability: 'agent', uses: 'agent' },
  },
};
