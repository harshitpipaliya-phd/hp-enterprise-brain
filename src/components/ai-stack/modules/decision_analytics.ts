import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Analytics › Decision Intelligence. Report source: `decisions.outcomes` —
 * hpbrain_decisions recorded through the governance gate, with the recommendation
 * decided, executor type, status, confidence, approval date, the latest outcome measured
 * and how many outcomes have been recorded.
 */
export const decisionAnalyticsAiStack: AiStackModule = {
  key: 'decision_analytics',
  menuSlug: 'decisionintel',
  label: 'Decision Intelligence',
  records: 'decisions',
  record: 'decision',
  route: 'decisionintel',
  subjectEntityKey: 'decision',

  copy: {
    centralRisk:
      'judging a decision by an outcome that has not been measured. A decision with no recorded outcome is unmeasured, not good or bad, and no answer may grade a decision, or the people who approved it, beyond the outcomes actually recorded against it.',
    policyNamePlaceholder: 'Decision outcome reporting policy',
    promptSystemDefault:
      'You describe decisions and the outcomes recorded against them. State each decision\'s recommendation, status, confidence, approval date and recorded outcomes as given; treat a decision with no outcome as unmeasured, and never grade a decision or its approvers beyond what is recorded.',
    reportCanPrint: 'the statuses, confidences, approval dates and outcome counts come from the decision and outcome records rather than from a model.',
    groundedOn: 'the decision records above — what was decided, at what confidence, when it was approved, and which outcomes have been recorded.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Decision Intelligence, so nothing here opens a case. The read-only tool agent on the Automations tab still reads decisions.outcomes.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Decision Intelligence, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads decisions.outcomes.',
  },

  report: {
    defaultDataSource: 'decisions.outcomes',
    filters: [
      { key: 'status', label: 'Decision status', kind: 'text', placeholder: 'proposed, approved or rejected' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'decision_analytics_report',
    emptyNote: 'No decisions matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Decision outcome reader',
      description: 'Reads decisions with the recommendation decided, status, confidence, approval date and recorded outcomes. Changes nothing.',
      module: 'decision_analytics',
      tools_allowed: ['decisions.outcomes'],
      instructions:
        'Report decisions and outcomes exactly as recorded. A decision with zero outcomes recorded is unmeasured — never call it a success or a failure, and never judge who approved it.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Decisions are readable, but HP Brain has no domain agent or approval workflow for Decision Intelligence — the agent here is the read-only tool agent below, which reads decisions.outcomes and changes nothing.',

  operations: {
    decision_analytics_report: { key: 'decision_analytics_report', label: 'Decision and outcome register', capability: null, uses: 'report_template', prefers: ['decision', 'outcome'] },
    decision_analytics_note: { key: 'decision_analytics_note', label: 'Decision outcomes summarised', capability: 'generative', uses: 'prompt', prefers: ['decision'] },
    decision_analytics_agent_run: { key: 'decision_analytics_agent_run', label: 'Decision Intelligence agent run', capability: 'agent', uses: 'agent' },
  },
};
