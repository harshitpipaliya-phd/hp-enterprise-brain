import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  BrainCircuit,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileSearch,
  Gauge,
  Globe2,
  IdCard,
  ListChecks,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserX,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { api, decisionIntelligenceApi } from '../../api/intelligence';
import { reasoningEngineApi } from '../../api/reasoning-engine';
import { notificationApi } from '../../api/notification';
import { aiApi } from '../../api/ai';
import { taskApi } from '../../api/task';
import { api as organizationApi } from '../../api/organization';
import { api as capabilityApi } from '../../api/capability';
import { api as departmentApi } from '../../api/department';
import { ingestionApi } from '../../api/ingestion';
import { api as signalApi } from '../../api/signal';
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

interface HomeMetrics {
  erp: {
    activePeople: number;
    activeDepartments: number;
    peopleWithoutDepartment: number;
    departmentsWithoutManager: number;
    peopleWithoutProfile: number;
  };
  intelligence: {
    openSignals: number;
    highSignals: number;
    pendingRecommendations: number;
    openDecisions: number;
  };
  attention: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    link?: string | null;
    metric?: number;
    confidence?: number;
  }>;
  dataFreshness: {
    erp: string;
    brain: string;
  };
}

type RecordPanel = 'profile' | 'structure' | 'quality' | 'audit';
type OrganizationProfileDraft = Pick<Organization, 'name' | 'orgCode' | 'industry'>;

