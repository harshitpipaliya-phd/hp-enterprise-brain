/**
 * Which HP Brain screens carry a module AI Stack, and under which module key.
 *
 * Deliberately tiny and free of imports: the app shell reads it on every navigation
 * to decide whether to offer the toggle, so it must not pull the AI Stack screens (or
 * the descriptors) into the main bundle. Those load only when the toggle is used.
 *
 * The keys are the `hpbrain_ai_modules.module_key` values the backend scopes every
 * AI Stack request by. Screens absent from this map — Command Center, Ingestion,
 * Executive Dashboard, Decision Analytics, AI Assistant, Settings — have no AI Stack,
 * by the agreed design.
 */
export const AI_STACK_VIEWS: Readonly<Record<string, { key: string; label: string }>> = {
  departments: { key: 'departments', label: 'Departments' },
  people: { key: 'people', label: 'People' },
  capabilities: { key: 'capabilities', label: 'Capabilities' },
  signals: { key: 'signals', label: 'Signals' },
  evidence: { key: 'evidence', label: 'Evidence' },
  deliberation: { key: 'deliberation', label: 'Deliberation' },
  workspace: { key: 'intelligence_workspace', label: 'Intelligence Workspace' },
  executions: { key: 'executions', label: 'Execution Center' },
  decisionintel: { key: 'decision_analytics', label: 'Decision Intelligence' },
  mentalmodels: { key: 'mental_models', label: 'Organizational Knowledge' },
  graph: { key: 'knowledge_graph', label: 'Graph Explorer' },
  kasbaexplorer: { key: 'kasba', label: 'KASBA Explorer' },
  knowledgelibrary: { key: 'knowledge_library', label: 'Knowledge Library' },
  memory: { key: 'organisational_memory', label: 'Memory' },
  esolibrary: { key: 'eso', label: 'ESO Library' },
  agents: { key: 'agents', label: 'Agent Monitor' },
  tasks: { key: 'tasks', label: 'Task Orchestrator' },
  policies: { key: 'policies', label: 'Policy Management' },
};
