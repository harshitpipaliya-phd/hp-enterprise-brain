import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Intelligence Loop › Evidence. Report source: `evidence.by_signal` —
 * hpbrain_evidence joined to the signal each record supports, with its type, source,
 * confidence and status, newest first.
 */
export const evidenceAiStack: AiStackModule = {
  key: 'evidence',
  menuSlug: 'evidence',
  label: 'Evidence',
  records: 'evidence records',
  record: 'evidence record',
  route: 'evidence',
  subjectEntityKey: 'evidence',

  copy: {
    centralRisk:
      'upgrading confidence. Evidence is held at the confidence it was recorded with, and no answer may describe it as stronger, more certain or more conclusive than that — several weak records do not add up to a strong one.',
    policyNamePlaceholder: 'Evidence confidence wording policy',
    promptSystemDefault:
      "You summarise the evidence attached to signals. State each record's type, source, confidence and status exactly as recorded, never describe evidence as more certain than its recorded confidence, and never combine records into a conclusion they do not state.",
    reportCanPrint: 'the evidence types, sources, confidences and observed dates come from the evidence records rather than from a model.',
    groundedOn: 'the evidence records above — what supports which signal, where it came from and how firmly it is held.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Evidence, so nothing here opens a case. The read-only tool agent on the Automations tab still reads evidence.by_signal.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Evidence, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads evidence.by_signal.',
  },

  report: {
    defaultDataSource: 'evidence.by_signal',
    filters: [
      { key: 'signal_id', label: 'Signal id', kind: 'text', placeholder: 'all signals' },
      { key: 'evidence_type', label: 'Evidence type', kind: 'text', placeholder: 'observation, assessment, document, system or testimony' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'evidence_report',
    emptyNote: 'No evidence matched those filters, so no report was created. A signal with no evidence is unsupported so far, not disproved.',
  },

  presets: [
    {
      name: 'Evidence reader',
      description: 'Reads evidence records with the signal each supports, type, source, confidence and status. Changes nothing.',
      module: 'evidence',
      tools_allowed: ['evidence.by_signal'],
      instructions:
        'Report evidence exactly as recorded, at its recorded confidence. Never describe a record as stronger than that, and never sum several records into a conclusion.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Evidence is readable, but HP Brain has no domain agent or approval workflow for Evidence — the agent here is the read-only tool agent below, which reads evidence.by_signal and changes nothing.',

  operations: {
    evidence_report: { key: 'evidence_report', label: 'Evidence by signal', capability: null, uses: 'report_template', prefers: ['evidence'] },
    evidence_note: { key: 'evidence_note', label: 'Evidence summarised', capability: 'generative', uses: 'prompt', prefers: ['evidence'] },
    evidence_agent_run: { key: 'evidence_agent_run', label: 'Evidence agent run', capability: 'agent', uses: 'agent' },
  },
};
