import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Automation › Task Orchestrator. Report source: `tasks.queue` — imported
 * operational work items (hpbrain_operational_records) not yet closed, with reference,
 * dataset, category, status and the owner and department they are attributed to, oldest
 * first.
 */
export const tasksAiStack: AiStackModule = {
  key: 'tasks',
  menuSlug: 'tasks',
  label: 'Task Orchestrator',
  records: 'work items',
  record: 'work item',
  route: 'tasks',
  subjectEntityKey: 'operational_record',

  copy: {
    centralRisk:
      'turning the age of a work item into blame. An open item is attributed to an owner and department as imported; no answer may call its owner slow or negligent, reassign it, or present it as overdue against a deadline the record does not carry.',
    policyNamePlaceholder: 'Work queue reporting policy',
    promptSystemDefault:
      'You summarise the open work queue. State each item\'s reference, dataset, category, status, owner, department and date exactly as recorded; never judge the owner, never invent a due date, and never suggest the item be reassigned.',
    reportCanPrint: 'the categories, statuses, owners, departments and dates come from the operational records rather than from a model.',
    groundedOn: 'the open work item records above — what is outstanding, in which category, attributed to whom, and since when.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Task Orchestrator, so nothing here opens a case. The read-only tool agent on the Automations tab still reads tasks.queue.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Task Orchestrator, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads tasks.queue.',
  },

  report: {
    defaultDataSource: 'tasks.queue',
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'e.g. open' },
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'all categories' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'tasks_report',
    emptyNote: 'No open work items matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Work queue reader',
      description: 'Reads open operational work items with category, status, owner, department and date. Changes nothing.',
      module: 'tasks',
      tools_allowed: ['tasks.queue'],
      instructions:
        'Report open work items exactly as recorded, oldest first. An old item is old, not late — never invent a deadline, never judge its owner, and never propose reassigning it.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The work queue is readable, but HP Brain has no domain agent or approval workflow for the Task Orchestrator — the agent here is the read-only tool agent below, which reads tasks.queue and changes nothing.',

  operations: {
    tasks_report: { key: 'tasks_report', label: 'Open work queue', capability: null, uses: 'report_template', prefers: ['task', 'queue'] },
    tasks_note: { key: 'tasks_note', label: 'Work queue summarised', capability: 'generative', uses: 'prompt', prefers: ['task'] },
    tasks_agent_run: { key: 'tasks_agent_run', label: 'Task Orchestrator agent run', capability: 'agent', uses: 'agent' },
  },
};
