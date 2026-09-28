import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Automation › Policy Management. Report source: `policies.catalogue` —
 * hpbrain_policies, the business rules execution must respect, with type, scope, version
 * and status. These are the organisation's policies, not the AI policies on this stack's
 * Policies tab (which live in their own table).
 */
export const policiesAiStack: AiStackModule = {
  key: 'policies',
  menuSlug: 'policies',
  label: 'Policy Management',
  records: 'policies',
  record: 'policy',
  route: 'policies',
  subjectEntityKey: 'policy',

  copy: {
    centralRisk:
      'stating a business policy that is not a stored row. Every rule an answer cites must be a policy in the catalogue, at its recorded version and status; no answer may paraphrase one into a stricter or looser rule, fill a gap with what a policy "probably" says, or cite a superseded version as current.',
    policyNamePlaceholder: 'Business policy citation policy',
    promptSystemDefault:
      'You describe the organisation\'s business policies. Cite only policies in the rows you are given, by name, type, scope, version and status; never state a rule no row records, never tighten or loosen one, and never present a superseded version as current.',
    reportCanPrint: 'the policy types, scopes, versions and statuses come from the policy records rather than from a model.',
    groundedOn: 'the policy records above — which rules exist, what they apply to, which version is current and which are superseded.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Policy Management, so nothing here opens a case. The read-only tool agent on the Automations tab still reads policies.catalogue.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Policy Management, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads policies.catalogue.',
  },

  report: {
    defaultDataSource: 'policies.catalogue',
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'active or superseded (blank: every current policy)' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'policies_report',
    emptyNote: 'No policies matched those filters, so no report was created. That means no policy is recorded at that filter, not that no rule applies.',
  },

  presets: [
    {
      name: 'Policy catalogue reader',
      description: 'Reads business policies with type, scope, version and status. Changes nothing.',
      module: 'policies',
      tools_allowed: ['policies.catalogue'],
      instructions:
        'Report policies exactly as recorded, by name, version and status. Never state a rule that is not a stored policy, never reword one into a different rule, and never cite a superseded version as current.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Business policies are readable, but HP Brain has no domain agent or approval workflow for Policy Management — the agent here is the read-only tool agent below, which reads policies.catalogue and changes nothing.',

  operations: {
    policies_report: { key: 'policies_report', label: 'Policy catalogue', capability: null, uses: 'report_template', prefers: ['policy', 'catalogue'] },
    policies_note: { key: 'policies_note', label: 'Policy explained', capability: 'generative', uses: 'prompt', prefers: ['policy'] },
    policies_agent_run: { key: 'policies_agent_run', label: 'Policy Management agent run', capability: 'agent', uses: 'agent' },
  },
};
