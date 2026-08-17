import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  FolderTree,
  Globe2,
  GraduationCap,
  IdCard,
  Lightbulb,
  Pencil,
  Radio,
  RefreshCw,
  Scale,
  Target,
  Trash2,
  Upload,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { api } from '../../api/intelligence';
import { api as organizationApi } from '../../api/organization';
import { api as capabilityApi } from '../../api/capability';
import { api as departmentApi } from '../../api/department';
import { ingestionApi } from '../../api/ingestion';
import { LoadingState, ErrorState } from '../shared/States';
import type { Organization, View } from '../../App';
import './CommandCenter.css';

interface CommandCenterProps {
  tenantId: string;
  organizationName?: string;
  organization?: Organization;
  onNavigate: (view: View) => void;
  onUpdated?: (organization: Organization) => void;
  onArchive?: () => void;
  onArchived?: (organization: Organization) => void;
}

type Health = 'good' | 'warn' | 'crit';

/**
 * The shape `GET /workspace/{tenantId}/home-metrics` returns.
 *
 * `pipeline.counts` is the important part and it used to be thrown away. Every
 * figure in it is one `COUNT(*) … WHERE tenant_id = ?` over a loop table, which
 * makes it the only source on the client that can say how far this organization
 * has actually travelled without inventing anything.
 */
interface HomeMetrics {
  erp: {
    activePeople: number;
    activeDepartments: number;
    peopleWithoutDepartment: number;
    departmentsWithoutManager: number;
    peopleWithoutProfile: number;
  };
  pipeline?: {
    stage: string;
    blocker: string | null;
    nextAction: string;
    counts: Record<string, number>;
  };
  attention: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    link?: string | null;
    metric?: number;
  }>;
}

type RecordPanel = 'structure' | 'quality' | 'audit';
type OrganizationProfileDraft = Pick<Organization, 'name' | 'orgCode' | 'industry'>;

/**
 * The nine loop stages, in the order data actually moves through them.
 *
 * WHAT THIS REPLACED. The previous strip was also called a pipeline and was also
 * seven boxes, but its numbers came from wherever a number happened to be
 * available: the box labelled "Signals" showed `risks + qualityAlerts + pending
 * recommendations`, the box labelled "Evidence" showed the count of claims
 * MISSING evidence, and "Execution" showed the length of the global task
 * registry — a figure that is identical for every tenant in the installation.
 * Three of the seven were measuring something other than their own label.
 */
const LOOP_STAGES: Array<{ key: string; label: string; icon: ReactNode; view: View; meaning: string }> = [
  { key: 'operationalRecords', label: 'Records', icon: <Database size={17} />, view: 'ingestion', meaning: 'Rows imported from your source files.' },
  { key: 'signals', label: 'Signals', icon: <Radio size={17} />, view: 'signals', meaning: 'Observations the detection rules raised.' },
  { key: 'evidence', label: 'Evidence', icon: <FileSearch size={17} />, view: 'evidence', meaning: 'Records collected to support those signals.' },
  { key: 'cases', label: 'Cases', icon: <Scale size={17} />, view: 'deliberation', meaning: 'Investigations opened against signals.' },
  { key: 'recommendations', label: 'Recommendations', icon: <Lightbulb size={17} />, view: 'deliberation', meaning: 'Actions proposed from those investigations.' },
  { key: 'decisions', label: 'Decisions', icon: <ClipboardCheck size={17} />, view: 'analytics', meaning: 'Recommendations taken to governance.' },
  { key: 'executions', label: 'Executions', icon: <Workflow size={17} />, view: 'executions', meaning: 'Approved decisions carried out.' },
  { key: 'outcomes', label: 'Outcomes', icon: <Target size={17} />, view: 'executions', meaning: 'Measured results of those executions.' },
  { key: 'learnings', label: 'Learnings', icon: <GraduationCap size={17} />, view: 'mentalmodels', meaning: 'Reusable knowledge kept from outcomes.' },
];

