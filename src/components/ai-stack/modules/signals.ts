import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Intelligence Loop › Signals. Report source: `signals.open` — rows of
 * hpbrain_signals not yet resolved, closed or dismissed, with source, classification,
 * severity, priority, confidence and the entity each concerns, newest first.
 */
export const signalsAiStack: AiStackModule = {
  key: 'signals',
  menuSlug: 'signals',
  label: 'Signals',
  records: 'signals',
  record: 'signal',
  route: 'signals',
  subjectEntityKey: 'signal',

  copy: {
    centralRisk:
      'presenting a signal as a confirmed finding. A signal is something the data has flagged for attention; until evidence and deliberation have tested it, no answer may state it as what happened, name its cause, or treat its severity as proven.',
    policyNamePlaceholder: 'Signal triage language policy',
    promptSystemDefault:
      'You summarise open signals. Describe each as flagged, not confirmed: state its source, classification, severity, confidence and the entity it concerns exactly as recorded, never assert a cause, and never raise or lower a severity or confidence the record does not carry.',
    reportCanPrint: 'the classifications, severities, priorities and confidences come from the signal records rather than from a model.',
    groundedOn: 'the open signal records above — what was flagged, by which source, how severe and how confident, and what it concerns.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Signals, so nothing here opens a case. The read-only tool agent on the Automations tab still reads signals.open.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Signals, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads signals.open.',
  },

  report: {
    defaultDataSource: 'signals.open',
    filters: [
      { key: 'severity', label: 'Severity', kind: 'text', placeholder: 'low, medium, high or critical' },
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'new, triaged or investigating' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'signals_report',
    emptyNote:
      'No open signals matched those filters, so no report was created. That means nothing unresolved is flagged at that filter — not that nothing is wrong.',
  },

  presets: [
    {
      name: 'Open signal reader',
      description: 'Reads unresolved signals with source, classification, severity, priority, confidence and the entity concerned. Changes nothing.',
      module: 'signals',
      tools_allowed: ['signals.open'],
      instructions:
        'Report open signals exactly as recorded and call each one flagged, never confirmed. Do not name a cause, and do not restate a severity or confidence other than the recorded one.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Open signals are readable, but HP Brain has no domain agent or approval workflow for Signals — the agent here is the read-only tool agent below, which reads signals.open and changes nothing.',

  operations: {
    signals_report: { key: 'signals_report', label: 'Open signal register', capability: null, uses: 'report_template', prefers: ['signal'] },
    signals_note: { key: 'signals_note', label: 'Signal summarised', capability: 'generative', uses: 'prompt', prefers: ['signal'] },
    signals_agent_run: { key: 'signals_agent_run', label: 'Signals agent run', capability: 'agent', uses: 'agent' },
  },
};
