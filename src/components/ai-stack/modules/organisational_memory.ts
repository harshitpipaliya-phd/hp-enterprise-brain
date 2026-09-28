import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Knowledge › Memory. Report source: `memory.items` — hpbrain_learnings,
 * what the organisation has recorded as learned from its outcomes: the pattern, its
 * description, domain, confidence, whether it is reusable and the outcome it came from.
 */
export const organisationalMemoryAiStack: AiStackModule = {
  key: 'organisational_memory',
  menuSlug: 'memory',
  label: 'Memory',
  records: 'learnings',
  record: 'learning',
  route: 'memory',
  subjectEntityKey: 'learning',

  copy: {
    centralRisk:
      'generalising a learning beyond where it was learned. Each learning comes from a recorded outcome in a recorded domain; no answer may apply one outside that domain, present a learning not marked reusable as a rule, or describe it as more certain than its recorded confidence.',
    policyNamePlaceholder: 'Organisational memory reuse policy',
    promptSystemDefault:
      'You recall what the organisation has learned. State each learning\'s pattern, domain, confidence and whether it is reusable exactly as recorded; never apply a learning outside its domain, and never present one not marked reusable as general guidance.',
    reportCanPrint: 'the patterns, domains, confidences and reusable flags come from the learning records rather than from a model.',
    groundedOn: 'the learning records above — what pattern was learned, in which domain, at what confidence, and whether it is marked reusable.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Memory, so nothing here opens a case. The read-only tool agent on the Automations tab still reads memory.items.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Memory, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads memory.items.',
  },

  report: {
    defaultDataSource: 'memory.items',
    filters: [
      { key: 'domain', label: 'Domain', kind: 'text', placeholder: 'all domains' },
      { key: 'reusable', label: 'Reusable learnings only', kind: 'boolean', defaultValue: false },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'organisational_memory_report',
    emptyNote: 'No learnings matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Organisational memory reader',
      description: 'Reads recorded learnings with pattern, domain, confidence, reusable flag and originating outcome. Changes nothing.',
      module: 'organisational_memory',
      tools_allowed: ['memory.items'],
      instructions:
        'Report learnings exactly as recorded. A learning holds in its own domain at its own confidence — never apply it elsewhere, and never present a learning not marked reusable as a rule.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Learnings are readable, but HP Brain has no domain agent or approval workflow for Memory — the agent here is the read-only tool agent below, which reads memory.items and changes nothing.',

  operations: {
    organisational_memory_report: { key: 'organisational_memory_report', label: 'Learning register', capability: null, uses: 'report_template', prefers: ['learning', 'memory'] },
    organisational_memory_note: { key: 'organisational_memory_note', label: 'Learning recalled', capability: 'generative', uses: 'prompt', prefers: ['learning'] },
    organisational_memory_agent_run: { key: 'organisational_memory_agent_run', label: 'Memory agent run', capability: 'agent', uses: 'agent' },
  },
};
