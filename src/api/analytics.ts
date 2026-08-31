import { request } from './client.js';
import { getAuthTenantId } from '../utils/tenant.js';

function scopedTenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

export interface PeopleReport {
  tenantId: string;
  generatedAt: string;
  byDepartment: Array<Record<string, unknown>>;
  byRole: Array<{ role: string; count: number }>;
  missingProfile: number;
  missingDepartment: number;
  inactive: number;
}

export const api = {
  getPeopleReport: (tenantId: string): Promise<PeopleReport> =>
    request(`/analytics/${scopedTenant(tenantId)}/reports/people`),
};
