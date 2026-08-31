import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/** One school section, as GET /departments/{tenant}/sections returns it. */
export interface AcademicSection {
  id: string;
  name: string;
  /** Human copy for the card: "Standards 9–10". */
  standards: string;
  gradeRange: { min: number; max: number };
  students: number;
  studentsInBothFiles: number;
  studentsWithFees: number;
  academicRecords: number;
  feeRecords: number;
  feesCollected: number;
  /** Null when no student in the band has a recorded mark — never 0 as a stand-in. */
  averagePercentage: number | null;
  status: string;
}

export interface AcademicSectionsResponse {
  tenantId: string;
  sections: AcademicSection[];
  totals: { students: number; placed: number; unplaced: number; sections: number };
}

/**
 * The batched per-department metrics. Keyed by department id — a JSON object,
 * which the server casts explicitly so a tenant whose ids run 0,1,2 cannot
 * serialise as an array and break every lookup.
 */
export interface DepartmentIntelligenceResponse {
  departments: Record<string, Record<string, number | null>>;
  support: {
    capability: boolean;
    signals: boolean;
    evidence: boolean;
    cases: boolean;
    decisions: boolean;
    activity: boolean;
    operational: boolean;
  };
  tenant: {
    departments: number;
    people: number;
    signalsTotal: number;
    evidenceTotal: number;
    casesTotal: number;
    capabilityAssignments: number;
  };
}

function withTenant(row: any, tenantId: string): any {
  return { ...row, tenantId };
}

function filterByOrg(rows: any, tenantId: string, orgId?: string): any[] {
  if (!Array.isArray(rows)) return [];
  const scoped = orgId ? rows.filter((r) => String(r.orgId ?? '') === String(orgId)) : rows;
  return scoped.map((r) => withTenant(r, tenantId));
}

function scopedTenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

export const api = {
  /** GET /api/v1/departments/{tenantId} - scoped to the logged-in organization. */
  listDepartments: async (tenantId: string, _orgId?: string) => {
    const tenant = scopedTenant(tenantId);
    return filterByOrg(await request(`/departments/${tenant}`), tenant, tenant);
  },

  /**
   * GET /api/v1/departments/{tenantId}/summary
   *
   * The canonical department and people counts, computed once on the server by
   * App\Domain\Organization\FoundationCounts and published unchanged by the
   * Organization overview, the Intelligence Workspace and this screen. Consume
   * it rather than re-deriving a count in the browser: every screen that
   * counted for itself produced a different number for the same organization.
   */
  getSummary: (tenantId: string) => request(`/departments/${scopedTenant(tenantId)}/summary`),

  /**
   * GET /api/v1/departments/{tenantId}/sections
   *
   * The school sections this organization's imported data describes — Primary,
   * Middle, Secondary, Higher Secondary — derived from the standards its
   * students are actually recorded in. These are NOT rows in the HR system and
   * nothing creates any; the Departments screen renders them, clearly labelled,
   * for a school that has students and no HR units.
   */
  getSections: (tenantId: string): Promise<AcademicSectionsResponse> =>
    request(`/departments/${scopedTenant(tenantId)}/sections`),

  /**
   * GET /api/v1/departments/{tenantId}/intelligence
   *
   * Every department's measurable facts in ONE request, replacing the
   * twin-per-department fan-out the Departments screen used to run — 13 round
   * trips on Fiber Valley, each costing six queries of its own, before a single
   * card could show a number.
   *
   * `support` travels with the counts and is the part that matters: it says
   * whether this ORGANIZATION records each kind of data at all, so the scoring
   * layer can drop a dimension it cannot measure instead of scoring the absence
   * as a zero. See components/department/departmentScore.ts.
   */
  getIntelligence: (tenantId: string): Promise<DepartmentIntelligenceResponse> =>
    request(`/departments/${scopedTenant(tenantId)}/intelligence`),

  /** GET /api/v1/departments/{tenantId}/{id} */
  getDepartment: async (tenantId: string, id: string) => {
    const tenant = scopedTenant(tenantId);
    return withTenant(await request(`/departments/${tenant}/${id}`), tenant);
  },

  /** POST /api/v1/departments */
  createDepartment: async (tenantId: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    return withTenant(await request('/departments', { method: 'POST', body: JSON.stringify(body) }), tenant);
  },

  /** PATCH /api/v1/departments/{tenantId}/{id} - responds {ok:true}, so re-read the row. */
  updateDepartment: async (tenantId: string, id: string, body: Record<string, unknown>) => {
    const tenant = scopedTenant(tenantId);
    await request(`/departments/${tenant}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    return api.getDepartment(tenant, id);
  },

  /** POST /api/v1/departments/{tenantId}/{id}/archive */
  archiveDepartment: (tenantId: string, id: string) =>
    request(`/departments/${scopedTenant(tenantId)}/${id}/archive`, { method: 'POST' }),

  /** GET /api/v1/departments/{tenantId}/{id}/audit */
  getAuditLogs: (tenantId: string, id: string) => request(`/departments/${scopedTenant(tenantId)}/${id}/audit`),

  /** GET /api/v1/departments/{tenantId}/{id}/twin */
  getTwin: (tenantId: string, id: string) => request(`/departments/${scopedTenant(tenantId)}/${id}/twin`),
};
