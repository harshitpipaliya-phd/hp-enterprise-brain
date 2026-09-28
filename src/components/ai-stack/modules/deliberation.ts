import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Intelligence Loop › Deliberation. Report source: `deliberation.open_cases`
 * — open hpbrain_cases with the signal each began from and counts of its hypotheses
 * (hpbrain_hypotheses), how many are still proposed or supported, and its reasoning steps
 * (hpbrain_reasoning_steps).
 */
export const deliberationAiStack: AiStackModule = {
  key: 'deliberation',
  menuSlug: 'deliberation',
  label: 'Deliberation',
  records: 'open cases',
  record: 'case',
  route: 'deliberation',
  subjectEntityKey: 'case',

  copy: {
    centralRisk:
      'picking a hypothesis as concluded. A case is open because its hypotheses are still being weighed, and no answer may declare one of them the explanation, rank one as the winner, or describe the case as decided — that is for the people deliberating.',
    policyNamePlaceholder: 'Deliberation neutrality policy',
    promptSystemDefault:
      "You describe open investigation cases. State each case's title, status, originating signal and its hypothesis and reasoning-step counts as recorded; never say which hypothesis is right, never rank hypotheses, and never describe an open case as concluded.",
    reportCanPrint: 'the case statuses and the hypothesis and reasoning-step counts come from the case records rather than from a model.',
    groundedOn: 'the open case records above — what is under investigation, from which signal, and how many hypotheses and reasoning steps it has.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Deliberation, so nothing here opens a case. The read-only tool agent on the Automations tab still reads deliberation.open_cases.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Deliberation, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads deliberation.open_cases.',
  },

  report: {
    defaultDataSource: 'deliberation.open_cases',
    filters: [
      { key: 'status', label: 'Case status', kind: 'text', placeholder: 'open, investigating or hypothesized' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'deliberation_report',
    emptyNote: 'No open cases matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Open case reader',
      description: 'Reads open cases with their originating signal and counts of hypotheses, open hypotheses and reasoning steps. Changes nothing.',
      module: 'deliberation',
      tools_allowed: ['deliberation.open_cases'],
      instructions:
        'Report open cases exactly as recorded. A case with open hypotheses is undecided — never say which hypothesis is correct or likeliest, and never call a case concluded.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Open cases are readable, but HP Brain has no domain agent or approval workflow for Deliberation — the agent here is the read-only tool agent below, which reads deliberation.open_cases and changes nothing.',

  operations: {
    deliberation_report: { key: 'deliberation_report', label: 'Open case register', capability: null, uses: 'report_template', prefers: ['case', 'deliberation'] },
    deliberation_note: { key: 'deliberation_note', label: 'Case status summarised', capability: 'generative', uses: 'prompt', prefers: ['case'] },
    deliberation_agent_run: { key: 'deliberation_agent_run', label: 'Deliberation agent run', capability: 'agent', uses: 'agent' },
  },
};
