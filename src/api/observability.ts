import { request } from './client.js';

export const api = {
  getAuditLogs: (params?: Record<string, string>) => request(`/audit${params ? '?' + new URLSearchParams(params).toString() : ''}`),
  getActivityTimeline: () => request('/audit/activity'),
  getAuditStats: () => request('/audit/stats'),
  getHealth: () => request('/observability/health'),
  getDatabaseHealth: () => request('/observability/health/database'),
  getNeo4jHealth: () => request('/observability/health/neo4j'),
  getEventsHealth: () => request('/observability/health/events'),
  getSystemHealth: () => request('/observability/health/system'),
  getSystemMetrics: () => request('/observability/metrics/system'),
  getMetrics: (tenantId: string, metricName?: string) => request(`/observability/metrics/${tenantId}${metricName ? `?metricName=${metricName}` : ''}`),
};
