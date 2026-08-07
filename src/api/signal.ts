import { request } from './client.js';

export interface SignalAnalytics {
  tenantId: string;
  generatedAt: string;
  openSignals: number;
  closedSignals: number;
  arrivalTrend: Array<{ date: string; count: number }>;
  resolutionTrend: Array<{ date: string; count: number }>;
  mttrHours: number | null;
  severityCounts: Record<string, number>;
  classificationCounts: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  weeklyGrowth: number | null;
  trendComparison: {
    thisWeek: number;
    lastWeek: number;
    growthPercent: number | null;
    direction: 'up' | 'down' | 'stable';
  };
}

export const api = {
  /** GET /api/v1/signals/{tenantId} */
  listSignals: (tenantId: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/signals/${tenantId}${qs}`);
  },

  /** GET /api/v1/signals/{tenantId}/{id} */
  getSignal: (tenantId: string, id: string) => request(`/signals/${tenantId}/${id}`),

  /** POST /api/v1/signals */
  createSignal: (body: Record<string, unknown>) =>
    request('/signals', { method: 'POST', body: JSON.stringify(body) }),

  /** PATCH /api/v1/signals/{tenantId}/{id}/status */
  changeStatus: (tenantId: string, id: string, status: string) =>
    request(`/signals/${tenantId}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  /** GET /api/v1/analytics/{tenantId}/signals */
  getAnalytics: (tenantId: string, days?: number) => {
    const qs = days ? `?days=${days}` : '';
    return request(`/analytics/${tenantId}/signals${qs}`) as Promise<SignalAnalytics>;
  },
};