export default function CommandCenter({ tenantId, organizationName, organization, onNavigate, onUpdated, onArchive, onArchived }: CommandCenterProps) {
  const [summary, setSummary] = useState<any>(null);
  const [missingEvidence, setMissingEvidence] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [aiExecutions, setAiExecutions] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [homeMetrics, setHomeMetrics] = useState<HomeMetrics | null>(null);
  const [capabilityCount, setCapabilityCount] = useState(0);
  const [activeDepartmentCount, setActiveDepartmentCount] = useState<number | null>(null);
  const [overviewStructure, setOverviewStructure] = useState<any>(null);
  const [overviewQuality, setOverviewQuality] = useState<any>(null);
  const [overviewAudit, setOverviewAudit] = useState<any[]>([]);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [recordPanel, setRecordPanel] = useState<RecordPanel>('profile');
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
      const summaryRes = await decisionIntelligenceApi.getExecutiveSummary(tenantId);
      setSummary({
        // score defaults to NULL, not 0. The endpoint returns null when not one
        // component of the composite had a denominator, and a default of 0 turned
        // that into a measured "0 / 100" — the strongest possible negative claim
        // about an organization nobody had measured yet.
        intelligenceScore: {
          score: null,
          measuredComponents: 0,
          unmeasuredComponents: 0,
          basis: null,
          ...(summaryRes?.intelligenceScore ?? {}),
        },
        pendingRecommendations: asArray(summaryRes?.pendingRecommendations),
        openDecisionsCount: Number(summaryRes?.openDecisionsCount ?? 0),
        topRisks: asArray(summaryRes?.topRisks),
      });
      setLoading(false);

      const homeRes = await api.getHomeMetrics(tenantId);
      setHomeMetrics(homeRes as HomeMetrics);

      const secondary = await Promise.allSettled([
        reasoningEngineApi.missingEvidence(tenantId),
        reasoningEngineApi.duplicateSignals(tenantId),
        notificationApi.unreadCount(tenantId),
        aiApi.executions(tenantId),
        aiApi.providers(),
        taskApi.listRegistry(),
        capabilityApi.listCapabilities(tenantId, organization?.id),
        departmentApi.listDepartments(tenantId, organization?.id),
        organization ? organizationApi.getStructure(tenantId, organization.id) : Promise.resolve(null),
        organization ? organizationApi.getDataQuality(tenantId, organization.id) : Promise.resolve(null),
        organization ? organizationApi.getAuditLogs(tenantId, organization.id) : Promise.resolve([]),
        ingestionApi.listSources(tenantId),
        signalApi.listSignals(tenantId),
      ]);

      const [
        missingRes,
        dupRes,
        unreadRes,
        execRes,
        providerRes,
        tasksRes,
        capabilitiesRes,
        departmentsRes,
        structureRes,
        qualityRes,
        auditRes,
        sourceRes,
        signalRes,
      ] =
        secondary.map((result) => result.status === 'fulfilled' ? result.value : null);

      if (missingRes) setMissingEvidence(Number(missingRes?.count ?? 0));
      if (dupRes) setDuplicates(Number(dupRes?.count ?? 0));
      if (unreadRes) setUnreadNotifications(Number(unreadRes?.count ?? 0));
      if (execRes) setAiExecutions(asArray(execRes).slice(0, 7));
      if (providerRes) setProviders(asArray(providerRes?.providers));
      if (tasksRes) setTaskCount(asArray(tasksRes).length);
      if (capabilitiesRes) setCapabilityCount(asArray(capabilitiesRes).length);
      if (departmentsRes) {
        setActiveDepartmentCount(
          asArray(departmentsRes).filter((department) => String(department.status || '').toLowerCase() === 'active').length,
        );
      }
      if (structureRes) setOverviewStructure(structureRes);
      if (qualityRes) setOverviewQuality(qualityRes);
      setOverviewAudit(asArray(auditRes));
      setDataSources(asArray(sourceRes));
      setSignals(asArray(signalRes));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, organization?.id]);

  useEffect(() => {
    let cancelled = false;
    load().finally(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (!organization || recordPanel === 'profile') {
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
      ]).then(([structure, departments]) => {
        // The Department API is the authoritative logged-in-organization
        // collection. Structure data is an aggregate, so intersecting it with
        // that collection prevents any cross-organization or stale extra rows
        // from reaching this screen.
        const allowedIds = new Set(asArray(departments).map((department) => String(department.id)));
        return {
          ...structure,
          departments: asArray(structure?.departments).filter((department) => allowedIds.has(String(department.id))),
        };
      })
      : recordPanel === 'quality'
        ? organizationApi.getDataQuality(tenantId, organization.id)
        : organizationApi.getAuditLogs(tenantId, organization.id);

    loader
      .then((data) => { if (!cancelled) setRecordData(data); })
      .catch((e: any) => { if (!cancelled) setRecordError(e.message || 'Unable to load organization record.'); })
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
    setRecordPanel('profile');
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

  if (loading) return <LoadingState label="Loading command center..." />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return null;

  const configuredProviders = providers.filter((p) => p.available).length;
  const providerTotal = providers.length;
  const qualityAlerts = missingEvidence + duplicates;
  // null stays null all the way to the ring, which renders unmeasured rather than
  // empty. `Number(null)` is 0, so coalescing here would reintroduce the fabrication
  // one line below where it was removed.
  const rawScore = summary.intelligenceScore.score;
  const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
  const health: Health = score === null ? 'warn' : healthOf(score);
  const pendingCount = summary.pendingRecommendations.length;
  const riskCount = summary.topRisks.length;
  const openDecisions = Number(summary.openDecisionsCount ?? 0);
  const erp = homeMetrics?.erp ?? {
    activePeople: 0,
    activeDepartments: 0,
    peopleWithoutDepartment: 0,
    departmentsWithoutManager: 0,
    peopleWithoutProfile: 0,
  };
  const activeDepartments = activeDepartmentCount ?? erp.activeDepartments;
  const structureDepartments = asArray(overviewStructure?.departments);
  const visibleDepartments = structureDepartments.slice(0, 5);
  const activeDataSources = dataSources.filter((source) => source.is_active !== false && source.isActive !== false);
  const visibleDataSources = dataSources.slice(0, 5);
  const visibleAudit = overviewAudit.slice(0, 4);
  const visibleSignals = signals.slice(0, 5);
  const qualityAssessedRows = Number(overviewQuality?.totalPeople ?? 0) + Number(overviewQuality?.totalDepartments ?? 0);
  const qualityScore = qualityAssessedRows > 0 && overviewQuality?.score !== undefined ? Number(overviewQuality.score) : null;
  const orgAttention = asArray(homeMetrics?.attention).filter((item) => item.id !== 'all-clear');
  const profileCompleteness = erp.activePeople > 0
    ? Math.round(((erp.activePeople - erp.peopleWithoutProfile) / erp.activePeople) * 100)
    : 0;
  const departmentAssignment = erp.activePeople > 0
    ? Math.round(((erp.activePeople - erp.peopleWithoutDepartment) / erp.activePeople) * 100)
    : 0;
  const leadershipCoverage = activeDepartments > 0
    ? Math.round(((activeDepartments - erp.departmentsWithoutManager) / activeDepartments) * 100)
    : 0;
  const derivedSignalLoad = riskCount + qualityAlerts + pendingCount;
  const systemStatus = statusModel({
    health,
    riskCount,
    missingEvidence,
    configuredProviders,
    providers: providerTotal,
    orgGaps: erp.peopleWithoutDepartment + erp.departmentsWithoutManager + erp.peopleWithoutProfile,
  });

  const flow = [
    { label: 'Organization', value: activeDepartments, health: erp.departmentsWithoutManager > 0 ? 'warn' : 'good', icon: <Building2 size={17} /> },
    { label: 'Signals', value: derivedSignalLoad, health: riskCount > 0 ? 'warn' : 'good', icon: <Activity size={17} /> },
    { label: 'Evidence', value: missingEvidence, health: missingEvidence > 0 ? 'crit' : 'good', icon: <FileSearch size={17} /> },
    { label: 'Reasoning', value: pendingCount, health: pendingCount > 0 ? 'warn' : 'good', icon: <BrainCircuit size={17} /> },
    { label: 'Decisions', value: openDecisions, health: openDecisions > 0 ? 'warn' : 'good', icon: <ClipboardCheck size={17} /> },
    { label: 'Execution', value: taskCount, health: taskCount > 0 ? 'good' : 'warn', icon: <Workflow size={17} /> },
    { label: 'Learning', value: aiExecutions.length, health: aiExecutions.length > 0 ? 'good' : 'warn', icon: <Sparkles size={17} /> },
  ];

  const attention = [
    ...orgAttention.slice(0, 3).map((item: any) => ({
      id: `org-${item.id}`,
      type: 'Organization',
      title: String(item.title ?? 'Organization record needs review'),
      meta: String(item.description ?? 'Operational completeness issue'),
      tone: item.severity === 'high' ? 'crit' as Health : 'warn' as Health,
      view: viewFromHomeLink(item.link),
    })),
    ...summary.topRisks.slice(0, 4).map((r: any) => ({
      id: `risk-${r.id ?? r.category}`,
      type: 'Risk',
      title: String(r.category ?? 'Unclassified risk'),
      meta: `Score ${r.score ?? 'unmeasured'}`,
      tone: 'crit' as Health,
      view: 'executive' as View,
    })),
    ...(missingEvidence > 0 ? [{
      id: 'missing-evidence',
      type: 'Evidence',
      title: `${missingEvidence} claims are missing supporting evidence`,
      meta: 'Blocks grounded reasoning',
      tone: 'warn' as Health,
      view: 'evidence' as View,
    }] : []),
    ...(duplicates > 0 ? [{
      id: 'duplicate-signals',
      type: 'Quality',
      title: `${duplicates} duplicate signal groups detected`,
      meta: 'Review deduplication',
      tone: 'warn' as Health,
      view: 'signals' as View,
    }] : []),
    ...summary.pendingRecommendations.slice(0, 3).map((r: any, index: number) => ({
      id: `rec-${r.id ?? index}`,
      type: 'Recommendation',
      title: String(r.title ?? r.category ?? 'Recommendation awaiting review'),
      meta: String(r.priority ?? 'Awaiting decision'),
      tone: 'warn' as Health,
      view: 'executive' as View,
    })),
  ].slice(0, 7);

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
            <div className="cc-org-hero__meta" aria-label="Organization metadata">
              {organization?.industry && <span><Building2 size={14} /> {organization.industry}</span>}
              <span><Users size={14} /> {erp.activePeople.toLocaleString()} People</span>
              {organization?.createdDate && <span><Calendar size={14} /> Created {formatShortDate(organization.createdDate)}</span>}
              {organization?.orgCode && <span><IdCard size={14} /> {organization.orgCode}</span>}
              {organization?.country && <span><Globe2 size={14} /> {organization.country}</span>}
            </div>
          </div>
        </div>
        <div className="cc-org-hero__actions">
          <button type="button" className="eb-pill-btn" onClick={beginProfileEdit} disabled={!organization}>
            <Pencil size={15} /> Edit Organization
          </button>
          {organization && (
            <button type="button" className="eb-pill-btn cc-danger-outline" onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null); }}>
              <Trash2 size={15} /> Delete Organization
            </button>
          )}
          <button type="button" onClick={() => onNavigate('ingestion')}>
            <Upload size={15} /> Open Ingestion Engine <ArrowRight size={15} />
          </button>
          <button type="button" className="eb-pill-btn" onClick={() => load('refresh')} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'cc-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      <section className="cc-kpi-grid" aria-label="Organization overview KPIs">
        <OverviewKpi
          icon={<Gauge />}
          label="Health Score"
          value={qualityScore === null ? 'Unmeasured' : formatNumber(qualityScore)}
          detail={qualityScore === null ? 'No people or departments assessed' : 'Source-data quality'}
          tone={qualityScore === null ? 'warn' : healthOf(qualityScore)}
        />
        <OverviewKpi icon={<Building2 />} label="Departments" value={activeDepartments} detail="Active departments" tone={erp.departmentsWithoutManager > 0 ? 'warn' : 'good'} />
        <OverviewKpi icon={<Users />} label="People" value={erp.activePeople} detail="Total active people" tone={erp.peopleWithoutDepartment > 0 ? 'warn' : 'good'} />
        <OverviewKpi icon={<Target />} label="Capabilities" value={capabilityCount} detail="Mapped capabilities" tone="good" />
        <OverviewKpi icon={<Upload />} label="Data Sources" value={dataSources.length} detail={`${activeDataSources.length} active sources`} tone={dataSources.length === 0 ? 'warn' : 'good'} />
      </section>

      <section className="cc-overview-board" aria-label="Organization dashboard sections">
        <div className="cc-panel cc-org-details">
          <div className="cc-section-head">
            <div>
              <span className="cc-kicker">Organization Overview</span>
              <h2>Organization information</h2>
            </div>
          </div>
          {organization ? (
            <dl className="cc-detail-list">
              <div><dt>Organization Name</dt><dd>{organization.name}</dd></div>
              <div><dt>Legal Name</dt><dd>{organization.legalName || 'Not recorded'}</dd></div>
              <div><dt>Industry</dt><dd>{organization.industry || 'Not recorded'}</dd></div>
              <div><dt>Country</dt><dd>{organization.country || 'Not recorded'}</dd></div>
              <div><dt>Timezone</dt><dd>{organization.timezone || 'Not recorded'}</dd></div>
              <div><dt>Status</dt><dd><span className="eb-badge eb-badge-success">{organization.status || 'active'}</span></dd></div>
            </dl>
          ) : (
            <p className="cc-empty">No organization record is selected.</p>
          )}
        </div>

        <OverviewListCard
          title="Recent Activity"
          actionLabel="Audit"
          onAction={() => setRecordPanel('audit')}
          empty="No organization audit events are available."
          rows={visibleAudit.map((record, index) => ({
            id: String(record.id ?? index),
            title: String(record.action || 'Recorded change'),
            meta: `${record.actorName || record.actorId || record.actor_id || 'System'} - ${formatDate(record.createdAt || record.createdDate || record.created_at)}`,
          }))}
        />

        <OverviewListCard
          title="Departments"
          actionLabel="View All"
          onAction={() => onNavigate('departments')}
          empty="No active departments are available in the source system."
          rows={visibleDepartments.map((department: any) => ({
            id: String(department.id),
            title: String(department.name || 'Unnamed department'),
            meta: `${Number(overviewStructure?.peopleByDepartment?.[department.id] ?? 0).toLocaleString()} people`,
          }))}
        />

        <OverviewListCard
          title="Data Sources"
          actionLabel="View All"
          onAction={() => onNavigate('ingestion')}
          empty="No ingestion data sources are configured yet."
          rows={visibleDataSources.map((source: any) => ({
            id: String(source.id ?? source.source_key ?? source.sourceKey),
            title: String(source.display_name ?? source.displayName ?? source.source_key ?? 'Data source'),
            meta: String(source.source_type ?? source.sourceType ?? 'source'),
            badge: source.is_active === false || source.isActive === false ? 'Inactive' : 'Active',
          }))}
        />

        <OverviewListCard
          title="Signals"
          actionLabel="View All"
          onAction={() => onNavigate('signals')}
          empty="No signals are available for this organization."
          rows={visibleSignals.map((signal: any) => ({
            id: String(signal.id ?? signal.signal_id ?? signal.title),
            title: String(signal.title ?? signal.name ?? 'Signal'),
            meta: String(signal.classification ?? signal.severity ?? signal.status ?? 'unclassified'),
            badge: signal.severity ?? signal.priority ?? signal.state,
          }))}
        />
      </section>

      <section className="cc-org-command" aria-label="Organization command overview">
        <div className="cc-org-command__header">
          <div>
            <span className="cc-kicker">Organization Backbone</span>
            <h2>Structure, coverage, and operating completeness</h2>
          </div>
          <div className="cc-org-command__actions">
            <button type="button" className="eb-pill-btn" onClick={() => onNavigate('departments')}>Departments</button>
            <button type="button" className="eb-pill-btn" onClick={() => onNavigate('people')}>People</button>
          </div>
        </div>

        <div className="cc-org-grid">
          <OrgMetric icon={<Building2 />} label="Active Departments" value={activeDepartments} detail={`${leadershipCoverage}% leadership coverage`} tone={erp.departmentsWithoutManager > 0 ? 'warn' : 'good'} />
          <OrgMetric icon={<Users />} label="Active People" value={erp.activePeople} detail={`${departmentAssignment}% assigned to departments`} tone={erp.peopleWithoutDepartment > 0 ? 'warn' : 'good'} />
          <OrgMetric icon={<UserX />} label="Missing Department" value={erp.peopleWithoutDepartment} detail="Outside org rollups" tone={erp.peopleWithoutDepartment > 0 ? 'crit' : 'good'} />
          <OrgMetric icon={<IdCard />} label="Missing Profiles" value={erp.peopleWithoutProfile} detail={`${profileCompleteness}% profile completeness`} tone={erp.peopleWithoutProfile > 0 ? 'warn' : 'good'} />
        </div>
      </section>

      <section className="cc-pulse" aria-label="Operational pulse">
        <PulseCard icon={<ListChecks />} label="Pending Recommendations" value={pendingCount} hint="Awaiting review" tone={pendingCount > 0 ? 'warn' : 'good'} onClick={() => onNavigate('executive')} />
        <PulseCard icon={<ClipboardCheck />} label="Open Decisions" value={openDecisions} hint="Decision backlog" tone={openDecisions > 0 ? 'warn' : 'good'} onClick={() => onNavigate('executive')} />
        <PulseCard icon={<ShieldAlert />} label="Critical Risks" value={riskCount} hint="Highest priority" tone={riskCount > 0 ? 'crit' : 'good'} onClick={() => onNavigate('executive')} />
        <PulseCard icon={<DatabaseZap />} label="Data Quality" value={qualityAlerts} hint={`${missingEvidence} gaps / ${duplicates} duplicates`} tone={qualityAlerts > 0 ? 'warn' : 'good'} onClick={() => onNavigate('evidence')} />
        <PulseCard icon={<Bot />} label="AI Providers" value={`${configuredProviders}/${providerTotal}`} hint={configuredProviders > 0 ? 'Available' : 'Needs setup'} tone={configuredProviders > 0 ? 'good' : 'warn'} onClick={() => onNavigate('aiworkspace')} />
        <PulseCard icon={<Target />} label="Capabilities" value={capabilityCount} hint="Organization capability map" tone="good" onClick={() => onNavigate('capabilities')} />
        <PulseCard icon={<Bell />} label="Notifications" value={unreadNotifications} hint="Unread alerts" tone={unreadNotifications > 0 ? 'warn' : 'good'} />
      </section>

      <section className="cc-flow" aria-label="Intelligence flow">
        <div className="cc-section-head">
          <div>
            <span className="cc-kicker">Intelligence Flow</span>
            <h2>Signal to execution pipeline</h2>
          </div>
          <span className="cc-live"><span /> Live</span>
        </div>
        <div className="cc-flow__track">
          {flow.map((stage, index) => (
            <button key={stage.label} type="button" className="cc-flow__stage" data-health={stage.health} onClick={() => onNavigate(flowView(stage.label))}>
              <span className="cc-flow__icon">{stage.icon}</span>
              <strong>{stage.label}</strong>
              <em>{stage.value}</em>
              {index < flow.length - 1 && <i aria-hidden="true" />}
            </button>
          ))}
        </div>
      </section>

      <div className="cc-main-grid">
        <section className="cc-panel cc-attention" aria-labelledby="cc-attention">
          <div className="cc-section-head">
            <div>
              <span className="cc-kicker">Attention Queue</span>
              <h2 id="cc-attention">What needs action now</h2>
            </div>
            <button className="eb-link-btn" onClick={() => onNavigate('executive')}>Open review</button>
          </div>

          {attention.length === 0 ? (
            <HealthyEmpty />
          ) : (
            <ul className="cc-attention-list">
              {attention.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate(item.view)}>
                    <span className="cc-attention__tone" data-health={item.tone}><AlertTriangle size={16} /></span>
                    <span>
                      <em>{item.type}</em>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="cc-side-stack">
          <section className="cc-panel">
            <div className="cc-section-head">
              <div>
                <span className="cc-kicker">System State</span>
                <h2>{systemStatus.title}</h2>
              </div>
              <Gauge size={20} />
            </div>
            <p className="cc-system-copy">{systemStatus.detail}</p>
            <div className="cc-system-grid">
              <MiniMetric label="Provider readiness" value={`${configuredProviders}/${providerTotal}`} />
              <MiniMetric label="Task registry" value={taskCount} />
              <MiniMetric label="Quality alerts" value={qualityAlerts} />
              <MiniMetric label="Unread alerts" value={unreadNotifications} />
            </div>
          </section>

          <section className="cc-panel">
            <div className="cc-section-head">
              <div>
                <span className="cc-kicker">AI Activity</span>
                <h2>Recent executions</h2>
              </div>
              <button className="eb-link-btn" onClick={() => onNavigate('aiworkspace')}>See all</button>
            </div>

            {aiExecutions.length === 0 ? (
              <p className="cc-empty">No AI executions yet.</p>
            ) : (
              <ul className="cc-activity">
                {aiExecutions.map((e: any) => (
                  <li key={e.id}>
                    <span className={`cc-activity__dot cc-activity__dot--${execBadge(e.status)}`} />
                    <span>
                      <strong>{e.serviceName ?? e.service_name ?? 'AI execution'}</strong>
                      <small>{e.provider ?? e.status ?? 'unknown status'}</small>
                    </span>
                    <span className={`eb-badge eb-badge-${execBadge(e.status)}`}>{e.status ?? 'unknown'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <section className="cc-lower-grid">
        <div className="cc-panel">
          <div className="cc-section-head">
            <div>
              <span className="cc-kicker">Risk Posture</span>
              <h2>Top risks</h2>
            </div>
            <button className="eb-link-btn" onClick={() => onNavigate('executive')}>See all</button>
          </div>
          {summary.topRisks.length === 0 ? (
            <p className="cc-empty"><CheckCircle2 size={16} /> No risks assessed yet.</p>
          ) : (
            <ul className="cc-compact-list">
              {summary.topRisks.slice(0, 5).map((r: any) => (
                <li key={r.id ?? r.category}>
                  <strong>{r.category ?? 'Unclassified'}</strong>
                  <span>Score {r.score ?? 'n/a'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cc-panel">
          <div className="cc-section-head">
            <div>
              <span className="cc-kicker">Decision Backlog</span>
              <h2>Pending recommendations</h2>
            </div>
            <button className="eb-link-btn" onClick={() => onNavigate('executive')}>Review</button>
          </div>
          {summary.pendingRecommendations.length === 0 ? (
            <p className="cc-empty"><CheckCircle2 size={16} /> No recommendations awaiting review.</p>
          ) : (
            <ul className="cc-compact-list">
              {summary.pendingRecommendations.slice(0, 5).map((r: any, index: number) => (
                <li key={r.id ?? index}>
                  <strong>{r.title ?? r.category ?? 'Recommendation'}</strong>
                  <span>{r.priority ?? 'pending'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {organization && (
        <section className="cc-record cc-panel" aria-label="Organization record">
          <div className="cc-section-head cc-record__head">
            <div>
              <span className="cc-kicker">Organization record</span>
              <h2>Profile, structure, quality, and audit</h2>
            </div>
            <div className="cc-record__actions">
              {onArchive && <button type="button" className="eb-link-btn cc-danger-link" onClick={onArchive}>Archive</button>}
            </div>
          </div>
          <div className="cc-tabs" role="tablist" aria-label="Organization record sections">
            {([
              ['profile', 'Profile'], ['structure', 'Structure'], ['quality', 'Data quality'], ['audit', 'Audit'],
            ] as Array<[RecordPanel, string]>).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={recordPanel === key} className={recordPanel === key ? 'is-active' : ''} onClick={() => setRecordPanel(key)}>{label}</button>
            ))}
          </div>
          {recordPanel === 'profile' && (
            <OrganizationProfile
              organization={organization}
              editing={editingProfile}
              form={profileForm}
              saving={profileSaving}
              error={profileError}
              onChange={setProfileForm}
              onSave={saveProfile}
              onCancel={() => { setEditingProfile(false); setProfileError(null); setProfileForm({ name: organization.name, orgCode: organization.orgCode, industry: organization.industry }); }}
              onEdit={beginProfileEdit}
            />
          )}
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
                <h2 id="cc-delete-title">Delete Organization</h2>
                <p>Are you sure you want to delete the organization <strong>{organization.name}</strong>?</p>
              </div>
            </div>
            <p className="cc-delete-modal__warning">
              The current backend archives the organization through the existing tenant-scoped archive endpoint. ERP-owned source data is not hard-deleted by this action.
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
                <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete Organization'}
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

function OrganizationProfile({
  organization, editing, form, saving, error, onChange, onSave, onCancel, onEdit,
}: {
  organization: Organization;
  editing: boolean;
  form: OrganizationProfileDraft | null;
  saving: boolean;
  error: string | null;
  onChange: (form: OrganizationProfileDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const fields: Array<[string, string | null | undefined]> = [
    ['Legal name', organization.legalName],
    ['Organization code', organization.orgCode],
    ['Industry', organization.industry],
    ['Country', organization.country],
    ['Timezone', organization.timezone],
    ['Currency', organization.currency],
    ['Status', organization.status],
    ['Created', formatDate(organization.createdDate)],
    ['Last updated', formatDate(organization.updatedDate)],
  ];

  if (editing && form) {
    return (
      <form className="cc-profile-editor" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
        <label>Name<input required value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></label>
        <label>Organization code<input value={form.orgCode} onChange={(event) => onChange({ ...form, orgCode: event.target.value })} /></label>
        <label>Industry<input value={form.industry || ''} onChange={(event) => onChange({ ...form, industry: event.target.value || null })} /></label>
        <p className="cc-profile-editor__note">Legal name, logo, location, timezone, currency, and status are managed by the connected source system.</p>
        {error && <p className="cc-record__error">{error}</p>}
        <div className="cc-profile-editor__actions">
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="eb-pill-btn" disabled={saving} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    );
  }

  return <><dl className="cc-profile-grid">
    {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}
  </dl><div className="cc-profile-actions"><button type="button" className="eb-pill-btn" onClick={onEdit}>Edit organization</button></div></>;
}

function StructurePanel({ data }: { data: any }) {
  const departments = asArray(data?.departments);
  if (!data || departments.length === 0) return <p className="cc-empty">No active departments are available in the source system.</p>;

  return (
    <div className="cc-table-wrap">
      <table className="cc-table">
        <thead><tr><th>Department</th><th>People</th><th>Parent unit</th><th>Status</th></tr></thead>
        <tbody>{departments.map((department: any) => (
          <tr key={department.id}>
            <td>{department.name || 'Unnamed department'}</td>
            <td>{Number(data.peopleByDepartment?.[department.id] ?? 0)}</td>
            <td>{department.parentId && department.parentId !== '0' ? (data.heads?.[department.parentId] || department.parentId) : 'Top level'}</td>
            <td><span className="eb-badge eb-badge-info">{department.status || 'unknown'}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function QualityPanel({ data }: { data: any }) {
  if (!data) return <p className="cc-empty">No data-quality result is available yet.</p>;
  const issues = asArray(data.issues);
  return (
    <div className="cc-quality">
      <div className="cc-quality__score">
        <strong>{formatNumber(data.score)}%</strong>
        <span>Source-data quality score</span>
        <small>{Number(data.totalPeople ?? 0)} people · {Number(data.totalDepartments ?? 0)} departments assessed</small>
      </div>
      {issues.length === 0 ? <p className="cc-empty"><CheckCircle2 size={16} /> No completeness issues were returned.</p> : (
        <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Source field</th><th>Affected records</th><th>Severity</th></tr></thead><tbody>
          {issues.map((issue: any, index: number) => <tr key={`${issue.field}-${index}`}><td>{issue.field}</td><td>{Number(issue.count ?? 0)}</td><td><span className={`eb-badge eb-badge-${issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'info'}`}>{issue.severity || 'unknown'}</span></td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}

function AuditPanel({ data }: { data: any }) {
  const records = asArray(data);
  if (records.length === 0) return <p className="cc-empty">No organization audit events are available.</p>;
  return <ul className="cc-audit-list">{records.slice(0, 20).map((record: any, index: number) => (
    <li key={record.id ?? index}><strong>{record.action || 'Recorded change'}</strong><span>{record.actorName || record.actorId || record.actor_id || 'System'} · {formatDate(record.createdAt || record.createdDate || record.created_at)}</span></li>
  ))}</ul>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function healthOf(score: number): Health {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warn';
  return 'crit';
}

function execBadge(status: string): string {
  if (status === 'success') return 'success';
  if (status === 'not_configured') return 'info';
  return 'danger';
}

function formatNumber(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Number.isInteger(number) ? String(number) : number.toFixed(1) : '0';
}

function statusModel({
  health, riskCount, missingEvidence, configuredProviders, providers, orgGaps,
}: {
  health: Health;
  riskCount: number;
  missingEvidence: number;
  configuredProviders: number;
  providers: number;
  orgGaps: number;
}) {
  if (health === 'crit') {
    return {
      title: 'Critical operating state',
      summary: 'Immediate review recommended',
      detail: `${riskCount} risk item${riskCount === 1 ? '' : 's'} and ${missingEvidence} evidence gap${missingEvidence === 1 ? '' : 's'} are currently degrading decision confidence.`,
    };
  }
  if (configuredProviders === 0 && providers > 0) {
    return {
      title: 'AI setup incomplete',
      summary: 'Provider setup needed',
      detail: 'AI providers exist in the registry, but none are currently available for command center automation.',
    };
  }
  if (orgGaps > 0) {
    return {
      title: 'Organization data needs cleanup',
      summary: 'Structure gaps detected',
      detail: `${orgGaps} organization completeness issue${orgGaps === 1 ? '' : 's'} were returned by the ERP metrics and may reduce people, department, and leadership accuracy.`,
    };
  }
  if (health === 'warn') {
    return {
      title: 'Watch state',
      summary: 'Attention required',
      detail: 'The organization is operating, but unresolved decisions, risk, or data quality gaps need review.',
    };
  }

  return {
    title: 'Healthy operating state',
    summary: 'No immediate blockers',
    detail: 'The current intelligence loop has no critical blockers from the data returned by the APIs.',
  };
}

function flowView(label: string): View {
  if (label === 'Organization') return 'departments';
  if (label === 'Signals') return 'signals';
  if (label === 'Evidence') return 'evidence';
  if (label === 'Decisions' || label === 'Reasoning') return 'executive';
  if (label === 'Execution') return 'tasks';
  return 'aiworkspace';
}

function viewFromHomeLink(link: string | null | undefined): View {
  if (link === 'people') return 'people';
  if (link === 'departments') return 'departments';
  if (link === 'signals') return 'signals';
  if (link === 'evidence') return 'evidence';
  return 'executive';
}

function PulseCard({
  icon, label, value, hint, tone, onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone: Health;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span>{icon}</span>
      <strong>{value}</strong>
      <em>{label}</em>
      <small>{hint}</small>
    </>
  );

  return onClick ? (
    <button type="button" className="cc-pulse-card" data-health={tone} onClick={onClick}>{body}</button>
  ) : (
    <div className="cc-pulse-card" data-health={tone}>{body}</div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cc-mini">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function OrgMetric({
  icon, label, value, detail, tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: Health;
}) {
  return (
    <div className="cc-org-metric" data-health={tone}>
      <span>{icon}</span>
      <div>
        <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
        <em>{label}</em>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function OverviewKpi({
  icon, label, value, detail, tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: Health;
}) {
  return (
    <div className="cc-overview-kpi" data-health={tone}>
      <span>{icon}</span>
      <div>
        <em>{label}</em>
        <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
        <small>{detail}</small>
      </div>
    </div>
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
    <div className="cc-panel cc-overview-list">
      <div className="cc-section-head">
        <div>
          <span className="cc-kicker">{title}</span>
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
    </div>
  );
}

function HealthyEmpty() {
  return (
    <div className="cc-healthy">
      <CheckCircle2 size={22} />
      <strong>No immediate action queue</strong>
      <p>No critical risks, evidence blockers, duplicate signals, or pending recommendations were returned by the current APIs.</p>
    </div>
  );
}
