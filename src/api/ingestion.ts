import { request } from './client.js';

/**
 * Ingestion — external CSV upload, previewed then committed.
 *
 * TWO CALLS, NEVER ONE. upload() writes nothing to the graph; it returns a job
 * id and a proposed mapping. commit() re-reads the source server-side and
 * writes the Signals. The rows are deliberately NOT posted back — the server
 * rejects that shape — because rows a client could resubmit are rows a client
 * could alter, and altered rows stored under a provenance record naming the
 * original file is a forged citation.
 */

/**
 * The mapping targets, mirroring FieldMap::CANONICAL server-side.
 *
 * Held as a fixed list rather than read off the response because client.ts
 * adds camelCase ALIASES to every object it parses without removing the
 * snake_case originals. Iterating a suggested_map would therefore yield
 * `evidence_text` AND `evidenceText`, and posting both back sends four keys
 * the server does not recognise alongside the six it does.
 */
export const CANONICAL_FIELDS = [
  'title',
  'state',
  'owner',
  'evidence_text',
  'evidence_timestamp',
  'external_ref',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/**
 * Without a title there is nothing to name the Signal; without a state its
 * classification would be invented. The server refuses a commit missing
 * either, so the button is disabled here rather than sending a known 422.
 */
export const REQUIRED_FIELDS: CanonicalField[] = ['title', 'state'];

export interface IngestionPreview {
  row_count: number;
  headers: string[];
  suggested_map: Partial<Record<CanonicalField, string>>;
  unmapped_fields: string[];
  committable: boolean;
  sample_rows: Record<string, unknown>[];
  sync_type: string;
  fetched_at: string;
}

export interface UploadResponse {
  job_id: string;
  preview: IngestionPreview;
}

export interface CommitResponse {
  job_id: string;
  committed: number;
  errors: number;
  skipped: number;
  /** Capped at 20 by the server, however many were actually written. */
  signal_ids: string[];
  status: string;
}

export interface DataSourceRow {
  source_key: string;
  display_name: string;
  source_type: string;
}

export const ingestionApi = {
  listSources: (tenantId: string): Promise<DataSourceRow[]> =>
    request(`/ingestion/sources/${tenantId}`),

  /**
   * Multipart, not JSON. client.ts detects FormData and drops the
   * Content-Type header so the browser can set its own multipart boundary —
   * setting it by hand produces a boundary-less header and a 422 from Laravel.
   */
  upload: (file: File, sourceId: string, orgId?: string): Promise<UploadResponse> => {
    const body = new FormData();
    body.append('file', file);
    body.append('source_id', sourceId);
    if (orgId) body.append('org_id', orgId);

    return request('/ingestion/upload', { method: 'POST', body });
  },

  commit: (
    tenantId: string,
    jobId: string,
    fieldMap: Partial<Record<CanonicalField, string>>,
    saveMap: boolean,
  ): Promise<CommitResponse> =>
    request(`/ingestion/${tenantId}/${jobId}/commit`, {
      method: 'POST',
      body: JSON.stringify({ field_map: fieldMap, save_map: saveMap }),
    }),
};
