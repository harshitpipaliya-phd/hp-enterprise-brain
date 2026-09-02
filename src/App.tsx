
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GraphFocus } from './components/graph/graphTypes';
// Keep the authenticated shell small: each major screen loads only when that
// view is opened, while the sidebar/header remain mounted during chunk fetches.
const ORGANIZATION_LIST = () => import('./components/organization/OrganizationList');
const ORGANIZATION_CREATE = () => import('./components/organization/OrganizationCreate');
const ORGANIZATION_ARCHIVE_CONFIRM = () => import('./components/organization/OrganizationArchiveConfirm');
const COMMAND_CENTER = () => import('./components/workspace/CommandCenter');
const DEPARTMENT_APP = () => import('./components/department/DepartmentApp');
const PERSON_APP = () => import('./components/person/PersonApp');
const CAPABILITY_APP = () => import('./components/capability/CapabilityApp');
const SIGNAL_DASHBOARD = () => import('./components/signal/SignalDashboard');
const INTELLIGENCE_WORKSPACE = () => import('./components/workspace/IntelligenceWorkspace');
const DECISION_ANALYTICS_PANEL = () => import('./components/workspace/DecisionAnalyticsPanel');
const EXECUTIVE_DASHBOARD = () => import('./components/workspace/ExecutiveDashboard');
const GRAPH_EXPLORER = () => import('./components/workspace/GraphExplorer');
const AGENT_MONITOR = () => import('./components/workspace/AgentMonitor');
const EVIDENCE_WORKSPACE = () => import('./components/workspace/EvidenceWorkspace');
const DECISION_INTELLIGENCE = () => import('./components/workspace/DecisionIntelligence');
const TASK_MONITOR = () => import('./components/workspace/TaskMonitor');
const DELIBERATION_WORKSPACE = () => import('./components/workspace/DeliberationWorkspace');
const SETTINGS = () => import('./components/workspace/Settings');
const POLICY_MANAGEMENT = () => import('./components/workspace/PolicyManagement');
const MENTAL_MODEL_BROWSER = () => import('./components/workspace/MentalModelBrowser');
const EXECUTION_CENTER = () => import('./components/workspace/ExecutionCenter');
const AI_ASSISTANT = () => import('./components/workspace/AIAssistant');
const KNOWLEDGE_LIBRARY = () => import('./components/workspace/KnowledgeLibrary');
const INGESTION_WORKSPACE = () => import('./components/workspace/IngestionWorkspace');
const MEMORY_SCREEN = () => import('./components/workspace/MemoryScreen');
const ESO_LIBRARY_SCREEN = () => import('./components/workspace/EsoLibraryScreen');
const KASBA_EXPLORER = () => import('./components/workspace/KasbaExplorer');
// OrganizationIntelligenceHome previously rendered the 'home' view. Home is now
// Command Center, so the component is no longer mounted anywhere. The file is
// left in place rather than deleted — it is a complete screen, and nothing here
// establishes that it should be thrown away rather than given its own nav entry.
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import type { AuthSession } from './components/auth/session';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { AppShell } from './shell/AppShell';
import { NotificationBell } from './components/NotificationBell';
import { ToastProvider, useToast } from './components/Toast';
import { api } from './api/organization';
import type { OrganizationRow, DeletionResult } from './api/organization';
import { ApiError, clearRequestCache, onSessionExpired } from './api/client';
import { getAuthTenantId, getSelectedOrgId, setSelectedOrgId, clearSelectedOrgId } from './utils/tenant';
import { loadSession, saveSession, clearSession } from './utils/session';
import { clearAuthTokens, clearLegacyPersistentTokens, getAccessToken, getRefreshToken } from './utils/authTokens';
import { Alert, Button, EmptyState, ErrorState as ViewErrorState, LazyView } from './ui';
import { GlobalLoader } from './ui/GlobalLoader';
import { API_BASE } from './api/client';
import { globalLoading } from './ui/globalLoading';

