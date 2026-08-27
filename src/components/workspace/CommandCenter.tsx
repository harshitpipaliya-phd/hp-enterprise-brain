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
  Mail,
  Network,
  Pencil,
  Phone,
  Radio,
  RefreshCw,
  Scale,
  Target,
  Trash2,
  Upload,
  Users,
  Workflow,
  X
} from 'lucide-react';
import { api } from '../../api/intelligence';
import { api as organizationApi } from '../../api/organization';
import type { DeletionPreview, DeletionResult } from '../../api/organization';
import { api as capabilityApi } from '../../api/capability';
import { ingestionApi } from '../../api/ingestion';
import { LoadingState, ErrorState } from '../shared/States';
import type { Organization, View } from '../../App';
import type { OrganizationField } from '../../api/organization';
import { ExploreInGraphButton } from '../graph/ExploreInGraphButton';
import './CommandCenter.css';

interface CommandCenterProps {
  tenantId: string;
  organizationName?: string;
  organization?: Organization;
  /**
   * The signed-in role, used ONLY to decide which workspace tiles to draw.
   *
   * Advisory, exactly as in the sidebar: the API re-checks permissions from the
   * JWT on every request. Its purpose here is that a tile never leads somewhere
   * the menu hides, because a dead tile reads as a broken product rather than
   * as a boundary.
   */
  userRole?: string | null;
  onNavigate: (view: View) => void;
  onUpdated?: (organization: Organization) => void;
  /**
   * Navigate to the dedicated archive screen. Archive is still a real, separate
   * operation reachable from the overview — it soft-deletes the organization
   * row and destroys nothing — so this stays.
   *
   * There is no onArchived here any more: the overview's own confirmation
   * dialog now performs a PERMANENT deletion, and archiving is completed on the
   * archive screen, which reports its own result.
   */
  onArchive?: () => void;
  /**
   * The organization was PERMANENTLY deleted. There is no tenant left to
   * render afterwards, so the caller must clear its selection and leave.
   */
  onDeleted?: (organization: Organization, result: DeletionResult) => void;
  /** Open Graph Explorer centred on this organization. Optional: absent in tests. */
  onExploreInGraph?: (label: string, id: string) => void;
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
  /** The STAFF roster from the connected HR system. Never students. */
  erp: {
    activePeople: number;
    activeDepartments: number;
    /** 'hr' | 'academic' | 'none' — what activeDepartments counted. */
    departmentSource?: string;
    peopleWithoutDepartment: number;
    departmentsWithoutManager: number;
    peopleWithoutProfile: number;
  };
  /**
   * The other population this organization holds: children derived from
   * imported academic and fee files, and the source rows they came from.
   *
   * Rendered BESIDE `erp`, never added to it. Lions genuinely has one staff
   * account and 7,445 students; showing only the first under the word "People"
   * is what made the overview look like it disagreed with the People screen.
   */
  imported?: {
    students: number;
    studentsInBothFiles: number;
    studentsSupported: boolean;
    records: number;
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
type OrganizationProfileDraft = Partial<Record<OrganizationField, string | null>>;

/**
 * ONE DESCRIPTION OF THE ORGANIZATION RECORD, read by both the detail list and
 * the edit form.
 *
 * The two used to be separate hand-written lists, which is how the panel came
 * to show six rows of "Not recorded" while the form offered three inputs that
 * could not fix any of them. Order here is reading order: who this organization
 * legally is, where it is, how to reach it, how big it is.
 *
 * NOTHING IN THIS LIST IS ASSUMED TO EXIST. It is the product's vocabulary; the
 * server says per tenant which entries are backed by a real column
 * (`identityFields` / `profileFields`), and both renderings intersect with that
 * before drawing anything. A tenant whose ERP has no website column gets no
 * Website row and no Website input — not a blank one.
 */
interface OrganizationFieldSpec {
  key: OrganizationField;
  label: string;
  /** Rendered across both columns of the editor grid — long free text. */
  wide?: boolean;
  inputType?: 'text' | 'email' | 'url' | 'tel';
  required?: boolean;
  /** How the value reads in the detail list, when it is not simply itself. */
  display?: (value: string) => string;
}

const ORGANIZATION_FIELDS: OrganizationFieldSpec[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'legalName', label: 'Legal name' },
  { key: 'orgCode', label: 'Organization code' },
  { key: 'industry', label: 'Industry' },
  { key: 'registrationNumber', label: 'Registration number' },
  { key: 'taxId', label: 'Tax registration' },
  { key: 'country', label: 'Country' },
  { key: 'address', label: 'Registered address', wide: true },
  { key: 'email', label: 'Email', inputType: 'email' },
  { key: 'phone', label: 'Phone', inputType: 'tel' },
  { key: 'website', label: 'Website', inputType: 'url' },
  { key: 'contactPerson', label: 'Primary contact' },
  // A BAND ('51-200'), NOT A HEADCOUNT. Labelled so it cannot be read as one:
  // the People tile beside it reports the roster the ERP actually holds, and
  // the two disagreeing is normal rather than a data-quality problem.
  { key: 'employeeCount', label: 'Recorded size', display: (v) => `${v} employees` },
  { key: 'workWeek', label: 'Working week', display: describeWorkWeek },
  { key: 'logo', label: 'Logo' },
];

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

export default function CommandCenter({ tenantId, organizationName, organization, onNavigate, onUpdated, onArchive, onDeleted, onExploreInGraph }: CommandCenterProps) {
  const [homeMetrics, setHomeMetrics] = useState<HomeMetrics | null>(null);
  const [capabilityCount, setCapabilityCount] = useState<number | null>(null);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [structure, setStructure] = useState<any>(null);

  const [recordPanel, setRecordPanel] = useState<RecordPanel>('structure');
  const [logoBroken, setLogoBroken] = useState(false);
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
  // What the deletion would actually destroy, fetched when the dialog opens.
  // Read-only: opening the dialog must never be able to delete anything.
  const [deletePreview, setDeletePreview] = useState<DeletionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Set when the server refuses because this tenant holds rows in tables owned
  // by other applications sharing the database. The administrator has to say so
  // explicitly; the Brain will not decide that on their behalf.
  const [acknowledgeSourceData, setAcknowledgeSourceData] = useState(false);
  const [sourceSystemPrompt, setSourceSystemPrompt] = useState<
    { message: string; tables: { table: string; rows: number }[]; rows: number } | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSecondary = useCallback(async () => {
    const secondary = await Promise.allSettled([
      capabilityApi.listCapabilities(tenantId, organization?.id),
      ingestionApi.listSources(tenantId),
    ]);

    const [capabilitiesRes, sourceRes] =
      secondary.map((result) => (result.status === 'fulfilled' ? result.value : null));

    if (capabilitiesRes) setCapabilityCount(asArray(capabilitiesRes).length);
    if (sourceRes) setDataSources(asArray(sourceRes));
  }, [tenantId, organization?.id]);

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
      window.setTimeout(() => { void loadSecondary(); }, 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, loadSecondary]);

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

