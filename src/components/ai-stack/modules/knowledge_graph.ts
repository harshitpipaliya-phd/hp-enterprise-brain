import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Knowledge › Graph Explorer. Report source: `graph.entity_mappings` —
 * hpbrain_entity_mappings, how the organisation's source records map onto the knowledge
 * graph's universal entities and fields. That is a data mapping, not a model call.
 */
export const knowledgeGraphAiStack: AiStackModule = {
  key: 'knowledge_graph',
  menuSlug: 'graph',
  label: 'Graph Explorer',
  records: 'entity mappings',
  record: 'entity mapping',
  route: 'graph',
  subjectEntityKey: 'entity_mapping',

  copy: {
    centralRisk:
      'inventing a relationship the graph does not hold. A mapping links one source field to one universal field; no answer may extend a mapping by analogy, infer an edge between entities that no mapping records, or present the graph\'s shape as a fact about the organisation\'s people.',
    policyNamePlaceholder: 'Knowledge graph use policy',
    promptSystemDefault:
      'You explain entity mappings to an auditor. State only the source system, source entity, source field, universal entity, universal field and mapping type of the rows you are given, and never infer a mapping or relationship the rows do not record.',
    reportCanPrint: 'every mapping row comes from hpbrain_entity_mappings itself rather than from a model.',
    groundedOn: 'the entity mapping records above — which source field maps to which universal field, and how.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the Graph Explorer, so nothing here opens a case. The read-only tool agent on the Automations tab still reads graph.entity_mappings.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the Graph Explorer, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads graph.entity_mappings.',
  },

  report: {
    defaultDataSource: 'graph.entity_mappings',
    filters: [
      { key: 'universal_entity', label: 'Universal entity', kind: 'text', placeholder: 'e.g. Person' },
      { key: 'source_system', label: 'Source system', kind: 'text', placeholder: 'e.g. erp' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'knowledge_graph_report',
    emptyNote: 'No entity mappings matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Entity mapping reader',
      description: "Reads how the organisation's source records map onto the knowledge graph's universal entities. Changes nothing.",
      module: 'knowledge_graph',
      tools_allowed: ['graph.entity_mappings'],
      instructions: 'Report mappings exactly as recorded, one source field to one universal field. Never extend a mapping by analogy or infer a relationship no row records.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Entity mappings are readable, but HP Brain has no domain agent or approval workflow for the Graph Explorer — the agent here is the read-only tool agent below, which reads graph.entity_mappings and changes nothing.',

  operations: {
    knowledge_graph_report: { key: 'knowledge_graph_report', label: 'Entity mapping audit', capability: 'ontology', uses: 'report_template', prefers: ['mapping'] },
    knowledge_graph_note: { key: 'knowledge_graph_note', label: 'Entity mapping explained', capability: 'generative', uses: 'prompt', prefers: ['mapping'] },
    knowledge_graph_agent_run: { key: 'knowledge_graph_agent_run', label: 'Graph Explorer agent run', capability: 'agent', uses: 'agent' },
  },
};
