import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Intelligence Loop › Intelligence Workspace. Report source:
 * `workspace.recommendations` — hpbrain_recommendations with category, priority,
 * confidence, the impact, cost and risk recorded against each, and its status.
 */
export const intelligenceWorkspaceAiStack: AiStackModule = {
  key: 'intelligence_workspace',
  menuSlug: 'workspace',
  label: 'Intelligence Workspace',
  records: 'recommendations',
  record: 'recommendation',
  route: 'workspace',
  subjectEntityKey: 'recommendation',

  copy: {
    centralRisk:
      'presenting a recommendation as a decision. A recommendation is a proposal waiting on the governance gate; no answer may say it has been accepted, tell anyone to act on it, or restate its impact, cost or risk as anything other than what was recorded.',
    policyNamePlaceholder: 'Recommendation wording policy',
    promptSystemDefault:
      'You explain recommendations to the people who will decide on them. State each one\'s category, priority, confidence, impact, cost, risk and status exactly as recorded; never describe a pending recommendation as approved, never advise acting on it, and never re-estimate its impact, cost or risk.',
    reportCanPrint: 'the priorities, confidences, impacts, costs, risks and statuses come from the recommendation records rather than from a model.',
    groundedOn: 'the recommendation records above — what is proposed, in which category, at what recorded confidence, impact, cost and risk, and where it stands.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Intelligence Workspace, so nothing here opens a case. The read-only tool agent on the Automations tab still reads workspace.recommendations.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Intelligence Workspace, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads workspace.recommendations.',
  },

  report: {
    defaultDataSource: 'workspace.recommendations',
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'pending, accepted, rejected or deferred' },
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'watch, investigate, intervene or escalate' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'intelligence_workspace_report',
    emptyNote: 'No recommendations matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Recommendation reader',
      description: 'Reads recommendations with category, priority, confidence, impact, cost, risk and status. Changes nothing.',
      module: 'intelligence_workspace',
      tools_allowed: ['workspace.recommendations'],
      instructions:
        'Report recommendations exactly as recorded. A pending recommendation is a proposal, not a decision — never say it was accepted, never urge action on it, and never re-estimate its impact, cost or risk.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Recommendations are readable, but HP Brain has no domain agent or approval workflow for the Intelligence Workspace — the agent here is the read-only tool agent below, which reads workspace.recommendations and changes nothing.',

  operations: {
    intelligence_workspace_report: { key: 'intelligence_workspace_report', label: 'Recommendation register', capability: null, uses: 'report_template', prefers: ['recommendation'] },
    intelligence_workspace_note: { key: 'intelligence_workspace_note', label: 'Recommendation explained', capability: 'generative', uses: 'prompt', prefers: ['recommendation'] },
    intelligence_workspace_agent_run: { key: 'intelligence_workspace_agent_run', label: 'Intelligence Workspace agent run', capability: 'agent', uses: 'agent' },
  },
};