export type View = 'home' | 'list' | 'create' | 'edit' | 'details' | 'archive' | 'departments' | 'people' | 'capabilities' | 'signals' | 'workspace' | 'analytics' | 'executive' | 'graph' | 'agents' | 'evidence' | 'copilot' | 'decisionintel' | 'tasks' | 'deliberation' | 'settings' | 'search' | 'policies' | 'mentalmodels' | 'executions' | 'aiworkspace' | 'aiassistant' | 'knowledgelibrary' | 'memory' | 'esolibrary' | 'commandcenter' | 'kasbaexplorer' | 'ingestion';

export type Organization = OrganizationRow;

export default function App() {
  return (
    <ToastProvider>
      <GlobalLoader />
      <AuthenticatedApp />
    </ToastProvider>
  );
}

function initialAuthState(): boolean {
  clearLegacyPersistentTokens();
  return !!getAccessToken();
}

/**
 * The landing view.
 *
 * 'home' renders Command Center. Keeping one name for the landing screen —
 * rather than having both 'home' and 'commandcenter' mean it — is what lets the
 * sidebar highlight, the breadcrumb and the persisted view agree with each
 * other. 'commandcenter' is still accepted so a session saved by an earlier
 * build does not land the user on a screen that no longer exists.
 */
const HOME_VIEW: View = 'home';

/**
 * Whether an organization may be shown under the CURRENT authenticated tenant.
 *
 * The question this guards is a leak: a session persisted under one tenant must
 * never be restored into a workspace authenticated as another, because every
 * screen below takes the organization on trust and would render one customer's
 * departments and people under another customer's login.
 *
 * AN UNKNOWN TENANT IS NOT A MISMATCH. `getAuthTenantId()` reads a claim out of
 * the access token and answers '' whenever it cannot — an opaque token, a
 * differently-named claim, a token this build cannot parse. Treating that as
 * "belongs to someone else" discards every restored session and boots the user
 * into an empty workspace holding valid credentials, which is a far more common
 * outcome than the leak and is indistinguishable from the application being
 * broken. With no tenant to contradict it, the session is left alone; the
 * server still scopes every request it goes on to make.
 */
function organizationBelongsToTenant(org: Organization | null | undefined, tenantId: string): org is Organization {
  if (!org) return false;
  if (tenantId === '') return true;

  return String(org.tenantId) === tenantId || String(org.id) === tenantId;
}

