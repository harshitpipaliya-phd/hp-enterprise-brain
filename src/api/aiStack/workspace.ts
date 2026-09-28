
/**
 * The slice of LMS_K12's `lib/intelligence/workspace.ts` the shared AI Stack uses:
 * building a report from a module screen. Same exported names and shapes; the transport
 * is G2G's `aiRequest`, and hp_erp's `AiReportController` answers it.
 *
 * `WorkspaceSession` is kept for signature compatibility — G2G derives the organisation
 * and user from the bearer token `aiRequest` sends, so nothing in it is ever posted.
 */

import { aiRequest } from '../aiIntelligence/client';

export interface WorkspaceSession {
  token?: string | null;
  baseUrl?: string | null;
  instituteId?: string | number | null;
  academicYear?: string | number | null;
  termId?: string | number | null;
}

export interface WorkspaceReport {
  module: string;
  /** The `ai_generated_reports` row id this was saved as. */
  template_id: string | null;
  title: string;
  row_count: number;
  columns: string[];
  /** The read-only data source the rows came from, e.g. `capability.jobroles`. */
  source_tool: string | null;
  /** Which published layout produced this, or null for the plain table. */
  layout_template_id: string | null;
  layout_name: string | null;
  /** The saved report's own page — `/ai/reports/<id>` — not this page. */
  template_link: string | null;
}

export function generateReportForContext(
  _session: WorkspaceSession,
  input: {
    /** The AI Stack module key, e.g. 'signals'. HP Brain has no menu table, so the
     *  module is named directly where G2G resolved it from a menu route. */
    module: string;
    arguments?: Record<string, unknown>;
    /** A specific report layout; otherwise the module's published default. */
    template_id?: string | null;
    /**
     * Save the document even when the source returned no rows. Off by default — the
     * backend then reports "No records matched." and saves nothing, because an empty
     * result is an answer, not a document.
     */
    keep_empty?: boolean;
  },
): Promise<WorkspaceReport> {
  return aiRequest<WorkspaceReport>('/workspace/report', 'POST', input);
}
