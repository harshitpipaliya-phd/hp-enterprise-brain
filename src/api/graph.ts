import { request } from './client.js';
import type {
  GraphExpansion, GraphNodeDetail, GraphOverview, GraphSearchResponse, GraphSummary, GraphVocabulary,
} from '../components/graph/graphTypes';

/**
 * Graph reads.
 *
 * The three original calls are unchanged — GlobalSearch and anything else
 * written against them keeps working. The rest are Graph Explorer's, and every
 * one is a GET: this screen reads the organization's own data and writes
 * nothing.
 *
 * `label` and `id` go on the query string rather than in the path because the
 * ids are real values out of the data — a subject called "Business Studies", a
 * standard called "CBSE-12" — and plenty of them contain characters a path
 * segment mangles.
 */

function query(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const graphApi = {
  getEntity: (tenantId: string, label: string, id: string) => request(`/graph/${tenantId}/entity/${label}/${id}`),
  getRelated: (tenantId: string, label: string, id: string) => request(`/graph/${tenantId}/entity/${label}/${id}/related`),

  search: (tenantId: string, q: string, labels?: string[]): Promise<GraphSearchResponse> =>
    request(`/graph/${tenantId}/search${query({ q, labels: labels?.length ? labels.join(',') : undefined })}`),

  /** The organization-rooted graph the screen opens on. */
  overview: (tenantId: string, depth = 1, include?: string[]): Promise<GraphOverview> =>
    request(`/graph/${tenantId}/overview${query({ depth, include: include?.length ? include.join(',') : undefined })}`),

  /** One hop from one node. `offset` pages through a group's members. */
  expand: (tenantId: string, label: string, id: string, offset = 0, include?: string[]): Promise<GraphExpansion> =>
    request(`/graph/${tenantId}/expand${query({ label, id, offset, include: include?.length ? include.join(',') : undefined })}`),

  /** What the detail panel renders. */
  node: (tenantId: string, label: string, id: string): Promise<GraphNodeDetail> =>
    request(`/graph/${tenantId}/node${query({ label, id })}`),

  summary: (tenantId: string): Promise<{ summary: GraphSummary }> => request(`/graph/${tenantId}/summary`),

  /** Labels and relationships, with the column behind each. Drives the legend. */
  vocabulary: (tenantId: string): Promise<GraphVocabulary> => request(`/graph/${tenantId}/vocabulary`),
};