function AuthenticatedApp() {
  const hasActiveAuthSessionRef = useRef<boolean | null>(null);
  if (hasActiveAuthSessionRef.current === null) {
    hasActiveAuthSessionRef.current = initialAuthState();
  }

  // Read ONCE, synchronously, before the first render. Everything below that
  // depends on it — the role filter in the sidebar, and the `selected` gate on
  // every view — is wrong for as long as it is unknown, and "wrong" here means
  // a stripped-down menu and an empty page rather than a spinner.
  const hasActiveAuthSession = hasActiveAuthSessionRef.current;
  const authTenantId = hasActiveAuthSession ? getAuthTenantId() : '';
  const restoredRaw = hasActiveAuthSession ? loadSession() : null;
  const restored = restoredRaw && organizationBelongsToTenant(restoredRaw.organization, authTenantId)
    ? restoredRaw
    : null;

  const [authenticated, setAuthenticated] = useState(hasActiveAuthSession);
  // Which of the two auth screens is showing while unauthenticated. Local state
  // rather than a route because this app has no router — the whole shell is
  // driven by `view`, and the auth screens sit outside it.
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  // Carried from signup to login so a new administrator types their address
  // once. Not persisted: it is a hand-off within one visit, not a preference.
  const [signupEmail, setSignupEmail] = useState('');
  // Inline editing replaced the former standalone `edit` screen. Redirect a
  // session persisted while that screen was open to the unified organization
  // page rather than restoring it to a route with no content.
  const [view, setView] = useState<View>(
    restored?.view === 'edit' ? 'details' : ((restored?.view as View) || HOME_VIEW),
  );
  const [tenantId, setTenantId] = useState(authTenantId);
  const [selected, setSelected] = useState<Organization | null>(restored?.organization ?? null);
  /*
    THE NODE GRAPH EXPLORER SHOULD OPEN ON, when a screen sent the user there.

    Deliberately NOT persisted with the rest of the session. "Explore this
    student in the graph" is an act, not a preference: restoring it days later
    would drop somebody into a subgraph they have no memory of asking for, and
    the entity may not exist any more. It is cleared as soon as it is consumed —
    navigating to the graph by any other route opens the organization, which is
    the correct default.
  */
  const [graphFocus, setGraphFocus] = useState<GraphFocus | null>(null);
  /**
   * The ESO a recommendation asked to open, carried across the navigation.
   *
   * Same shape of problem as graphFocus: the ESO Library is a separate view, so
   * "View ESO" on a recommendation is a navigation plus a selection, and the
   * selection has nowhere to live but here. Cleared on every navigation away,
   * so returning to the library later opens on its own first entry rather than
   * on whatever was last followed from somewhere else.
   */
  const [esoFocus, setEsoFocus] = useState<string | null>(null);
  const [peopleDepartmentId, setPeopleDepartmentId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(restored?.role ?? null);
  const [userName, setUserName] = useState<string | null>(restored?.userName ?? null);
  const { showToast } = useToast();
  const navigationFinishTimer = useRef<number | null>(null);
  const skipNextOrganizationRefresh = useRef(false);
  const prefetchedScreens = useRef(false);
  const selectedRef = useRef<Organization | null>(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    onSessionExpired(() => {
      clearSelectedOrgId();
      clearSession();
      clearRequestCache();
      setSelected(null);
      setOrganizations([]);
      setUserRole(null);
      setUserName(null);
      setAuthenticated(false);
    });
  }, []);

  const load = useCallback(async (mode: 'initial' | 'background' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    setError(null);
    try {
      const authTenant = getAuthTenantId();
      const effectiveTenant = authTenant || tenantId;

      if (authTenant && tenantId !== authTenant) {
        setTenantId(authTenant);
      }

      const data = await api.listOrganizations(effectiveTenant);
      setOrganizations(data);

      if (data.length === 0) {
        clearSelectedOrgId();
        clearSession();
        setSelected(null);
        setUserRole(null);
        setUserName(null);
        return;
      }

      const remembered = getSelectedOrgId();
      const validRemembered = remembered === effectiveTenant ? remembered : '';
      const rememberedSelected = selectedRef.current;
      const currentSelected = organizationBelongsToTenant(rememberedSelected, effectiveTenant) ? rememberedSelected : null;

      // Resolved OUTSIDE the state updater on purpose. Writing to localStorage
      // from inside one would run twice per render under StrictMode, which
      // double-invokes updaters to surface exactly this kind of hidden side
      // effect. A state updater has to be a pure function of its argument.
      const next =
        data.find((o) => organizationBelongsToTenant(o, effectiveTenant)) ??
        // Prefer the freshly-fetched row over the one restored from storage:
        // same organization, but with any rename or new logo picked up.
        data.find((o) => o.id === validRemembered) ??
        data.find((o) => o.id === currentSelected?.id) ??
        // A single organization needs no choosing. Leaving it unselected just
        // renders an empty shell behind a menu the user cannot use.
        (data.length === 1 ? data[0] : null) ??
        currentSelected ??
        null;

      if (organizationBelongsToTenant(next, effectiveTenant)) {
        setSelected(next);
        setSelectedOrgId(effectiveTenant);
        saveSession({ organization: next });
      } else {
        clearSelectedOrgId();
        clearSession();
        setSelected(null);
      }
    } catch (e: any) {
      setError(e.message);
      setOrganizations([]);
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
        clearAuthTokens();
        clearSelectedOrgId();
        clearSession();
        clearRequestCache();
        setSelected(null);
        setUserRole(null);
        setUserName(null);
        setAuthenticated(false);
        return;
      }
      // `selected` is deliberately NOT cleared here. It was restored from a
      // previous good session, and a failed refresh of the organization list —
      // which this deployment sees regularly on a flaky remote database — is
      // not evidence that the organization stopped existing. Clearing it would
      // blank every screen because a background list request timed out.
    } finally {
      if (mode === 'initial') setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!authenticated) return;

    if (skipNextOrganizationRefresh.current) {
      skipNextOrganizationRefresh.current = false;
      window.setTimeout(() => { void load('background'); }, 1_000);
      return;
    }

    void load();
  }, [authenticated, tenantId, load]);

  useEffect(() => {
    if (!authenticated || !selected || prefetchedScreens.current) return;
    prefetchedScreens.current = true;

    const preload = () => {
      [
        COMMAND_CENTER,
        DEPARTMENT_APP,
        PERSON_APP,
        CAPABILITY_APP,
        SIGNAL_DASHBOARD,
        INTELLIGENCE_WORKSPACE,
        DECISION_ANALYTICS_PANEL,
        EXECUTIVE_DASHBOARD,
        GRAPH_EXPLORER,
        EVIDENCE_WORKSPACE,
        DELIBERATION_WORKSPACE,
        INGESTION_WORKSPACE,
      ].forEach((loader) => { void loader().catch(() => {}); });
    };

    const scheduleIdle = window.requestIdleCallback
      ? window.requestIdleCallback(preload, { timeout: 4_000 })
      : window.setTimeout(preload, 1_500);

    return () => {
      if (typeof scheduleIdle === 'number') window.clearTimeout(scheduleIdle);
      else window.cancelIdleCallback?.(scheduleIdle);
    };
  }, [authenticated, selected]);

  if (!authenticated) {
    // ONE WAY INTO THE WORKSPACE: a completed login. Signup ends at its own
    // success state and hands the new administrator's email here, so the
    // credential they just chose is exercised once while it is fresh. Login
    // has already persisted the tokens by the time this runs.
    const establishSession = (session: AuthSession) => {
      if (!session?.organizationId) {
        setAuthenticated(false);
        return;
      }

      clearSelectedOrgId();
      clearSession();
      clearRequestCache();

      const org: Organization = {
        id: session.organizationId,
        tenantId: session.organizationId,
        name: session.organizationName || session.organizationId,
        legalName: null,
        orgCode: '',
        industry: null,
        country: null,
        timezone: null,
        currency: null,
        email: null,
        phone: null,
        website: null,
        address: null,
        registrationNumber: null,
        taxId: null,
        contactPerson: null,
        employeeCount: null,
        workWeek: null,
        logo: session.organizationLogo ?? null,
        status: 'active',
        createdBy: '',
        createdDate: '',
        updatedDate: '',
        // A LOGIN KNOWS THE ORGANIZATION'S NAME, NOT ITS SHAPE. The capability
        // lists arrive with the first real list response a moment later; until
        // then this placeholder claims nothing, which is what keeps the record
        // panel from flashing a form of fields the tenant may not have.
        profileFields: [],
        identityFields: [],
      };

      setSelectedOrgId(session.organizationId);
      setSelected(org);
      setTenantId(session.organizationId);
      setUserRole(session.role || null);
      setUserName(session.name || null);
      setView(HOME_VIEW);
      skipNextOrganizationRefresh.current = true;
      setAuthenticated(true);

      // Written here, not in the auth screens, because this is where the app
      // decides what the session IS. The role in particular has to survive a
      // refresh: without it the sidebar cannot tell an admin from a member and
      // shows the member menu to everyone.
      saveSession({
        role: session.role || null,
        userName: session.name || null,
        organization: org,
        view: HOME_VIEW,
      });
    };

    if (authScreen === 'signup') {
      return (
        <Signup
          onCreated={(email) => {
            setSignupEmail(email);
            setAuthScreen('login');
          }}
          onSwitchToLogin={() => setAuthScreen('login')}
        />
      );
    }

    return (
      <Login
        onLogin={establishSession}
        onSwitchToSignup={() => setAuthScreen('signup')}
        initialEmail={signupEmail}
      />
    );
  }

  const navigate = (v: View, org?: Organization, focus?: GraphFocus | null) => {
    globalLoading.navigationStarted();
    if (navigationFinishTimer.current !== null) window.clearTimeout(navigationFinishTimer.current);
    navigationFinishTimer.current = window.setTimeout(() => {
      globalLoading.navigationFinished();
      navigationFinishTimer.current = null;
    }, 0);

    // `org ?? null` used to clear the selection on every argument-less
    // navigate() — and the sidebar calls it with `selected ?? undefined`, so
    // any nav click while nothing was selected wiped it. Keeping the current
    // organization unless a new one is named is what makes the menu usable.
    const nextOrg = org ?? selected;

    const authTenant = getAuthTenantId();
    const scopedNextOrg = organizationBelongsToTenant(nextOrg, authTenant) ? nextOrg : null;

    if (scopedNextOrg) setSelectedOrgId(authTenant);
    else clearSelectedOrgId();
    setSelected(scopedNextOrg);
    setView(v);
    setPeopleDepartmentId(null);

    // Only a navigation that NAMES a node carries one. Any other route to the
    // graph — the sidebar, the command palette, a reload — opens on the
    // organization.
    setGraphFocus(v === 'graph' ? (focus ?? null) : null);
    if (v !== 'esolibrary') setEsoFocus(null);

    saveSession({ organization: scopedNextOrg, view: v });
  };

  /**
   * "Explore in Graph", from any screen that shows an entity.
   *
   * It carries the entity's OWN label and id — the same ids the graph API reads
   * against this tenant — so nothing about the entity is re-derived and no
   * second identity scheme appears. A node id that does not belong to this
   * tenant simply does not resolve, and the graph opens on the organization.
   */
  const exploreInGraph = (label: string, id: string) => navigate('graph', selected ?? undefined, { label, id });

  /**
   * Open one executable object from wherever it was referenced.
   *
   * Passed only to screens that render recommendations. A recommendation
   * carries an esoId only where an ESO in this tenant's catalogue declares its
   * finding, so this is never called with an id the library cannot resolve —
   * and if it somehow is, the library falls back to its first entry rather than
   * showing an empty detail pane.
   */
  const viewEso = (esoId: string) => {
    setEsoFocus(esoId);
    navigate('esolibrary', selected ?? undefined);
  };

  /**
   * @param revokeOnServer POST /auth/logout to revoke the refresh token.
   *        Skipped after a permanent deletion: that tenant's token rows were
   *        destroyed with it, so there is nothing left to revoke, and asking
   *        the server to revoke a token for a tenant it can no longer find is
   *        a round trip whose only possible outcome is a no-op.
   */
  const logout = async (revokeOnServer = true) => {
    try {
      const refreshToken = revokeOnServer ? getRefreshToken() : null;
      if (refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Best-effort logout; local state is the authoritative clear.
    }

    clearAuthTokens();
    // 'hpbrain-user' is deliberately NOT removed. It holds only the remembered
    // email for the sign-in form, and signing out then back in is the exact
    // situation "Remember me" exists for — clearing it here made the checkbox
    // impossible to benefit from. The Login form clears it when the user
    // unticks the box, which is the control that should own it.
    clearSelectedOrgId();
    clearSession();
    clearRequestCache();
    setSelected(null);
    setOrganizations([]);
    setUserRole(null);
    setUserName(null);
    setView(HOME_VIEW);
    setAuthenticated(false);
  };

  const reloadAfter = async (message?: string, tone: 'success' | 'warning' = 'success') => {
    await load();
    if (message) showToast(tone, message);
  };

  /**
   * An organization was PERMANENTLY deleted — SIGN OUT COMPLETELY.
   *
   * WHY A FULL LOGOUT AND NOT A REDIRECT TO THE LIST. EnsureTenantScope refuses
   * any request whose route tenant differs from the tenant in the verified
   * token, so an administrator can only ever delete THEIR OWN organization.
   * There is no case where someone deletes one organization and still has
   * another to go back to — the tenant they were authenticated as no longer
   * exists. Returning them to the organization list would leave the browser
   * holding tokens for a dead tenant, and every request from that screen 404s.
   *
   * So the session is torn down the same way signing out tears it down:
   * accessToken, refreshToken, remembered organization id, persisted workspace
   * session, and all in-memory state. `hpbrain-user` is left alone — it holds
   * only the remembered email for the sign-in form, and re-registering with the
   * same address is the very next thing this workflow expects.
   *
   * The toast survives the transition because ToastProvider sits ABOVE the
   * authenticated tree, so the confirmation is read on the login screen rather
   * than flashing on a workspace that is being unmounted.
   */
  const handleOrganizationDeleted = async (org: Organization, result: DeletionResult) => {
    // Clear the tenant-scoped state first so nothing re-renders against the
    // dead tenant during the teardown, then drop authentication entirely.
    setSelected(null);
    setOrganizations([]);
    clearSelectedOrgId();
    clearSession();

    await logout(false);

    showToast(
      'warning',
      `"${org.name}" was permanently deleted — ${result.rows.toLocaleString()} record`
      + `${result.rows === 1 ? '' : 's'} across ${result.tables} table`
      + `${result.tables === 1 ? '' : 's'} removed. Please sign in again.`,
    );
  };

  return (
    <AppShell
      view={view}
      orgName={selected?.name}
      hasSelectedOrg={!!selected}
      userName={userName}
      userRole={userRole}
      onNavigate={(v) => navigate(v, selected ?? undefined)}
      onLogout={logout}
      // The real NotificationBell, passed in rather than invented by the shell.
      // When no organization is selected there is no tenant to query, so the
      // shell falls back to a disabled, honestly-labelled control instead of a
      // bell that reports zero.
      notificationSlot={selected ? <NotificationBell tenantId={selected.tenantId} /> : undefined}
    >
      <ErrorBoundary key={view} label={view}>
            {error && (
              <Alert tone="danger" title="Workspace data is partially unavailable">
                {error}
              </Alert>
            )}

            {/*
              Nothing selected and nothing to select yet. Every view below is
              gated on `selected`, so without this branch the content pane
              renders literally nothing — which is what a refresh used to show
              while the organization list was in flight, and what it showed
              permanently if that request failed. A blank page is
              indistinguishable from a broken one, so say which it is.
            */}
            {!selected && (
              loading ? (
                <div className="u-state-shell" role="status" aria-live="polite">
                  <div className="u-card u-card-pad u-state-card">
                    <div className="u-state-card__eyebrow">Loading organization</div>
                    <div className="u-state-card__stack" aria-hidden="true">
                      <span className="u-skeleton" style={{ display: 'block', width: '38%', height: 12, borderRadius: 999 }} />
                      <span className="u-skeleton" style={{ display: 'block', width: '100%', height: 72, borderRadius: 16 }} />
                    </div>
                    <p className="u-state-card__label">Restoring your organization context…</p>
                  </div>
                </div>
              ) : organizations.length > 0 ? (
                <EmptyState
                  title="Select an organization to continue"
                  description="Your account can access more than one organization. Choose one to open its dashboards, workspaces, and management screens."
                  action={(
                    <Button variant="secondary" onClick={() => navigate('list')}>
                      Choose organization
                    </Button>
                  )}
                />
              ) : error ? (
                <ViewErrorState
                  message="Could not reach the server to restore your organization."
                  onRetry={() => { void load(); }}
                />
              ) : (
                <EmptyState
                  title="No organization is available"
                  description="This account does not currently have an organization context attached."
                />
              )
            )}

            {/* Home IS Command Center. Both names render it so a view
                persisted by an earlier build still resolves. */}
            {(view === 'home' || view === 'commandcenter') && selected && (
              <LazyView
                label="Command Center"
                loader={COMMAND_CENTER}
                props={{
                  tenantId: selected.tenantId,
                  organizationName: selected.name,
                  organization: selected,
                  userRole,
                  onNavigate: (v: View) => navigate(v, selected),
                  onUpdated: (org: Organization) => { setSelected(org); saveSession({ organization: org }); showToast('success', 'Organization updated'); },
                  onArchive: () => navigate('archive', selected),
                  onExploreInGraph: exploreInGraph,
                }}
              />
            )}
            {view === 'list' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={() => navigate('create')}>+ New Organization</button>
              </div>
            )}
            {view === 'list' && (
              <LazyView
                label="Organizations"
                loader={ORGANIZATION_LIST}
                props={{
                  organizations,
                  loading,
                  onSelect: (org: Organization) => navigate('details', org),
                  // Not 'edit'. Editing moved inline onto the organization page.
                  onEdit: (org: Organization) => navigate('details', org),
                  onArchive: (org: Organization) => navigate('archive', org),
                }}
              />
            )}
            {view === 'create' && (
              <LazyView
                label="Create Organization"
                loader={ORGANIZATION_CREATE}
                props={{
                  tenantId,
                  onCreated: (org: Organization) => { navigate('list'); reloadAfter(`Organization "${org.name}" created`); },
                  onCancel: () => navigate('list'),
                }}
              />
            )}
            {view === 'details' && selected && (
              <LazyView
                label="Command Center"
                loader={COMMAND_CENTER}
                props={{
                  tenantId: selected.tenantId,
                  organizationName: selected.name,
                  organization: selected,
                  userRole,
                  onNavigate: (v: View) => navigate(v, selected),
                  onUpdated: (org: Organization) => { setSelected(org); saveSession({ organization: org }); showToast('success', 'Organization updated'); },
                  onArchive: () => navigate('archive', selected),
                  onExploreInGraph: exploreInGraph,
                }}
              />
            )}
            {view === 'departments' && selected && (
              <LazyView
                label="Departments"
                loader={DEPARTMENT_APP}
                props={{
                  organization: selected,
                  onBack: () => navigate('details', selected),
                  onOpenPeople: (departmentId: string) => {
                    navigate('people', selected);
                    setPeopleDepartmentId(departmentId);
                  },
                  onExploreInGraph: exploreInGraph,
                  // The department intelligence screen's blind-spot fixes route
                  // out of Departments entirely — into Ingestion, Signals or
                  // Capabilities — so they need the shell's own navigator.
                  onNavigate: (view: string) => navigate(view as View, selected),
                }}
              />
            )}
            {view === 'people' && selected && (
              <LazyView
                label="People"
                loader={PERSON_APP}
                props={{ organization: selected, initialDepartmentId: peopleDepartmentId, onBack: () => navigate('details', selected), onExploreInGraph: exploreInGraph, onNavigate: (v: string) => navigate(v as View, selected) }}
              />
            )}
            {view === 'capabilities' && selected && (
              <LazyView
                label="Capabilities"
                loader={CAPABILITY_APP}
                props={{ organization: selected, onBack: () => navigate('details', selected) }}
              />
            )}
            {view === 'signals' && selected && (
              <LazyView
                label="Signals"
                loader={SIGNAL_DASHBOARD}
                props={{ tenantId: selected.tenantId, onNavigate: (v: View) => navigate(v, selected), onExploreInGraph: exploreInGraph }}
              />
            )}
            {view === 'workspace' && selected && (
              <LazyView
                label="Intelligence Workspace"
                loader={INTELLIGENCE_WORKSPACE}
                props={{ tenantId: selected.tenantId, onNavigate: (v: View) => navigate(v, selected) }}
              />
            )}
            {view === 'analytics' && selected && (
              <LazyView label="Analytics" loader={DECISION_ANALYTICS_PANEL} props={{ tenantId: selected.tenantId, onViewEso: viewEso }} />
            )}
            {view === 'executive' && selected && (
              <LazyView label="Executive Dashboard" loader={EXECUTIVE_DASHBOARD} props={{ tenantId: selected.tenantId, onViewEso: viewEso }} />
            )}
            {view === 'graph' && selected && (
              <LazyView
                label="Graph Explorer"
                loader={GRAPH_EXPLORER}
                props={{ tenantId: selected.tenantId, organizationName: selected.name, focus: graphFocus, onNavigate: (v: View) => navigate(v, selected) }}
              />
            )}
            {view === 'agents' && selected && (
              <LazyView label="Agent Monitor" loader={AGENT_MONITOR} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'evidence' && selected && (
              <LazyView
                label="Evidence"
                loader={EVIDENCE_WORKSPACE}
                props={{ tenantId: selected.tenantId, onNavigate: (v: View) => navigate(v, selected) }}
              />
            )}
            {(view === 'aiassistant' || view === 'search' || view === 'copilot' || view === 'aiworkspace') && selected && (
              <LazyView label="AI Assistant" loader={AI_ASSISTANT} props={{ tenantId: selected.tenantId }} />
            )}
            {/* Suspense sits INSIDE the content region, so the sidebar and
                header stay mounted and interactive while the chunk downloads —
                a fallback at shell level would blank the navigation and strand
                the user on a slow connection. */}
            {view === 'decisionintel' && selected && (
              <LazyView
                label="Decision Intelligence"
                loader={DECISION_INTELLIGENCE}
                props={{ tenantId: selected.tenantId }}
              />
            )}
            {view === 'tasks' && selected && (
              <LazyView label="Tasks" loader={TASK_MONITOR} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'deliberation' && selected && (
              <LazyView label="Deliberation" loader={DELIBERATION_WORKSPACE} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'settings' && selected && (
              <LazyView
                label="Settings"
                loader={SETTINGS}
                props={{
                  tenantId: selected.tenantId,
                  organizationName: selected.name,
                  orgStatus: selected.status,
                  organization: selected,
                  onDeleted: handleOrganizationDeleted,
                }}
              />
            )}
            {view === 'policies' && selected && (
              <LazyView label="Policies" loader={POLICY_MANAGEMENT} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'mentalmodels' && selected && (
              <LazyView label="Mental Models" loader={MENTAL_MODEL_BROWSER} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'executions' && selected && (
              <LazyView label="Executions" loader={EXECUTION_CENTER} props={{ tenantId: selected.tenantId }} />
            )}
            {view === 'knowledgelibrary' && selected && (
              <LazyView label="Knowledge Library" loader={KNOWLEDGE_LIBRARY} props={{ tenantId: selected.tenantId, onNavigate: (v: string) => navigate(v as View, selected) }} />
            )}
            {view === 'ingestion' && selected && (
              <LazyView
                label="Ingestion"
                loader={INGESTION_WORKSPACE}
                props={{ tenantId: selected.tenantId, onNavigate: (v: View) => navigate(v, selected) }}
              />
            )}
            {view === 'memory' && selected && (
              <LazyView label="Memory" loader={MEMORY_SCREEN} props={{ tenantId: selected.tenantId, onNavigate: (v: string) => navigate(v as View, selected) }} />
            )}
            {/* Now takes a tenant: the catalogue it renders is per-organization,
                where before it rendered the same two hardcoded definitions for
                everyone. */}
            {view === 'esolibrary' && selected && (
              <LazyView label="ESO Library" loader={ESO_LIBRARY_SCREEN} props={{ tenantId: selected.tenantId, focusEsoId: esoFocus }} />
            )}
            {view === 'kasbaexplorer' && selected && (
              <LazyView label="KASBA" loader={KASBA_EXPLORER} props={{ tenantId: selected.tenantId, organizationName: selected.name }} />
            )}
            {view === 'archive' && selected && (
              <LazyView
                label="Archive Organization"
                loader={ORGANIZATION_ARCHIVE_CONFIRM}
                props={{
                  organization: selected,
                  onArchived: (org: Organization) => { setSelected(null); setView('list'); reloadAfter(`Organization "${org.name}" archived`, 'warning'); },
                  onCancel: () => navigate('details', selected),
                }}
              />
            )}
      </ErrorBoundary>
    </AppShell>
  );
}
