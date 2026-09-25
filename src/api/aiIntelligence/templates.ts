/**
 * Client for Template Management — `/ai-intelligence/templates`.
 *
 * Ported from G2G's lib/intelligence/ai-templates.ts. The paths and shapes are
 * G2G's; the differences are HP Brain's: the organisation is `tenant_id` rather
 * than `sub_institute_id`, every id is a UUID string, and a platform row carries
 * `tenant_id === '*'` where G2G stored null.
 *
 * Shaped like `policies.ts` on purpose: same transport, same envelope handling,
 * same "the organisation is never a parameter" rule. Both go through `aiRequest`,
 * so there is one place a token is read and one place an error is turned into
 * something a form can show.
 *
 * ── WHY THE LISTING PATH IS `/templates` AND NOT `/templates/catalog` ────────
 *
 * LMS K-12's client calls `/templates/catalog`, because `GET /templates` was
 * already taken there by its generation layer's "which templates can I render"
 * list. HP Brain, like G2G, has no such collision, so the listing sits at the
 * obvious path rather than importing a constraint that does not exist here.
 */

import { aiRequest } from './client';

/** The module selector's value for "not one module — all of them". */
export const SHARED_MODULE_KEY = '__shared__';

/** The `tenant_id` a shared platform row carries. */
export const PLATFORM_TENANT_ID = '*';

export interface TemplateModule {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  shared: boolean;
}

export interface TemplateVariableDoc {
  key: string;
  label: string;
  description: string;
  /** Whether this variable carries the data a grounded answer has to rest on. */
  grounding: boolean;
}

export interface TemplateVariable {
  key: string;
  label?: string | null;
  required?: boolean;
  type?: string | null;
  grounding?: boolean;
}

/**
 * What a template is — the same two kinds as G2G's contract.
 *
 * `prompt` is sent to a model, which writes prose. `report` is an HTML layout
 * whose `<<placeholders>>` are filled by substitution from rows a read-only data
 * source returned — no model touches the figures. The editor only authors
 * prompts; the type stays so rows of either kind read correctly.
 */
export type TemplateKind = 'prompt' | 'report';

/** A read-only data source a report layout can draw its rows from. */
export interface TemplateDataSource {
  name: string;
  module: string;
  label: string;
  description: string;
  arguments: Array<{ key: string; type: string; description: string; required: boolean }>;
}

/** A placeholder a report layout may use. `row` ones repeat inside a rows block. */
export interface ReportPlaceholder {
  key: string;
  label: string;
  scope: 'report' | 'row';
}

export interface TemplateBranding {
  /** The organisation's own name. Null when it has set none. */
  institute_name: string | null;
  logo_url: string | null;
  tenant_id: string | null;
}

export interface AiTemplateRow {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  module_key: string;
  module_label: string;
  kind: TemplateKind;
  /** Report layouts only. */
  html_layout: string | null;
  data_source: string | null;
  data_arguments: Record<string, unknown>;
  domain: string;
  category: string | null;
  version: number;
  status: string;
  system_prompt: string | null;
  user_prompt: string;
  variables: TemplateVariable[];
  output_format: string;
  output_schema: Record<string, unknown> | unknown[];
  provider: string | null;
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  safety_rules: string[];
  allow_as_evidence: boolean;
  requires_review: boolean;

  /** `'*'` on a shared platform row (G2G stored null; null is still read as platform). */
  tenant_id: string | null;
  /** A shared baseline row. Visible to every organisation, editable by none of them. */
  is_platform: boolean;
  /** False when editing would write this organisation its own copy instead. */
  editable_in_place: boolean;

  /** Whether the module's AI panel currently offers this template. */
  offered_in_module: boolean;
  offer_label: string | null;
  offer_module_key: string | null;
  /** Whether the binding is set to appear only when a record is selected. */
  offer_requires_entity: boolean;

  grounding_variables: string[];
  unresolvable_variables: string[];

  updated_at: string | null;
}

export interface AiTemplateOptions {
  modules: TemplateModule[];
  shared_key: string;
  variables: TemplateVariableDoc[];
  grounding_variables: string[];
  statuses: string[];
  kinds: TemplateKind[];
  output_formats: string[];
  categories: string[];
  /** The signed-in organisation's own name and logo. Never hardcoded by a caller. */
  branding: TemplateBranding;
  /** Read-only data sources a report layout can bind to. */
  data_sources: TemplateDataSource[];
  report_placeholders: ReportPlaceholder[];
}

