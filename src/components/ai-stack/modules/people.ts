import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Foundation › People. Report source: `people.directory` — the roster only:
 * name, department, role, position and how complete each record is, with the fields it is
 * missing. Contact details (email, phone, address) are never part of this source, so no
 * report, prompt or agent here can print them.
 */
export const peopleAiStack: AiStackModule = {
  key: 'people',
  menuSlug: 'people',
  label: 'People',
  records: 'people',
  record: 'person',
  route: 'people',
  subjectEntityKey: 'person',

  copy: {
    centralRisk:
      'inferring performance or personal traits from roster fields. A role, a position or an incomplete record says what has been recorded about someone, not how good they are at their work or what kind of person they are — and the roster carries no contact details, so none may be guessed or supplied.',
    policyNamePlaceholder: 'People roster use policy',
    promptSystemDefault:
      'You describe the people roster of an organisation. Work only from the name, department, role, position and record completeness you are given; never infer performance, seniority beyond the recorded position, or any personal trait, and never state an email, phone number or address — the roster holds none.',
    reportCanPrint: 'the departments, roles, positions and completeness figures come from the people records rather than from a model.',
    groundedOn: 'the people records above — who is recorded, in which department and role, and which fields of their record are missing. No contact details.',
    capabilityAgent:
      'HP Brain has no domain agent bound to People, so nothing here opens a case. The read-only tool agent on the Automations tab still reads people.directory.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to People, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads people.directory.',
  },

  report: {
    defaultDataSource: 'people.directory',
    filters: [
      { key: 'department_id', label: 'Department id', kind: 'text', placeholder: 'all departments' },
      { key: 'completeness', label: 'Record completeness', kind: 'text', placeholder: 'complete or incomplete' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'people_report',
    emptyNote: 'No people matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'People directory reader',
      description: 'Reads the roster — name, department, role, position and record completeness, never contact details. Changes nothing.',
      module: 'people',
      tools_allowed: ['people.directory'],
      instructions:
        'Report the roster exactly as recorded. An incomplete record is a data gap to be filled, not a fact about the person — name the missing fields, nothing more. Never infer performance or personal traits, and never supply contact details: the roster has none.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The roster is readable, but HP Brain has no domain agent or approval workflow for People — the agent here is the read-only tool agent below, which reads people.directory (roster only, no contact details) and changes nothing.',

  operations: {
    people_report: { key: 'people_report', label: 'People roster', capability: null, uses: 'report_template', prefers: ['people', 'roster'] },
    people_note: { key: 'people_note', label: 'Roster completeness explained', capability: 'generative', uses: 'prompt', prefers: ['people'] },
    people_agent_run: { key: 'people_agent_run', label: 'People agent run', capability: 'agent', uses: 'agent' },
  },
};
