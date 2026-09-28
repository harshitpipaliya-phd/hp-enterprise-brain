import type { AiStackModule } from '../ai-stack-module';

/**
 * AI Stack for Analytics › Organizational Knowledge. Report source:
 * `knowledge.mental_models` — hpbrain_mental_models, the models the organisation reasons
 * with, each with its description, domain, version and status.
 */
export const mentalModelsAiStack: AiStackModule = {
  key: 'mental_models',
  menuSlug: 'mentalmodels',
  label: 'Organizational Knowledge',
  records: 'mental models',
  record: 'mental model',
  route: 'mentalmodels',
  subjectEntityKey: 'mental_model',

  copy: {
    centralRisk:
      'substituting a model of its own for the organisation\'s. The mental models here are the ones the organisation has recorded; no answer may add a model, extend one beyond its recorded description and domain, or treat a draft or retired version as the one in use.',
    policyNamePlaceholder: 'Mental model use policy',
    promptSystemDefault:
      'You explain the mental models an organisation reasons with. Work only from each model\'s recorded name, description, domain, version and status; never add a model that is not recorded, never stretch one beyond its domain, and always say which version and status you are describing.',
    reportCanPrint: 'the domains, versions and statuses come from the mental model records rather than from a model.',
    groundedOn: 'the mental model records above — what each model says, which domain it covers, and which version is current.',
    capabilityAgent:
      'HP Brain has no domain agent bound to Organizational Knowledge, so nothing here opens a case. The read-only tool agent on the Automations tab still reads knowledge.mental_models.',
    capabilityWorkflow:
      'HP Brain has no approval workflow bound to Organizational Knowledge, so nothing on this tab pauses for an approval. The read-only tool agent on the Automations tab reads knowledge.mental_models.',
  },

  report: {
    defaultDataSource: 'knowledge.mental_models',
    filters: [
      { key: 'status', label: 'Model status', kind: 'text', placeholder: 'e.g. active' },
      { key: 'domain', label: 'Domain', kind: 'text', placeholder: 'all domains' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '100' },
    ],
    operation: 'mental_models_report',
    emptyNote: 'No mental models matched those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Mental model reader',
      description: 'Reads the mental models the organisation reasons with — description, domain, version and status. Changes nothing.',
      module: 'mental_models',
      tools_allowed: ['knowledge.mental_models'],
      instructions:
        'Report mental models exactly as recorded, naming the version and status of each. Never add a model that is not recorded and never apply one outside its recorded domain.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Mental models are readable, but HP Brain has no domain agent or approval workflow for Organizational Knowledge — the agent here is the read-only tool agent below, which reads knowledge.mental_models and changes nothing.',

  operations: {
    mental_models_report: { key: 'mental_models_report', label: 'Mental model catalogue', capability: 'ontology', uses: 'report_template', prefers: ['mental', 'model'] },
    mental_models_note: { key: 'mental_models_note', label: 'Mental model explained', capability: 'generative', uses: 'prompt', prefers: ['model'] },
    mental_models_agent_run: { key: 'mental_models_agent_run', label: 'Organizational Knowledge agent run', capability: 'agent', uses: 'agent' },
  },
};
