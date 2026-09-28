import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Knowledge › ESO Library. Report source: `eso.catalogue` —
 * hpbrain_eso_definitions, the organisation's executable standard operations with code,
 * version, status, owner, objective, trust level and provenance.
 */
export const esoAiStack: AiStackModule = {
  key: 'eso',
  menuSlug: 'esolibrary',
  label: 'ESO Library',
  records: 'ESOs',
  record: 'ESO',
  route: 'esolibrary',
  subjectEntityKey: 'eso_definition',

  copy: {
    centralRisk:
      'describing an ESO that is not in force as if it were. Only a current, released version governs work; no answer may present a draft, retired, deprecated or superseded ESO as the standard, or restate an objective in words the definition does not use.',
    policyNamePlaceholder: 'ESO catalogue citation policy',
    promptSystemDefault:
      'You describe executable standard operations. State each ESO\'s code, name, version, status, owner, objective and trust level exactly as recorded; always name its status, and never present a draft, retired, deprecated or superseded version as the standard in force.',
    reportCanPrint: 'the codes, versions, statuses, owners, trust levels and provenance come from the ESO definitions rather than from a model.',
    groundedOn: 'the ESO records above — what each operation is for, which version, its status, who owns it and how far it is trusted.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the ESO Library, so nothing here opens a case. The read-only tool agent on the Automations tab still reads eso.catalogue.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the ESO Library, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads eso.catalogue.',
  },

  report: {
    defaultDataSource: 'eso.catalogue',
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'text',
        placeholder: 'draft, active, published, approved, released, retired, deprecated or superseded',
      },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'eso_report',
    emptyNote: 'No ESOs matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'ESO catalogue reader',
      description: 'Reads ESO definitions with code, version, status, owner, objective, trust level and provenance. Changes nothing.',
      module: 'eso',
      tools_allowed: ['eso.catalogue'],
      instructions:
        'Report ESOs exactly as recorded and always name the status. Never present a draft, retired, deprecated or superseded ESO as the standard in force, and never paraphrase an objective into something it does not say.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'ESO definitions are readable, but HP Brain has no domain agent or approval workflow for the ESO Library — the agent here is the read-only tool agent below, which reads eso.catalogue and changes nothing.',

  operations: {
    eso_report: { key: 'eso_report', label: 'ESO catalogue', capability: 'ontology', uses: 'report_template', prefers: ['eso', 'catalogue'] },
    eso_note: { key: 'eso_note', label: 'ESO explained', capability: 'generative', uses: 'prompt', prefers: ['eso'] },
    eso_agent_run: { key: 'eso_agent_run', label: 'ESO Library agent run', capability: 'agent', uses: 'agent' },
  },
};
