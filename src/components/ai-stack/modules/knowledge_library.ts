import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Knowledge › Knowledge Library. Report source: `knowledge.assets` —
 * hpbrain_knowledge_assets (archived excluded) with category, confidence, status, owning
 * department and how often each asset has been reused.
 */
export const knowledgeLibraryAiStack: AiStackModule = {
  key: 'knowledge_library',
  menuSlug: 'knowledgelibrary',
  label: 'Knowledge Library',
  records: 'knowledge assets',
  record: 'knowledge asset',
  route: 'knowledgelibrary',
  subjectEntityKey: 'knowledge_asset',

  copy: {
    centralRisk:
      'treating reuse as validation. How often an asset has been reused says it is popular, not that it is correct; no answer may raise an asset\'s recorded confidence because of its reuse count, or present a draft asset as settled knowledge.',
    policyNamePlaceholder: 'Knowledge asset citation policy',
    promptSystemDefault:
      'You describe the organisation\'s knowledge assets. State each asset\'s title, category, confidence, status and reuse count exactly as recorded; never treat a high reuse count as proof the asset is right, and always say when an asset is not yet published.',
    reportCanPrint: 'the categories, confidences, statuses and reuse counts come from the knowledge asset records rather than from a model.',
    groundedOn: 'the knowledge asset records above — what is held, in which category, at what recorded confidence, and how often it has been reused.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Knowledge Library, so nothing here opens a case. The read-only tool agent on the Automations tab still reads knowledge.assets.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Knowledge Library, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads knowledge.assets.',
  },

  report: {
    defaultDataSource: 'knowledge.assets',
    filters: [
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'all categories' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'knowledge_library_report',
    emptyNote: 'No knowledge assets matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Knowledge asset reader',
      description: 'Reads knowledge assets with category, confidence, status, department and reuse count. Changes nothing.',
      module: 'knowledge_library',
      tools_allowed: ['knowledge.assets'],
      instructions:
        'Report knowledge assets exactly as recorded. A reuse count is how often an asset was used, not how reliable it is — never raise its confidence on that basis.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Knowledge assets are readable, but HP Brain has no domain agent or approval workflow for the Knowledge Library — the agent here is the read-only tool agent below, which reads knowledge.assets and changes nothing.',

  operations: {
    knowledge_library_report: { key: 'knowledge_library_report', label: 'Knowledge asset register', capability: null, uses: 'report_template', prefers: ['knowledge', 'asset'] },
    knowledge_library_note: { key: 'knowledge_library_note', label: 'Knowledge asset summarised', capability: 'generative', uses: 'prompt', prefers: ['knowledge'] },
    knowledge_library_agent_run: { key: 'knowledge_library_agent_run', label: 'Knowledge Library agent run', capability: 'agent', uses: 'agent' },
  },
};
