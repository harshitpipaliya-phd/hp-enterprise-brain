import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Foundation › Capabilities. Report source: `capabilities.assignments` —
 * each capability assignment (hpbrain_capability_assignments joined to
 * hpbrain_capabilities) with the capability's code, category and criticality, what it is
 * assigned to and the assignment's status.
 */
export const capabilitiesAiStack: AiStackModule = {
  key: 'capabilities',
  menuSlug: 'capabilities',
  label: 'Capabilities',
  records: 'capability assignments',
  record: 'capability assignment',
  route: 'capabilities',
  subjectEntityKey: 'capability_assignment',

  copy: {
    centralRisk:
      'treating an assignment as proof of proficiency. A capability assigned to a person, department or role says it is required of them, not that they have it, and no answer may describe anyone as capable or lacking from assignments alone.',
    policyNamePlaceholder: 'Capability assignment reporting policy',
    promptSystemDefault:
      'You describe which capabilities are assigned to which targets. Work only from the assignment rows you are given, never read an assignment as evidence the target holds the capability, and never invent a criticality the record does not carry.',
    reportCanPrint: 'the capability codes, criticalities, targets and assignment dates come from the assignment records rather than from a model.',
    groundedOn: 'the capability assignment records above — which capability is required of which target, how critical it is, and since when.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Capabilities, so nothing here opens a case. The read-only tool agent on the Automations tab still reads capabilities.assignments.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Capabilities, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads capabilities.assignments.',
  },

  report: {
    defaultDataSource: 'capabilities.assignments',
    filters: [
      { key: 'target_type', label: 'Assigned to', kind: 'text', placeholder: 'Person, Department, JobRole or Organization' },
      { key: 'status', label: 'Assignment status', kind: 'text', placeholder: 'e.g. active' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'capabilities_report',
    emptyNote: 'No capability assignments matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Capability assignment reader',
      description: 'Reads capability assignments with code, category, criticality, target and status. Changes nothing.',
      module: 'capabilities',
      tools_allowed: ['capabilities.assignments'],
      instructions:
        'Report assignments exactly as recorded. An assignment is a requirement placed on a target, not evidence the target meets it — never say anyone has or lacks a capability from this list.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Capability assignments are readable, but HP Brain has no domain agent or approval workflow for Capabilities — the agent here is the read-only tool agent below, which reads capabilities.assignments and changes nothing.',

  operations: {
    capabilities_report: { key: 'capabilities_report', label: 'Capability assignment register', capability: 'ontology', uses: 'report_template', prefers: ['capability', 'assignment'] },
    capabilities_note: { key: 'capabilities_note', label: 'Capability coverage explained', capability: 'generative', uses: 'prompt', prefers: ['capability'] },
    capabilities_agent_run: { key: 'capabilities_agent_run', label: 'Capabilities agent run', capability: 'agent', uses: 'agent' },
  },
};
