import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Foundation › Departments. The Departments screen is the organisation's
 * structure: each unit, its parent and whether it is active. Report source:
 * `departments.roster` — the same rows the Departments screen lists, with a count of the
 * active people recorded against each unit.
 */
export const departmentsAiStack: AiStackModule = {
  key: 'departments',
  menuSlug: 'departments',
  label: 'Departments',
  records: 'departments',
  record: 'department',
  route: 'departments',
  subjectEntityKey: 'department',

  copy: {
    centralRisk:
      "reading a department's size as a judgement of it. A headcount is how many people are recorded against a unit, not how well it is staffed or run, and no answer may call a department under-resourced, bloated or failing from the roster alone.",
    policyNamePlaceholder: 'Department structure reporting policy',
    promptSystemDefault:
      "You describe an organisation's department structure. Work only from the department rows you are given — name, parent, status and people count — never invent a reporting line the parent field does not show, and never judge a department by its size.",
    reportCanPrint: 'the parents, statuses and people counts come from the department records rather than from a model.',
    groundedOn: 'the department records above — each unit, its parent, its status and how many people are recorded in it.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Departments, so nothing here opens a case. The read-only tool agent on the Automations tab still reads departments.roster.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Departments, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads departments.roster.',
  },

  report: {
    defaultDataSource: 'departments.roster',
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'active or inactive' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'departments_report',
    emptyNote: 'No departments matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Department roster reader',
      description: 'Reads every department with its parent, status and how many active people it has. Changes nothing.',
      module: 'departments',
      tools_allowed: ['departments.roster'],
      instructions:
        'Report departments exactly as recorded. A blank parent is a top-level unit, not a missing one. A people count is a record count — never describe a department as understaffed or overstaffed from it.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Departments are readable, but HP Brain has no domain agent or approval workflow for Departments — the agent here is the read-only tool agent below, which reads departments.roster and changes nothing.',

  operations: {
    departments_report: { key: 'departments_report', label: 'Department roster', capability: null, uses: 'report_template', prefers: ['department', 'roster'] },
    departments_note: { key: 'departments_note', label: 'Department structure explained', capability: 'generative', uses: 'prompt', prefers: ['department'] },
    departments_agent_run: { key: 'departments_agent_run', label: 'Departments agent run', capability: 'agent', uses: 'agent' },
  },
};
