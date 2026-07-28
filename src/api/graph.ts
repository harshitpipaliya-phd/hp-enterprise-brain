import { request } from './client.js';

export const graphApi = {
  getEntity: (tenantId: string, label: string, id: string) => request(`/graph/${tenantId}/entity/${label}/${id}`),
  getRelated: (tenantId: string, label: string, id: string) => request(`/graph/${tenantId}/entity/${label}/${id}/related`),
  search: (tenantId: string, q: string, labels?: string[]) =>
    request(`/graph/${tenantId}/search?q=${encodeURIComponent(q)}${labels?.length ? `&labels=${labels.join(',')}` : ''}`),
};