export interface AiTemplateIndex {
  tenant_id: string;
  module_key: string | null;
  module_label: string;
  templates: AiTemplateRow[];
  counts: { total: number; published: number; offered: number };
}

export interface AiTemplatePayload {
  name: string;
  description?: string | null;
  template_key?: string | null;
  module_key: string;
  kind?: TemplateKind;
  /** Save for every organisation rather than only the signed-in one. */
  shared?: boolean;
  /** Report only — required by the API when `kind` is 'report'. */
  html_layout?: string | null;
  data_source?: string | null;
  data_arguments?: Record<string, unknown>;
  domain?: string | null;
  category?: string | null;
  status: string;
  system_prompt?: string | null;
  user_prompt: string;
  variables?: TemplateVariable[];
  output_schema?: Record<string, unknown> | unknown[];
  provider?: string | null;
  model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  output_format?: string;
  safety_rules?: string[];
  allow_as_evidence?: boolean;
  requires_review?: boolean;
  offer_in_module?: boolean;
  suggestion_label?: string | null;
  requires_entity?: boolean;
  /** Publish as a new version and archive the current one, instead of editing in place. */
  new_version?: boolean;
}

/**
 * What a save did.
 *
 * `updated` — the row was edited in place. `overridden` — the row was a platform
 * template, so the save wrote this organisation its own copy, which takes
 * precedence here. `versioned` — the save published a new version and archived
 * the one before it.
 */
export type TemplateSaveAction = 'updated' | 'overridden' | 'versioned';

export interface TemplatePreview {
  system: string | null;
  user: string;
  /** Placeholders nothing filled — each one reaches the model as literal `{{name}}`. */
  unresolved: string[];
  values: Record<string, string>;
}

/**
 * Whether a row is a shared platform template.
 *
 * The server's `is_platform` is trusted when it says so; the tenant is checked
 * as well because HP Brain marks platform rows `'*'`, and null — G2G's marker —
 * is read the same way rather than as "belongs to this organisation".
 */
export function isPlatformTemplate(row: Pick<AiTemplateRow, 'is_platform' | 'tenant_id'>): boolean {
  return row.is_platform === true || row.tenant_id === PLATFORM_TENANT_ID || row.tenant_id === null;
}

export function fetchTemplateOptions(): Promise<AiTemplateOptions> {
  return aiRequest<AiTemplateOptions>('/templates/options');
}

/** Templates for one module. Omit `moduleKey` for every template the organisation can see. */
export function fetchTemplates(moduleKey?: string | null): Promise<AiTemplateIndex> {
  const query = moduleKey ? `?module_key=${encodeURIComponent(moduleKey)}` : '';

  return aiRequest<AiTemplateIndex>(`/templates${query}`);
}

export function fetchTemplate(id: string): Promise<{ template: AiTemplateRow }> {
  return aiRequest(`/templates/${encodeURIComponent(id)}`);
}

export function createTemplate(payload: AiTemplatePayload): Promise<{ template: AiTemplateRow }> {
  return aiRequest('/templates', 'POST', payload);
}

export function updateTemplate(
  id: string,
  payload: AiTemplatePayload,
): Promise<{ template: AiTemplateRow; action: TemplateSaveAction | string }> {
  return aiRequest(`/templates/${encodeURIComponent(id)}`, 'PUT', payload);
}

export function retireTemplate(id: string): Promise<{ id: string }> {
  return aiRequest(`/templates/${encodeURIComponent(id)}`, 'DELETE');
}

/**
 * Render the prompts with sample values. No model is called and nothing is stored —
 * this answers "did my placeholder land where I meant it to", which is a question
 * about the text and not about the model.
 */
export function previewTemplate(input: {
  system_prompt?: string | null;
  user_prompt: string;
  values?: Record<string, string>;
  /** The module the sample values should be shaped like. */
  module_key?: string;
}): Promise<TemplatePreview> {
  return aiRequest<TemplatePreview>('/templates/preview', 'POST', input);
}
