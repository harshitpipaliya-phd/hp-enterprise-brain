import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Knowledge › KASBA Explorer. Report source: `kasba.profile` — capability
 * assignments with their recorded knowledge, ability, skill, behaviour and attitude levels
 * (hpbrain_capability_proficiency), the confidence of the evidence behind them and when
 * they were assessed.
 */
export const kasbaAiStack: AiStackModule = {
  key: 'kasba',
  menuSlug: 'kasbaexplorer',
  label: 'KASBA Explorer',
  records: 'KASBA profiles',
  record: 'KASBA profile',
  route: 'kasbaexplorer',
  subjectEntityKey: 'capability_proficiency',

  copy: {
    centralRisk:
      'turning a proficiency profile into a verdict on a person. KASBA levels are assessed readings at a recorded evidence confidence and date; no answer may rank people by them, call anyone unfit, or fill in a level that was never assessed.',
    policyNamePlaceholder: 'KASBA profile use policy',
    promptSystemDefault:
      'You describe KASBA proficiency profiles. State the knowledge, ability, skill, behaviour and attitude levels, evidence confidence and assessment date exactly as recorded; treat a blank level as not assessed, never rank or compare individuals, and never judge anyone\'s fitness for a role.',
    reportCanPrint: 'the five KASBA levels, evidence confidences and assessment dates come from the proficiency records rather than from a model.',
    groundedOn: 'the KASBA records above — which capability, for which target, at what assessed levels, on what evidence confidence and when.',
    capabilityAgent:
      'HP Brain has no domain agent bound to the KASBA Explorer, so nothing here opens a case. The read-only tool agent on the Automations tab still reads kasba.profile.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to the KASBA Explorer, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads kasba.profile.',
  },

  report: {
    defaultDataSource: 'kasba.profile',
    filters: [
      { key: 'target_type', label: 'Assessed target', kind: 'text', placeholder: 'Person, Department, JobRole or Organization' },
      { key: 'category', label: 'Capability category', kind: 'text', placeholder: 'all categories' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'kasba_report',
    emptyNote: 'No KASBA profiles matched those filters, so no report was created. A capability with no profile has not been assessed.',
  },

  presets: [
    {
      name: 'KASBA profile reader',
      description: 'Reads KASBA proficiency levels per capability assignment, with evidence confidence and assessment date. Changes nothing.',
      module: 'kasba',
      tools_allowed: ['kasba.profile'],
      instructions:
        'Report KASBA levels exactly as recorded, with their evidence confidence and date. A blank level is not assessed, not low. Never rank people or judge anyone unfit from a profile.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'KASBA profiles are readable, but HP Brain has no domain agent or approval workflow for the KASBA Explorer — the agent here is the read-only tool agent below, which reads kasba.profile and changes nothing.',

  operations: {
    kasba_report: { key: 'kasba_report', label: 'KASBA proficiency profile', capability: 'ontology', uses: 'report_template', prefers: ['kasba', 'proficiency'] },
    kasba_note: { key: 'kasba_note', label: 'KASBA profile explained', capability: 'generative', uses: 'prompt', prefers: ['kasba'] },
    kasba_agent_run: { key: 'kasba_agent_run', label: 'KASBA Explorer agent run', capability: 'agent', uses: 'agent' },
  },
};