export default function CommandCenter({ tenantId, organizationName, organization, onNavigate, onUpdated, onArchive, onArchived }: CommandCenterProps) {
  const [homeMetrics, setHomeMetrics] = useState<HomeMetrics | null>(null);
  const [capabilityCount, setCapabilityCount] = useState<number | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [structure, setStructure] = useState<any>(null);

  const [recordPanel, setRecordPanel] = useState<RecordPanel>('structure');
  const [recordData, setRecordData] = useState<any>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<OrganizationProfileDraft | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      // The one request this screen cannot render without. Everything else is
      // supporting detail and is allowed to fail on its own.
      const metrics = await api.getHomeMetrics(tenantId);
      setHomeMetrics(metrics as HomeMetrics);
      setLoading(false);

      const secondary = await Promise.allSettled([
        capabilityApi.listCapabilities(tenantId, organization?.id),
        departmentApi.listDepartments(tenantId, organization?.id),
        ingestionApi.listSources(tenantId),
        organization ? organizationApi.getStructure(tenantId, organization.id) : Promise.resolve(null),
      ]);

      const [capabilitiesRes, departmentsRes, sourceRes, structureRes] =
        secondary.map((result) => (result.status === 'fulfilled' ? result.value : null));

      if (capabilitiesRes) setCapabilityCount(asArray(capabilitiesRes).length);
      if (departmentsRes) setDepartments(asArray(departmentsRes));
      if (sourceRes) setDataSources(asArray(sourceRes));
      if (structureRes) setStructure(structureRes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, organization?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!organization) {
      setRecordData(null);
      setRecordError(null);
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    setRecordError(null);

    const loader = recordPanel === 'structure'
      ? Promise.all([
        organizationApi.getStructure(tenantId, organization.id),
        departmentApi.listDepartments(tenantId, organization.id),
      ]).then(([structureRow, departmentRows]) => {
        // The Department API is the authoritative collection for the logged-in
        // organization. Intersecting the aggregate with it keeps any stale row
        // out of the table.
        const allowedIds = new Set(asArray(departmentRows).map((department) => String(department.id)));
        return {
          ...structureRow,
          departments: asArray(structureRow?.departments).filter((department) => allowedIds.has(String(department.id))),
        };
      })
      : recordPanel === 'quality'
        ? organizationApi.getDataQuality(tenantId, organization.id)
        : organizationApi.getAuditLogs(tenantId, organization.id);

    loader
      .then((data) => { if (!cancelled) setRecordData(data); })
      .catch((e: any) => { if (!cancelled) setRecordError(e.message || 'Unable to load this organization record.'); })
      .finally(() => { if (!cancelled) setRecordLoading(false); });

    return () => { cancelled = true; };
  }, [organization, recordPanel, tenantId]);

  useEffect(() => {
    if (!organization) return;
    setProfileForm({ name: organization.name, orgCode: organization.orgCode, industry: organization.industry });
    setEditingProfile(false);
    setProfileError(null);
  }, [organization?.id]);

  const beginProfileEdit = () => {
    if (!organization) return;
    setProfileForm({ name: organization.name, orgCode: organization.orgCode, industry: organization.industry });
    setProfileError(null);
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!organization || !profileForm) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const updated = await organizationApi.updateOrganization(organization.tenantId, organization.id, {
        name: profileForm.name,
        orgCode: profileForm.orgCode || null,
        industry: profileForm.industry || null,
      });
      onUpdated?.(updated);
      setEditingProfile(false);
    } catch (e: any) {
      setProfileError(e.message || 'Unable to save organization details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const archiveFromOverview = async () => {
    if (!organization || deleteConfirm !== organization.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await organizationApi.archiveOrganization(organization.tenantId, organization.id);
      setDeleteOpen(false);
      onArchived?.({ ...organization, status: 'archived' });
    } catch (e: any) {
      setDeleteError(e.message || 'Unable to archive organization.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState label="Loading this organization…" />;
  if (error && !homeMetrics) return <ErrorState message={error} />;
  if (!homeMetrics) return null;

  const erp = homeMetrics.erp ?? {
    activePeople: 0, activeDepartments: 0, peopleWithoutDepartment: 0,
    departmentsWithoutManager: 0, peopleWithoutProfile: 0,
  };
  const counts = homeMetrics.pipeline?.counts ?? {};
  const activeDepartments = departments.length > 0
    ? departments.filter((d) => String(d.status ?? '').toLowerCase() === 'active').length
    : erp.activeDepartments;
  const activeDataSources = dataSources.filter((source) => source.is_active !== false && source.isActive !== false);
  const importedRecords = Number(counts.operationalRecords ?? 0);
  // 'all-clear' is the server's way of saying the list is empty. Rendering it as
  // a row would put a permanent non-item at the top of the attention queue.
  const attention = asArray(homeMetrics.attention).filter((item) => item.id !== 'all-clear');

  /*
    The DEPARTMENT API is the authority for which units exist, and the structure
    aggregate is used only for its people-per-department tally.

    They disagree, on purpose. DepartmentController applies a visibility scope
    that hides calculated template rows and superseded cohorts; the structure
    aggregate does not. For one tenant here that is 5 real units against 24 rows,
    and the 19 extra are the industry template — "Primary Teacher", "Early
    Childhood Education" — which belong to no one. Reading the card off the
    aggregate meant this panel listed departments that the Departments screen,
    one click away, said did not exist.
  */
  const summaryDepartments = departments.slice(0, 6).map((department: any) => ({
    id: String(department.id),
    title: String(department.name || 'Unnamed department'),
    meta: `${Number(structure?.peopleByDepartment?.[department.id] ?? 0).toLocaleString()} people`,
  }));

  return (
    <div className="cc-page eb-fade-in">
      <header className="cc-org-hero">
        <div className="cc-org-hero__identity">
          <div className="cc-org-hero__icon">{organization?.logo ? <img src={organization.logo} alt="" /> : <Building2 size={31} />}</div>
          <div>
            <div className="cc-org-hero__title">
              <h1>{organizationName || organization?.name || 'Organization'}</h1>
              <span className={`eb-badge eb-badge-${String(organization?.status || 'active').toLowerCase() === 'active' ? 'success' : 'warning'}`}>
                {organization?.status || 'active'}
              </span>
            </div>
            <p className="cc-org-hero__lede">
              Everything this organization holds, and how far its data has travelled through the intelligence loop.
            </p>
            <div className="cc-org-hero__meta" aria-label="Organization identifiers">
              {organization?.industry && <span><Building2 size={14} /> {organization.industry}</span>}
              {organization?.orgCode && <span><IdCard size={14} /> {organization.orgCode}</span>}
              {organization?.country && <span><Globe2 size={14} /> {organization.country}</span>}
              {organization?.createdDate && <span><Calendar size={14} /> Created {formatShortDate(organization.createdDate)}</span>}
            </div>
          </div>
        </div>
        <div className="cc-org-hero__actions">
          <button type="button" onClick={() => onNavigate('ingestion')}>
            <Upload size={15} /> Open Ingestion Engine <ArrowRight size={15} />
          </button>
          <button type="button" className="eb-pill-btn" onClick={beginProfileEdit} disabled={!organization}>
            <Pencil size={15} /> Edit
          </button>
          <button type="button" className="eb-pill-btn" onClick={() => load('refresh')} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'cc-spin' : ''} /> Refresh
          </button>
          {organization && (
            <button type="button" className="eb-pill-btn cc-danger-outline" onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null); }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </header>

      <section className="cc-kpi-grid" aria-label="What this organization contains">
        <OverviewKpi
          icon={<Users />}
          label="People"
          value={erp.activePeople}
          detail={erp.peopleWithoutDepartment > 0 ? `${erp.peopleWithoutDepartment.toLocaleString()} without a department` : 'All assigned to a department'}
          tone={erp.peopleWithoutDepartment > 0 ? 'warn' : 'good'}
          onClick={() => onNavigate('people')}
        />
        {/* Detail comes from the same list the count does, so the tile cannot
            describe a population it is not counting. The old detail read
            "N without a manager" from an ERP-wide figure while the count came
            from the visibility-scoped list — 15 without a manager, out of 5. */}
        <OverviewKpi
          icon={<FolderTree />}
          label="Departments"
          value={activeDepartments}
          detail={departments.length > 0 && activeDepartments < departments.length
            ? `${(departments.length - activeDepartments).toLocaleString()} inactive or archived`
            : 'All currently active'}
          tone="good"
          onClick={() => onNavigate('departments')}
        />
        <OverviewKpi
          icon={<Target />}
          label="Capabilities"
          value={capabilityCount === null ? 'Unavailable' : capabilityCount}
          detail={capabilityCount === 0 ? 'None defined yet' : 'Defined for this organization'}
          tone={capabilityCount === 0 ? 'warn' : 'good'}
          onClick={() => onNavigate('capabilities')}
        />
        {/*
          "Nothing imported yet" is only true when nothing was imported.

          hpbrain_data_sources holds sources registered through the Ingestion
          Engine; the workbook importer writes operational records without
          registering one. One tenant here holds 96,416 records against zero
          sources, so the flat "Nothing imported yet" sat directly beside an
          "Imported records: 96,416" tile and contradicted it.
        */}
        <OverviewKpi
          icon={<Boxes />}
          label="Data sources"
          value={dataSources.length}
          detail={dataSources.length > 0
            ? `${activeDataSources.length} active`
            : importedRecords > 0
              ? 'Records were loaded without a registered source'
              : 'Nothing imported yet'}
          tone={dataSources.length === 0 && importedRecords === 0 ? 'warn' : 'good'}
          onClick={() => onNavigate('ingestion')}
        />
        <OverviewKpi
          icon={<Database />}
          label="Imported records"
          value={importedRecords}
          detail="Rows held from your source files"
          tone={importedRecords > 0 ? 'good' : 'warn'}
          onClick={() => onNavigate('ingestion')}
        />
      </section>

      <section className="cc-flow" aria-label="Progress through the intelligence loop">
        <div className="cc-section-head">
          <div>
            <span className="cc-kicker">Intelligence loop</span>
            <h2>How far this organization&apos;s data has travelled</h2>
          </div>
        </div>
        <div className="cc-flow__track">
          {LOOP_STAGES.map((stage) => {
            const value = Number(counts[stage.key] ?? 0);
            return (
              <button
                key={stage.key}
                type="button"
                className="cc-flow__stage"
                data-health={value > 0 ? 'good' : 'warn'}
                onClick={() => onNavigate(stage.view)}
                title={stage.meaning}
              >
                <span className="cc-flow__icon">{stage.icon}</span>
                <strong>{stage.label}</strong>
                <em>{value.toLocaleString()}</em>
              </button>
            );
          })}
        </div>
        {homeMetrics.pipeline && (
          <p className="cc-flow__note">
            <strong>Next:</strong> {homeMetrics.pipeline.nextAction}
            {homeMetrics.pipeline.blocker ? ` ${homeMetrics.pipeline.blocker}` : ''}
          </p>
        )}
      </section>

      <div className="cc-main-grid">
        <section className="cc-panel cc-attention" aria-labelledby="cc-attention">
          <div className="cc-section-head">
            <div>
              <span className="cc-kicker">Needs attention</span>
              <h2 id="cc-attention">What to look at first</h2>
            </div>
          </div>

          {attention.length === 0 ? (
            <div className="cc-healthy">
              <CheckCircle2 size={22} />
              <strong>Nothing is waiting</strong>
              <p>No incomplete records, unresolved high-severity signals or pending decisions were found for this organization.</p>
            </div>
          ) : (
            <ul className="cc-attention-list">
              {attention.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate(viewFromHomeLink(item.link))}>
                    <span className="cc-attention__tone" data-health={item.severity === 'high' ? 'crit' : 'warn'}><AlertTriangle size={16} /></span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="cc-side-stack">
          <section className="cc-panel cc-org-details">
            <div className="cc-section-head">
              <div>
                <span className="cc-kicker">Organization record</span>
                <h2>Details</h2>
              </div>
              {organization && !editingProfile && (
                <button type="button" className="eb-link-btn" onClick={beginProfileEdit}>Edit</button>
              )}
            </div>
            {!organization ? (
              <p className="cc-empty">No organization record is selected.</p>
            ) : editingProfile && profileForm ? (
              <form className="cc-profile-editor" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
                <label>Name<input required value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label>
                <label>Organization code<input value={profileForm.orgCode} onChange={(event) => setProfileForm({ ...profileForm, orgCode: event.target.value })} /></label>
                <label>Industry<input value={profileForm.industry || ''} onChange={(event) => setProfileForm({ ...profileForm, industry: event.target.value || null })} /></label>
                <p className="cc-profile-editor__note">Legal name, logo, country, timezone, currency and status are owned by the connected source system and are read-only here.</p>
                {profileError && <p className="cc-record__error">{profileError}</p>}
                <div className="cc-profile-editor__actions">
                  <button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save changes'}</button>
                  <button type="button" className="eb-pill-btn" disabled={profileSaving} onClick={() => { setEditingProfile(false); setProfileError(null); }}>Cancel</button>
                </div>
              </form>
            ) : (
              <dl className="cc-detail-list">
                <div><dt>Legal name</dt><dd>{organization.legalName || 'Not recorded'}</dd></div>
                <div><dt>Organization code</dt><dd>{organization.orgCode || 'Not recorded'}</dd></div>
                <div><dt>Industry</dt><dd>{organization.industry || 'Not recorded'}</dd></div>
                <div><dt>Country</dt><dd>{organization.country || 'Not recorded'}</dd></div>
                <div><dt>Timezone</dt><dd>{organization.timezone || 'Not recorded'}</dd></div>
                <div><dt>Currency</dt><dd>{organization.currency || 'Not recorded'}</dd></div>
                <div><dt>Last updated</dt><dd>{formatDate(organization.updatedDate) || 'Not recorded'}</dd></div>
              </dl>
            )}
          </section>

          <OverviewListCard
            title="Departments"
            actionLabel="View all"
            onAction={() => onNavigate('departments')}
            empty="No departments are recorded in the source system for this organization."
            rows={summaryDepartments}
          />

          <OverviewListCard
            title="Data sources"
            actionLabel="Import data"
            onAction={() => onNavigate('ingestion')}
            empty="No data has been imported yet. Open the Ingestion Engine to upload your first file."
            rows={dataSources.slice(0, 6).map((source: any) => ({
              id: String(source.id ?? source.source_key ?? source.sourceKey),
              title: String(source.display_name ?? source.displayName ?? source.source_key ?? 'Data source'),
              meta: String(source.source_type ?? source.sourceType ?? 'source'),
              badge: source.is_active === false || source.isActive === false ? 'Inactive' : 'Active',
            }))}
          />
        </aside>
      </div>

      {organization && (
        <section className="cc-record cc-panel" aria-label="Organization structure, data quality and audit">
          <div className="cc-section-head cc-record__head">
            <div>
              <span className="cc-kicker">Source records</span>
              <h2>Structure, data quality and audit history</h2>
            </div>
            <div className="cc-record__actions">
              {onArchive && <button type="button" className="eb-link-btn cc-danger-link" onClick={onArchive}>Archive organization</button>}
            </div>
          </div>
          <div className="cc-tabs" role="tablist" aria-label="Organization record sections">
            {([
              ['structure', 'Structure'], ['quality', 'Data quality'], ['audit', 'Audit'],
            ] as Array<[RecordPanel, string]>).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={recordPanel === key} className={recordPanel === key ? 'is-active' : ''} onClick={() => setRecordPanel(key)}>{label}</button>
            ))}
          </div>
          {recordLoading && <p className="cc-empty">Loading {recordPanel === 'quality' ? 'data quality' : recordPanel}…</p>}
          {recordError && <p className="cc-record__error">{recordError}</p>}
          {!recordLoading && !recordError && recordPanel === 'structure' && <StructurePanel data={recordData} />}
          {!recordLoading && !recordError && recordPanel === 'quality' && <QualityPanel data={recordData} />}
          {!recordLoading && !recordError && recordPanel === 'audit' && <AuditPanel data={recordData} />}
        </section>
      )}

      {organization && deleteOpen && (
        <div className="cc-modal-backdrop" role="presentation">
          <div className="cc-delete-modal" role="dialog" aria-modal="true" aria-labelledby="cc-delete-title">
            <button
              type="button"
              className="cc-modal-close"
              aria-label="Close"
              onClick={() => { setDeleteOpen(false); setDeleteError(null); }}
              disabled={deleting}
            >
              <X size={18} />
            </button>
            <div className="cc-delete-modal__head">
              <span><AlertTriangle size={26} /></span>
              <div>
                <h2 id="cc-delete-title">Delete organization</h2>
                <p>Are you sure you want to delete <strong>{organization.name}</strong>?</p>
              </div>
            </div>
            <p className="cc-delete-modal__warning">
              This archives the organization through the tenant-scoped archive endpoint. Data owned by the connected source system is not deleted.
            </p>
            <label className="cc-delete-modal__confirm">
              To confirm, type the organization name below.
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="Type organization name"
                disabled={deleting}
              />
            </label>
            {deleteError && <p className="cc-record__error">{deleteError}</p>}
            <div className="cc-delete-modal__actions">
              <button type="button" className="eb-pill-btn" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button>
              <button type="button" className="cc-delete-submit" disabled={deleteConfirm !== organization.name || deleting} onClick={archiveFromOverview}>
                <Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="cc-hint">
        Press <kbd>Ctrl</kbd> + <kbd>K</kbd> anywhere to jump straight to any screen.
      </p>
    </div>
  );
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function StructurePanel({ data }: { data: any }) {
  const departments = asArray(data?.departments);
  if (!data || departments.length === 0) {
    return <p className="cc-empty">No departments are recorded in the source system for this organization. Departments appear here once they exist in the connected HR system.</p>;
  }

  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead><tr><th>Department</th><th>People</th><th>Reports to</th><th>Status</th></tr></thead>
        <tbody>{departments.map((department: any) => (
          <tr key={department.id}>
            <td>{department.name || 'Unnamed department'}</td>
            <td>{Number(data.peopleByDepartment?.[department.id] ?? 0).toLocaleString()}</td>
            <td>{department.parentId && department.parentId !== '0' ? (data.heads?.[department.parentId] || data.names?.[department.parentId] || 'Parent unit') : 'Top level'}</td>
            <td><span className="eb-badge eb-badge-info">{department.status || 'unknown'}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function QualityPanel({ data }: { data: any }) {
  if (!data) return <p className="cc-empty">No data-quality result is available yet.</p>;

  const assessed = Number(data.totalPeople ?? 0) + Number(data.totalDepartments ?? 0);
  if (assessed === 0) {
    return <p className="cc-empty">No people or departments have been recorded yet, so there is nothing to assess for completeness.</p>;
  }

  const issues = asArray(data.issues);
  return (
    <div className="cc-quality">
      <div className="cc-quality__score">
        <strong>{formatNumber(data.score)}%</strong>
        <span>Records with required fields filled in</span>
        <small>{Number(data.totalPeople ?? 0).toLocaleString()} people · {Number(data.totalDepartments ?? 0).toLocaleString()} departments assessed</small>
      </div>
      {issues.length === 0 ? <p className="cc-empty"><CheckCircle2 size={16} /> No missing fields were found.</p> : (
        <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Missing field</th><th>Records affected</th><th>Severity</th></tr></thead><tbody>
          {issues.map((issue: any, index: number) => (
            <tr key={`${issue.field}-${index}`}>
              <td>{humanizeField(String(issue.field ?? ''))}</td>
              <td>{Number(issue.count ?? 0).toLocaleString()}</td>
              <td><span className={`eb-badge eb-badge-${issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'info'}`}>{issue.severity || 'unknown'}</span></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}

function AuditPanel({ data }: { data: any }) {
  const records = asArray(data);
  if (records.length === 0) {
    return <p className="cc-empty">No changes to this organization&apos;s record have been logged yet. Edits made here will appear in this list.</p>;
  }
  return <ul className="cc-audit-list">{records.slice(0, 20).map((record: any, index: number) => (
    <li key={record.id ?? index}>
      <strong>{humanizeField(String(record.action || 'Recorded change'))}</strong>
      <span>{record.actorName || record.actorId || record.actor_id || 'System'} · {formatDate(record.createdAt || record.createdDate || record.created_at) || 'no timestamp'}</span>
    </li>
  ))}</ul>;
}

/** `people.missing_email` → `People missing email`. Never show a column name. */
function humanizeField(value: string): string {
  const words = value.replace(/[._]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatNumber(value: unknown): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '0';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function viewFromHomeLink(link: string | null | undefined): View {
  if (link === 'people') return 'people';
  if (link === 'departments') return 'departments';
  if (link === 'signals') return 'signals';
  if (link === 'evidence') return 'evidence';
  if (link === 'workspace') return 'deliberation';
  return 'executive';
}

function OverviewKpi({
  icon, label, value, detail, tone, onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: Health;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span>{icon}</span>
      <div>
        <em>{label}</em>
        <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
        <small>{detail}</small>
      </div>
    </>
  );

  return onClick ? (
    <button type="button" className="cc-overview-kpi cc-overview-kpi--action" data-health={tone} onClick={onClick}>{body}</button>
  ) : (
    <div className="cc-overview-kpi" data-health={tone}>{body}</div>
  );
}

function OverviewListCard({
  title, actionLabel, onAction, rows, empty,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  empty: string;
  rows: Array<{ id: string; title: string; meta: string; badge?: string | number | null }>;
}) {
  return (
    <section className="cc-panel cc-overview-list" aria-label={title}>
      <div className="cc-section-head">
        <div>
          <h2>{title}</h2>
        </div>
        <button type="button" className="eb-link-btn" onClick={onAction}>{actionLabel}</button>
      </div>
      {rows.length === 0 ? (
        <p className="cc-empty">{empty}</p>
      ) : (
        <ul className="cc-overview-list__rows">
          {rows.map((row) => (
            <li key={row.id}>
              <span>
                <strong>{row.title}</strong>
                <small>{row.meta}</small>
              </span>
              {row.badge !== undefined && row.badge !== null && row.badge !== '' && (
                <em className="eb-badge eb-badge-info">{row.badge}</em>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