    /*
      ONE REQUEST, because there is now one answer.

      This used to fetch the structure aggregate AND the department list, then
      intersect them in the browser — the aggregate included ERP template rows
      the list excluded, so without the intersection this panel listed units the
      Departments screen said did not exist. Both endpoints read
      OrganizationStructureService now, so they cannot disagree and there is
      nothing to reconcile client-side.
    */
    const loader = recordPanel === 'structure'
      ? organizationApi.getStructure(tenantId, organization.id)
      : recordPanel === 'quality'
        ? organizationApi.getDataQuality(tenantId, organization.id)
        : organizationApi.getAuditLogs(tenantId, organization.id);

    loader
      .then((data) => {
        if (cancelled) return;
        setRecordData(data);
        if (recordPanel === 'structure') setStructure(data);
      })
      .catch((e: any) => { if (!cancelled) setRecordError(e.message || 'Unable to load this organization record.'); })
      .finally(() => { if (!cancelled) setRecordLoading(false); });

    return () => { cancelled = true; };
  }, [organization, recordPanel, tenantId]);

  useEffect(() => {
    if (!organization) return;
    setLogoBroken(false);
    setProfileForm(profileDraftFromOrganization(organization));
    setEditingProfile(false);
    setProfileError(null);
  }, [organization?.id]);

  const beginProfileEdit = () => {
    if (!organization) return;
    setProfileForm(profileDraftFromOrganization(organization));
    setProfileError(null);
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!organization || !profileForm) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      /*
        ONLY WHAT THIS TENANT CAN HOLD, and only what the user could see.

        Sending the whole vocabulary would ask the server to write columns this
        organization's source system does not have; sending a field the form
        never rendered would blank it from an untouched draft. Both are avoided
        by building the payload from the same spec list the form was built from.
      */
      const payload: Record<string, string | null> = {};
      for (const spec of supportedOrganizationFields(organization)) {
        const value = (profileForm[spec.key] ?? '').toString().trim();
        payload[spec.key] = value === '' ? null : value;
      }

      const updated = await organizationApi.updateOrganization(organization.tenantId, organization.id, payload);
      onUpdated?.(updated);
      setEditingProfile(false);
    } catch (e: any) {
      setProfileError(e.message || 'Unable to save organization details.');
    } finally {
      setProfileSaving(false);
    }
  };

  /**
   * Open the confirmation dialog and load the plan.
   *
   * The preview is a GET and writes nothing, so this is safe to run on open —
   * which matters, because the alternative is asking someone to type an
   * organization's name to authorise a deletion whose size they cannot see.
   */
  const openDeleteDialog = async () => {
    if (!organization) return;
    setDeleteOpen(true);
    setDeleteConfirm('');
    setDeleteError(null);
    setAcknowledgeSourceData(false);
    setSourceSystemPrompt(null);
    setDeletePreview(null);
    setPreviewLoading(true);
    try {
      setDeletePreview(await organizationApi.getDeletionPreview(organization.tenantId, organization.id));
    } catch (e: any) {
      // A preview that fails to load does not block the deletion — the server
      // re-derives the plan on the real request anyway. It is reported so the
      // figures being absent does not read as "there is nothing to delete".
      setDeleteError(e.message || 'Could not load the deletion summary. The counts below are unavailable.');
    } finally {
      setPreviewLoading(false);
    }
  };

  /**
   * THE ONE CANONICAL NAME, and the only string this dialog may display or
   * compare against.
   *
   * It comes from the deletion preview, which reads it through the same
   * EntityResolver path TenantPurgeService uses to check the confirmation. That
   * shared origin is the entire point.
   *
   * It is deliberately NOT `organization.name`. That value arrives from the
   * login payload and is persisted in session state, and for an ARCHIVED
   * organization it used to be a placeholder the server manufactured
   * ("Organization 8") rather than the real name ("Lions"). The dialog then
   * displayed the placeholder, asked the administrator to type the placeholder,
   * and sent the placeholder to a server that was comparing against the real
   * name — so the confirmation could never succeed no matter what was typed.
   *
   * null until the preview resolves, which is what keeps the confirm button
   * disabled: with no canonical name there is nothing safe to compare against,
   * and guessing one is exactly the bug being fixed.
   */
  const canonicalName = deletePreview?.organizationName ?? null;

  /**
   * PERMANENT deletion. Not the archive.
   *
   * The button that calls this is disabled until the typed name matches the
   * canonical name exactly, and the server checks the same thing again — the
   * disabled button is a courtesy, the server-side compare is the control.
   */
  const deletePermanently = async () => {
    if (!organization || canonicalName === null || deleteConfirm !== canonicalName) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await organizationApi.deleteOrganizationPermanently(
        organization.tenantId,
        deleteConfirm,
        acknowledgeSourceData,
      );
      setDeleteOpen(false);
      onDeleted?.(organization, result);
    } catch (e: any) {
      // ApiError carries the parsed body on responseJson. The top-level
      // `message` is only the error CODE for these responses, so the readable
      // sentence has to come off the body or the dialog shows the user a slug.
      const body = e?.responseJson ?? null;
      const detail = body?.message || e?.message || 'Unable to delete organization.';

      if (e?.status === 409 && body?.error === 'source_system_data_present') {
        // Not a failure — a question. The checkbox rendered below is the answer,
        // and nothing was deleted.
        setSourceSystemPrompt({ message: detail, tables: body.tables ?? [], rows: body.rows ?? 0 });
        setDeleteError(null);
      } else {
        setDeleteError(detail);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState label="Loading this organization…" />;
  if (error && !homeMetrics) return <ErrorState message={error} />;
  if (!homeMetrics) return null;

  const erp = homeMetrics.erp ?? {
    activePeople: 0, activeDepartments: 0, departmentSource: 'none', peopleWithoutDepartment: 0,
    departmentsWithoutManager: 0, peopleWithoutProfile: 0,
  };
  const departmentSource = erp.departmentSource ?? 'none';
  const imported = homeMetrics.imported ?? null;
  const counts = homeMetrics.pipeline?.counts ?? {};
  /*
    THE SERVER'S COUNT, not a length of whatever this screen happens to hold.

    This used to prefer `departments.length` — the length of the array returned
    by the department LIST endpoint — and fall back to the metrics figure only
    when that list was empty. Two consequences, both visible: the tile changed
    depending on which of two requests had resolved, and for an organization
    whose structure is derived rather than listed (a school with no HR units)
    the list is legitimately empty and the tile printed the fallback zero while
    the Departments screen showed four sections.

    `erp.activeDepartments` is now OrganizationStructureService's answer, which
    is the same answer the Departments screen, the Intelligence Workspace, the
    analytics report and the data-quality score all publish. There is nothing
    left for this screen to decide.
  */
  const activeDepartments = erp.activeDepartments;
  const activeDataSources = dataSources.filter((source) => source.is_active !== false && source.isActive !== false);
  const importedRecords = Number(counts.operationalRecords ?? 0);
  // 'all-clear' is the server's way of saying the list is empty. Rendering it as
  // a row would put a permanent non-item at the top of the attention queue.
  const attention = asArray(homeMetrics.attention).filter((item) => item.id !== 'all-clear');

  /*
    ONE SOURCE FOR BOTH THE ROWS AND THEIR HEADCOUNTS.

    These used to come from two endpoints that disagreed — the list applied a
    visibility scope, the aggregate did not, so this panel had to intersect them
    to avoid showing ERP template rows the Departments screen denied existed.
    Both are OrganizationStructureService's answer now.

    `memberType` decides the noun. The members of an HR unit are staff; the
    members of a derived teaching section are students. Printing "people" over
    both is the mislabelling that produced the earlier round of contradictions.
  */
  const structureDepartments = asArray(structure?.departments);
  const memberNoun = structure?.memberType === 'students' ? 'students' : 'people';
  const summaryDepartments = structureDepartments.slice(0, 6).map((department: any) => ({
    id: String(department.id),
    title: String(department.name || 'Unnamed department'),
    meta: `${Number(structure?.peopleByDepartment?.[department.id] ?? 0).toLocaleString()} ${memberNoun}`,
  }));
  const recordedDetails = organization ? organizationDetailRows(organization) : [];
  const structureFindings = departmentConcentration(structure, memberNoun);
  const loopStagesWithData = LOOP_STAGES.filter((stage) => Number(counts[stage.key] ?? 0) > 0).length;
  const loopCoverage = Math.round((loopStagesWithData / LOOP_STAGES.length) * 100);

  return (
    <div className="cc-page eb-fade-in">
      <header className="cc-org-hero">
        <div className="cc-org-hero__identity">
          {/*
            A LOGO THAT DOES NOT LOAD MUST LOOK LIKE NO LOGO, NOT LIKE A FAULT.

            The source system stores a bare filename ('1756884159_Sids.jpg'),
            which resolves against whatever origin the SPA happens to be served
            from and frequently 404s. The <img> then rendered as an empty tinted
            square — the first thing on the page, and unmistakably broken.

            `logoBroken` flips on the element's own error event, so the fallback
            is driven by whether the image actually loaded rather than by
            guessing at the URL's shape. Reset per organization, so switching to
            one whose logo does resolve shows it.
          */}
          <div className="cc-org-hero__icon">
            {organization?.logo && !logoBroken
              ? <img src={organization.logo} alt="" onError={() => setLogoBroken(true)} />
              : <Building2 size={31} />}
          </div>
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
              {organization?.email && <span><Mail size={14} /> {organization.email}</span>}
              {organization?.phone && <span><Phone size={14} /> {organization.phone}</span>}
              {organization?.createdDate && <span><Calendar size={14} /> Created {formatShortDate(organization.createdDate)}</span>}
            </div>
          </div>
        </div>
        <div className="cc-org-hero__actions">
          {/* The organization is the graph's root, so this opens the default
              view rather than a focused subgraph — but it goes through the same
              handler as every other entry point. */}
          <ExploreInGraphButton
            label="Organization"
            id={tenantId}
            entityName={organizationName || organization?.name}
            onExplore={onExploreInGraph}
            className="eb-pill-btn"
          />
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
            <button type="button" className="eb-pill-btn cc-danger-outline" onClick={openDeleteDialog}>
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </header>

      <section className="cc-kpi-grid" aria-label="What this organization contains">
        <OverviewKpi
          icon={<FolderTree />}
          label="Departments"
          value={activeDepartments}
          detail={activeDepartments === 0
            ? 'No departments are recorded for this organization'
            : departmentSource === 'academic'
              ? 'Teaching sections, from imported academic data'
              : 'Units in the connected HR system'}
          tone={activeDepartments === 0 ? 'warn' : 'good'}
          onClick={() => onNavigate('departments')}
        />
        {/*
          "Staff", not "People", and it says where it comes from.

          THE DEFECT THIS FIXES. This tile read "People 1" for Lions — correct,
          it counts the connected HR roster and that roster holds one account —
          directly beside "Imported records 398,831", with a People screen one
          click away reading "Students 7,445". Three true numbers about three
          different populations, none of them labelled, which reads as a system
          contradicting itself. The count is unchanged; what it is a count OF is
          now on the tile.
        */}
        <OverviewKpi
          icon={<Users />}
          label="Staff"
          value={erp.activePeople}
          detail={erp.peopleWithoutDepartment > 0
            ? `From the connected HR system · ${erp.peopleWithoutDepartment.toLocaleString()} without a department`
            : 'People recorded in the connected HR system'}
          tone={erp.peopleWithoutDepartment > 0 ? 'warn' : 'good'}
          onClick={() => onNavigate('people')}
        />
        {/*
          Shown only where student data exists, so a manufacturer or a telecom
          operator is not asked to read a "Students 0" tile about an entity it
          has no concept of. Never merged into Staff above.
        */}
        {imported && imported.studentsSupported && imported.students > 0 && (
          <OverviewKpi
            icon={<GraduationCap />}
            label="Students"
            value={imported.students}
            detail={imported.studentsInBothFiles > 0
              ? `From imported academic & fee data · ${imported.studentsInBothFiles.toLocaleString()} in both files`
              : 'From imported academic & fee data'}
            tone="good"
            onClick={() => onNavigate('people')}
          />
        )}
        {/* Detail comes from the same list the count does, so the tile cannot
            describe a population it is not counting. The old detail read
            "N without a manager" from an ERP-wide figure while the count came
            from the visibility-scoped list — 15 without a manager, out of 5. */}
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
        {/*
          ROWS, NOT ENTITIES, and the tile now says so. 398,831 imported rows
          describe 7,445 children; a reader comparing this figure with the
          Staff tile above was comparing a row count with a headcount.
        */}
        <OverviewKpi
          icon={<Database />}
          label="Imported records"
          value={importedRecords}
          detail={imported && imported.students > 0
            ? `Source rows describing ${imported.students.toLocaleString()} students`
            : 'Rows held from your source files'}
          tone={importedRecords > 0 ? 'good' : 'warn'}
          onClick={() => onNavigate('ingestion')}
        />
        <OverviewKpi
          icon={<Network />}
          label="Intelligence health"
          value={`${loopCoverage}%`}
          detail={`${loopStagesWithData} of ${LOOP_STAGES.length} loop stages contain tenant data`}
          tone={loopStagesWithData >= 4 ? 'good' : loopStagesWithData > 0 ? 'warn' : 'crit'}
          onClick={() => onNavigate('signals')}
        />
      </section>

      {/*
        THE WHOLE LOOP, IN THE ORDER DATA MOVES THROUGH IT.

        Foundation first — what the organization IS — then each stage of the
        intelligence loop in sequence, then the cross-cutting views. Ordered
        rather than alphabetised because the sequence is the product's central
        claim: a signal is only meaningful beside the evidence under it, and a
        decision only beside the case that produced it.

        FILTERED BY ROLE. `visibleViewsForRole` is the same advisory list the
        sidebar draws from, so a tile is never offered here that the menu hides
        — a member clicking through to a screen their role cannot open would
        land on an empty pane, which reads as a broken product rather than as a
        permission boundary.
      */}
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
                    <span className="cc-attention__tone" data-health={severityTone(item.severity)}><AlertTriangle size={16} /></span>
                    <span>
                      <strong>
                        {item.title}
                        {/* The queue is already in server-ranked order; the chip
                            says how far apart two adjacent rows actually are,
                            which the ordering alone cannot. */}
                        <em className="cc-attention__severity" data-health={severityTone(item.severity)}>{item.severity}</em>
                      </strong>
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
          {/*
            WHERE THE ORGANIZATION IS LOPSIDED.

            The attention queue above is the server's, and it is about records:
            people without a unit, unresolved signals, decisions waiting. This is
            about SHAPE, and it is derived here because the structure payload is
            already on screen for the org chart — no second request, and nothing
            claimed that the reader cannot check against the table below.

            It renders only when there is something to say. A well-balanced
            organization gets no panel rather than a panel saying it is fine.
          */}
          {structureFindings.length > 0 && (
            <section className="cc-panel cc-concentration" aria-labelledby="cc-concentration">
              <div className="cc-section-head">
                <div>
                  <span className="cc-kicker">Structure</span>
                  <h2 id="cc-concentration">How the workforce sits</h2>
                </div>
              </div>
              <ul className="cc-concentration__list">
                {structureFindings.map((finding) => (
                  <li key={finding.title} data-tone={finding.tone}>
                    <strong>{finding.title}</strong>
                    <small>{finding.detail}</small>
                  </li>
                ))}
              </ul>
              <button type="button" className="eb-link-btn cc-concentration__more" onClick={() => onNavigate('departments')}>
                Open Department Performance
              </button>
            </section>
          )}

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
                {supportedOrganizationFields(organization).map((spec) => (
                  <label key={spec.key} className={spec.wide ? 'cc-profile-editor__wide' : undefined}>
                    {spec.label}
                    <input
                      type={spec.inputType ?? 'text'}
                      required={spec.required}
                      value={profileForm[spec.key] ?? ''}
                      onChange={(event) => setProfileForm({ ...profileForm, [spec.key]: event.target.value })}
                    />
                  </label>
                ))}
                <p className="cc-profile-editor__note">
                  These are the organization fields this tenant&rsquo;s connected system of record can hold.
                  Anything it does not keep a column for is not shown, rather than offered and then discarded.
                </p>
                {profileError && <p className="cc-record__error">{profileError}</p>}
                <div className="cc-profile-editor__actions">
                  <button type="submit" disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save changes'}</button>
                  <button type="button" className="eb-pill-btn" disabled={profileSaving} onClick={() => { setEditingProfile(false); setProfileError(null); }}>Cancel</button>
                </div>
              </form>
            ) : recordedDetails.length > 0 ? (
              <dl className="cc-detail-list">
                {recordedDetails.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="cc-empty">This source record has no additional profile fields mapped yet.</p>
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
                <h2 id="cc-delete-title">Delete Organization?</h2>
                {/* The canonical name, never the session's copy — see canonicalName. */}
                <p>
                  Are you sure you want to permanently delete{' '}
                  <strong>{canonicalName ?? '…'}</strong>?
                </p>
              </div>
            </div>
            <p className="cc-delete-modal__warning">
              This will permanently delete the organization and all of its associated tenant data,
              including users and organization-specific records. This action cannot be undone.
            </p>

            {/* What is actually about to be destroyed. Loaded from a read-only
                preview endpoint when the dialog opened — asking someone to type
                an organization's name to authorise a deletion whose size they
                cannot see is a confirmation in form only. */}
            {previewLoading && <p className="cc-delete-modal__counts">Calculating what will be deleted…</p>}
            {deletePreview && (
              <div className="cc-delete-modal__counts">
                <p>
                  <strong>{deletePreview.totals.rows.toLocaleString()}</strong> record
                  {deletePreview.totals.rows === 1 ? '' : 's'} across{' '}
                  <strong>{deletePreview.totals.tables}</strong> table
                  {deletePreview.totals.tables === 1 ? '' : 's'} will be destroyed:
                </p>
                <ul>
                  <li>{deletePreview.totals.identity.toLocaleString()} organization, people and login records</li>
                  <li>{deletePreview.totals.brain.toLocaleString()} intelligence, ingestion and configuration records</li>
                  {deletePreview.totals.sourceSystem > 0 && (
                    <li>{deletePreview.totals.sourceSystem.toLocaleString()} records held by other connected systems</li>
                  )}
                </ul>
                <p className="cc-delete-modal__note">
                  Everyone in this organization will lose access immediately. Other organizations are not affected.
                </p>
              </div>
            )}

            {/* The tenant owns rows in tables belonging to other applications on
                this shared database. The server refused rather than guess, and
                this is where the administrator answers. */}
            {sourceSystemPrompt && (
              <div className="cc-delete-modal__ack">
                <p>{sourceSystemPrompt.message}</p>
                <ul>
                  {sourceSystemPrompt.tables.slice(0, 8).map((t) => (
                    <li key={t.table}><code>{t.table}</code> — {t.rows.toLocaleString()} rows</li>
                  ))}
                  {sourceSystemPrompt.tables.length > 8 && (
                    <li>…and {sourceSystemPrompt.tables.length - 8} more</li>
                  )}
                </ul>
                <label>
                  <input
                    type="checkbox"
                    checked={acknowledgeSourceData}
                    onChange={(event) => setAcknowledgeSourceData(event.target.checked)}
                    disabled={deleting}
                  />
                  Also permanently delete these {sourceSystemPrompt.rows.toLocaleString()} records
                </label>
              </div>
            )}

            {/* The string shown here and the string compared below are the same
                variable. They cannot drift apart, which is the whole fix. */}
            <label className="cc-delete-modal__confirm">
              {canonicalName === null
                ? 'Loading the organization name…'
                : <>To confirm, type <strong>{canonicalName}</strong> below.</>}
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="Type organization name"
                disabled={deleting || canonicalName === null}
                autoComplete="off"
              />
            </label>
            {deleteError && <p className="cc-record__error">{deleteError}</p>}
            <div className="cc-delete-modal__actions">
              <button type="button" className="eb-pill-btn" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button>
              <button
                type="button"
                className="cc-delete-submit"
                disabled={
                  // No canonical name yet means nothing safe to compare against.
                  canonicalName === null
                  || deleteConfirm !== canonicalName
                  || deleting
                  // Blocked until the extra records are explicitly accepted.
                  || (sourceSystemPrompt !== null && !acknowledgeSourceData)
                }
                onClick={deletePermanently}
              >
                <Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete Permanently'}
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

/** The three server severities, mapped onto the product's three status tones. */
function severityTone(severity: string): 'crit' | 'warn' | 'state' {
  return severity === 'high' ? 'crit' : severity === 'medium' ? 'warn' : 'state';
}

/**
 * What the department headcounts say about the organization's shape.
 *
 * THREE FINDINGS, EACH WITH THE ARITHMETIC IN THE SENTENCE. Concentration,
 * emptiness and imbalance are the three things a distribution of people across
 * units can be wrong about, and each is stated with the numbers that produced
 * it so a reader can disagree with the conclusion rather than only with the
 * tone.
 *
 * Derived from the structure payload the org chart already needed. Returns an
 * empty list when the organization is unremarkable, which is the correct output
 * and not a failure — the panel above renders nothing in that case rather than
 * congratulating anyone.
 */
function departmentConcentration(structure: any, memberNoun: string): Array<{ title: string; detail: string; tone: 'warn' | 'crit' | 'state' }> {
  const departments = asArray(structure?.departments);
  const perDepartment = structure?.peopleByDepartment ?? {};

  if (departments.length < 2) return [];

  const sized = departments
    .map((d: any) => ({ name: String(d?.name ?? 'Unnamed unit'), people: Number(perDepartment?.[d?.id] ?? 0) }))
    .filter((d) => Number.isFinite(d.people));

  const total = sized.reduce((sum, d) => sum + d.people, 0);
  if (total === 0) return [];

  const staffed = sized.filter((d) => d.people > 0).sort((a, b) => b.people - a.people);
  const empty = sized.length - staffed.length;
  const findings: Array<{ title: string; detail: string; tone: 'warn' | 'crit' | 'state' }> = [];

  const largest = staffed[0];
  if (largest && largest.people / total >= 0.4) {
    const share = Math.round((largest.people / total) * 100);
    findings.push({
      title: `${share}% of ${memberNoun} sit in one unit`,
      detail: `${largest.name} holds ${largest.people.toLocaleString()} of ${total.toLocaleString()}. Concentration at this level is where a single departure or absence has organization-wide reach.`,
      tone: share >= 60 ? 'crit' : 'warn',
    });
  }

  if (empty > 0) {
    findings.push({
      title: `${empty} ${empty === 1 ? 'unit holds' : 'units hold'} nobody`,
      detail: `${empty} of ${sized.length} recorded units have no one assigned in the source system. Either the unit is dormant or the assignments were never made — both are worth resolving before the structure is used for anything.`,
      tone: 'warn',
    });
  }

  const smallest = staffed[staffed.length - 1];
  if (staffed.length >= 3 && largest && smallest && smallest.people > 0 && largest.people >= smallest.people * 8) {
    findings.push({
      title: 'Units differ enormously in size',
      detail: `${largest.name} holds ${largest.people.toLocaleString()} and ${smallest.name} holds ${smallest.people.toLocaleString()} — a spread of ${Math.round(largest.people / smallest.people)}×. Comparing their metrics directly will mislead.`,
      tone: 'state',
    });
  }

  return findings;
}

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/**
 * The record fields this organization's source system can actually hold, in
 * reading order.
 *
 * `name` is kept unconditionally: it is the one field every organization
 * register in existence has, it is how the row is identified everywhere else in
 * the product, and a form that cannot rename an organization is not an edit
 * form. Everything else has to be claimed by the server.
 */
function supportedOrganizationFields(organization: Organization): OrganizationFieldSpec[] {
  // Defensive against a payload that predates the capability lists — a cached
  // response, a fixture, a server mid-deploy. `name` alone is a poorer screen
  // than the old one, so an organization that claims nothing falls back to the
  // three fields every register has always had.
  const claimed = [
    ...(Array.isArray(organization.identityFields) ? organization.identityFields : []),
    ...(Array.isArray(organization.profileFields) ? organization.profileFields : []),
  ];
  const supported = new Set<string>(
    claimed.length > 0 ? [...claimed, 'name'] : ['name', 'orgCode', 'industry', 'legalName'],
  );

  return ORGANIZATION_FIELDS.filter((spec) => supported.has(spec.key));
}

function profileDraftFromOrganization(organization: Organization): OrganizationProfileDraft {
  const draft: OrganizationProfileDraft = {};

  for (const spec of ORGANIZATION_FIELDS) {
    draft[spec.key] = (organization[spec.key] ?? null) as string | null;
  }

  return draft;
}

/**
 * 'mon-sat' is how the ERP stores it and not how anyone reads it.
 *
 * Deliberately conservative: a value it does not recognise is returned as
 * written rather than guessed at, because a working week is a fact about the
 * organization and inventing one is worse than showing the raw token.
 */
function describeWorkWeek(value: string): string {
  const days: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
  };
  const parts = value.toLowerCase().split(/[-–—to\s]+/).filter(Boolean);

  if (parts.length === 2 && days[parts[0]] && days[parts[1]]) {
    return `${days[parts[0]]} to ${days[parts[1]]}`;
  }

  return value;
}

function meaningfulValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text === '' || text === '-' || text === '--' || text === '---' || text.toLowerCase() === 'not recorded'
    ? ''
    : text;
}

/**
 * The rows worth printing: a supported field that has a value.
 *
 * TWO FILTERS, AND THEY MEAN DIFFERENT THINGS. A field the tenant cannot hold
 * never appears — there is nothing to say about it. A supported field that is
 * simply empty also does not appear here, because a list of "Not recorded" is
 * noise; the way to fill one in is the Edit button above, which DOES show it.
 */
function organizationDetailRows(organization: Organization): Array<{ label: string; value: string }> {
  const rows = supportedOrganizationFields(organization)
    // The name is the panel's heading two elements up; repeating it as a row is
    // the kind of duplication that makes a record panel look padded.
    .filter((spec) => spec.key !== 'name' && spec.key !== 'logo')
    .map((spec) => {
      const value = meaningfulValue(organization[spec.key]);
      return { label: spec.label, value: value === '' ? '' : (spec.display?.(value) ?? value) };
    })
    .filter((row) => row.value !== '');

  const updated = meaningfulValue(formatDate(organization.updatedDate));

  return updated === '' ? rows : [...rows, { label: 'Last updated', value: updated }];
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
