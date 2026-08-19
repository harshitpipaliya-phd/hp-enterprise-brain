import { getAuthTenantId } from '../utils/tenant.js';
import { request } from './client.js';

/**
 * Students — the people a school's DATASET describes.
 *
 * Distinct from api/person.ts on purpose. A Person is an ERP employee record and
 * `listPeople` fetches every one of them for the browser to filter; that is fine
 * for a tenant with fifty employees and catastrophic for one with thousands of
 * students behind 388,401 exam rows. Every call here is a page: the server
 * filters, sorts, searches and counts, and the browser receives at most one
 * screenful.
 */

export interface Student {
  id: string;
  studentRef: string;
  studentName: string;
  standard: string | null;
  division: string | null;
  batch: string | null;
  studentQuota: string | null;
  uniqueId: string | null;
  academicStandard: string | null;
  sourceDataset: string | null;
  inAcademic: boolean;
  inFees: boolean;
  academicRecords: number;
  feeRecords: number;
  subjectsCount: number;
  avgPercentage: number | null;
  totalObtained: number | null;
  totalMarks: number | null;
  totalPaid: number | null;
  firstAcademicYear: string | null;
  lastAcademicYear: string | null;
  firstReceiptDate: string | null;
  lastReceiptDate: string | null;
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StudentSummary {
  total: number;
  matched: number;
  academicOnly: number;
  feesOnly: number;
  academicRecords: number;
  feeRecords: number;
  totalPaid: number | null;
  projectedAt: string | null;
  datasets: { academic: string | null; fees: string | null };
  filters: {
    standards: string[];
    academicStandards: string[];
    divisions: string[];
    quotas: string[];
    subjects: string[];
  };
}

export interface AcademicRecord {
  id: string;
  naturalKey: string;
  year: string | null;
  standard: string | null;
  subject: string | null;
  exam: string | null;
  obtained: number | null;
  total: number | null;
  percentage: number | null;
  anomalous: boolean;
}

export interface FeeRecord {
  id: string;
  naturalKey: string;
  receiptDate: string | null;
  receiptNo: string | null;
  month: string | null;
  standard: string | null;
  paymentMode: string | null;
  collectedBy: string | null;
  amount: number | null;
  remarks: string | null;
  bankName: string | null;
  chequeNo: string | null;
}

export interface StudentDetail {
  student: Student;
  academicRecords: Page<AcademicRecord> & { dataset: string | null };
  feeRecords: Page<FeeRecord> & { dataset: string | null; totalPaid: number | null };
  relationship: {
    matched: boolean;
    contemporaneous?: boolean;
    joinKey?: string;
    academicYears?: (string | null)[];
    receiptDates?: (string | null)[];
    note: string;
  };
}

export interface StructureDimension {
  key: string;
  label: string;
  description: string;
  values: { label: string; records: number; students: number }[];
}

export interface AcademicStructure {
  kind: string;
  title: string;
  summary: string;
  datasets: { academic: string | null; fees: string | null };
  dimensions: StructureDimension[];
}

export interface StudentListParams {
  q?: string;
  standard?: string;
  academicStandard?: string;
  division?: string;
  quota?: string;
  cohort?: string;
  /** Narrows to students holding at least one result in this subject. */
  subject?: string;
  /**
   * Narrows to one school section — 'primary', 'middle', 'secondary',
   * 'higher-secondary', 'pre-primary'.
   *
   * Resolved SERVER-SIDE against the same grade definition the Departments
   * screen counts its section cards with, so a card saying 1,407 and the list
   * beneath it cannot disagree. An unrecognised key is refused with 422 rather
   * than ignored — an ignored filter would return the whole school under a
   * section heading.
   */
  section?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

function tenant(fallback: string): string {
  return getAuthTenantId() || fallback;
}

function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  /** GET /students/{tenantId} — one page, filtered and sorted by the server. */
  listStudents: (tenantId: string, params: StudentListParams = {}): Promise<Page<Student>> => {
    const t = tenant(tenantId);
    return request(`/students/${t}${qs({
      q: params.q,
      standard: params.standard,
      academic_standard: params.academicStandard,
      division: params.division,
      quota: params.quota,
      cohort: params.cohort,
      subject: params.subject,
      section: params.section,
      sort: params.sort,
      direction: params.direction,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
    })}`);
  },

  /**
   * GET /students/{tenantId}/summary — counts and filter options only.
   *
   * Loaded first and independently of the rows, so the KPI header paints
   * without waiting for a page of students and vice versa.
   */
  getSummary: (tenantId: string): Promise<StudentSummary> =>
    request(`/students/${tenant(tenantId)}/summary`),

  /** GET /students/{tenantId}/{id} — the profile, with the first page of both record types. */
  getStudent: (tenantId: string, id: string): Promise<StudentDetail> =>
    request(`/students/${tenant(tenantId)}/${id}`),

  /** GET /students/{tenantId}/{id}/academic-records — paged. */
  getAcademicRecords: (tenantId: string, id: string, page = 1, pageSize = 50): Promise<Page<AcademicRecord>> =>
    request(`/students/${tenant(tenantId)}/${id}/academic-records${qs({ page, page_size: pageSize })}`),

  /** GET /students/{tenantId}/{id}/fee-records — paged. */
  getFeeRecords: (tenantId: string, id: string, page = 1, pageSize = 50): Promise<Page<FeeRecord>> =>
    request(`/students/${tenant(tenantId)}/${id}/fee-records${qs({ page, page_size: pageSize })}`),

  /** GET /students/{tenantId}/structure — the dataset's dimensions, not HR departments. */
  getStructure: (tenantId: string): Promise<AcademicStructure> =>
    request(`/students/${tenant(tenantId)}/structure`),

  /** GET /students/{tenantId}/intelligence — SQL-derived, cached on a data fingerprint. */
  getIntelligence: (tenantId: string, fresh = false): Promise<any> =>
    request(`/students/${tenant(tenantId)}/intelligence${qs({ fresh: fresh ? 1 : undefined })}`, {
      // The server caches this against a data fingerprint; the client cache only
      // needs to stop a remount refetching it, so a short TTL is enough.
      cacheTtlMs: fresh ? 0 : 30_000,
    }),
};
