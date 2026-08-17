
import { useState, useEffect, useRef } from 'react';
import OrganizationList from './components/organization/OrganizationList';
import OrganizationCreate from './components/organization/OrganizationCreate';
import OrganizationArchiveConfirm from './components/organization/OrganizationArchiveConfirm';
import DepartmentApp from './components/department/DepartmentApp';
import PersonApp from './components/person/PersonApp';
import CapabilityApp from './components/capability/CapabilityApp';
import SignalDashboard from './components/signal/SignalDashboard';
import IntelligenceWorkspace from './components/workspace/IntelligenceWorkspace';
import DecisionAnalyticsPanel from './components/workspace/DecisionAnalyticsPanel';
import ExecutiveDashboard from './components/workspace/ExecutiveDashboard';
import GraphExplorer from './components/workspace/GraphExplorer';
import AgentMonitor from './components/workspace/AgentMonitor';
import EvidenceWorkspace from './components/workspace/EvidenceWorkspace';
import ConversationWorkspace from './components/workspace/ConversationWorkspace';
/*
  Kept lazy, but no longer for the original reason — which was that this was the
  only screen importing recharts, and recharts plus its exclusive dependencies
  measured ~999 kB that every user downloaded to reach the login screen.

  Decision Intelligence now draws on the hand-built SVG charts in ui/charts.tsx,
  so its chunk is ~15 kB and recharts is no longer in its dependency graph. (It
  is still in the bundle: SignalDashboard, EvidenceWorkspace and DepartmentList
  import it, and moving those is a separate piece of work.)

  The split stays because it still defers the whole intelligence surface —
  screen, chart kit and shared primitives — off the login path, and because
  removing it would be a change with no upside.
*/
const DECISION_INTELLIGENCE = () => import('./components/workspace/DecisionIntelligence');
import TaskMonitor from './components/workspace/TaskMonitor';
import DeliberationWorkspace from './components/workspace/DeliberationWorkspace';
import Settings from './components/workspace/Settings';
import GlobalSearch from './components/workspace/GlobalSearch';
import PolicyManagement from './components/workspace/PolicyManagement';
import MentalModelBrowser from './components/workspace/MentalModelBrowser';
import ExecutionCenter from './components/workspace/ExecutionCenter';
import AIWorkspace from './components/workspace/AIWorkspace';
import KnowledgeLibrary from './components/workspace/KnowledgeLibrary';
import IngestionWorkspace from './components/workspace/IngestionWorkspace';
import MemoryScreen from './components/workspace/MemoryScreen';
import EsoLibraryScreen from './components/workspace/EsoLibraryScreen';
import CommandCenter from './components/workspace/CommandCenter';
import KasbaExplorer from './components/workspace/KasbaExplorer';
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
import type { OrganizationRow } from './api/organization';
import { onSessionExpired } from './api/client';
import { getAuthTenantId, getSelectedOrgId, setSelectedOrgId, clearSelectedOrgId } from './utils/tenant';
import { loadSession, saveSession, clearSession } from './utils/session';
import { LazyView } from './ui';
import { GlobalLoader } from './ui/GlobalLoader';
import { API_BASE } from './api/client';
import { globalLoading } from './ui/globalLoading';

export type View = 'home' | 'list' | 'create' | 'edit' | 'details' | 'archive' | 'departments' | 'people' | 'capabilities' | 'signals' | 'workspace' | 'analytics' | 'executive' | 'graph' | 'agents' | 'evidence' | 'copilot' | 'decisionintel' | 'tasks' | 'deliberation' | 'settings' | 'search' | 'policies' | 'mentalmodels' | 'executions' | 'aiworkspace' | 'knowledgelibrary' | 'memory' | 'esolibrary' | 'commandcenter' | 'kasbaexplorer' | 'ingestion';

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
  return !!localStorage.getItem('accessToken');
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

function AuthenticatedApp() {
  // Read ONCE, synchronously, before the first render. Everything below that
  // depends on it — the role filter in the sidebar, and the `selected` gate on
  // every view — is wrong for as long as it is unknown, and "wrong" here means
  // a stripped-down menu and an empty page rather than a spinner.
  const restored = loadSession();

  const [authenticated, setAuthenticated] = useState(initialAuthState);
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
    restored.view === 'edit' ? 'details' : ((restored.view as View) || HOME_VIEW),
  );
  const [tenantId, setTenantId] = useState(getAuthTenantId());
  const [selected, setSelected] = useState<Organization | null>(restored.organization);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(restored.role);
  const [userName, setUserName] = useState<string | null>(restored.userName);
  const { showToast } = useToast();
  const navigationFinishTimer = useRef<number | null>(null);

  useEffect(() => {
    onSessionExpired(() => {
      clearSelectedOrgId();
      clearSession();
      setSelected(null);
      setOrganizations([]);
      setUserRole(null);
      setUserName(null);
      setAuthenticated(false);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrganizations(tenantId);
      setOrganizations(data);

      const remembered = getSelectedOrgId();

      // Resolved OUTSIDE the state updater on purpose. Writing to localStorage
      // from inside one would run twice per render under StrictMode, which
      // double-invokes updaters to surface exactly this kind of hidden side
      // effect. A state updater has to be a pure function of its argument.
      const next =
        // Prefer the freshly-fetched row over the one restored from storage:
        // same organization, but with any rename or new logo picked up.
        data.find((o) => o.id === remembered) ??
        data.find((o) => o.id === selected?.id) ??
        // A single organization needs no choosing. Leaving it unselected just
        // renders an empty shell behind a menu the user cannot use.
        (data.length === 1 ? data[0] : null) ??
        selected ??
        null;

      if (next) {
        setSelected(next);
        setSelectedOrgId(next.id);
        saveSession({ organization: next });
      }
    } catch (e: any) {
      setError(e.message);
      setOrganizations([]);
      // `selected` is deliberately NOT cleared here. It was restored from a
      // previous good session, and a failed refresh of the organization list —
      // which this deployment sees regularly on a flaky remote database — is
      // not evidence that the organization stopped existing. Clearing it would
      // blank every screen because a background list request timed out.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, tenantId]);

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
        logo: session.organizationLogo ?? null,
        status: 'active',
        createdBy: '',
        createdDate: '',
        updatedDate: '',
      };

      setSelectedOrgId(session.organizationId);
      setSelected(org);
      setTenantId(session.organizationId);
      setUserRole(session.role || null);
      setUserName(session.name || null);
      setView(HOME_VIEW);
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

  const navigate = (v: View, org?: Organization) => {
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

    if (nextOrg) setSelectedOrgId(nextOrg.id);
    setSelected(nextOrg);
    setView(v);
    saveSession({ organization: nextOrg, view: v });
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Best-effort logout; local state is the authoritative clear.
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // 'hpbrain-user' is deliberately NOT removed. It holds only the remembered
    // email for the sign-in form, and signing out then back in is the exact
    // situation "Remember me" exists for — clearing it here made the checkbox
    // impossible to benefit from. The Login form clears it when the user
    // unticks the box, which is the control that should own it.
    clearSelectedOrgId();
    clearSession();
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
            {error && <div style={{ color: 'red' }}>{error}</div>}

            {/*
              Nothing selected and nothing to select yet. Every view below is
              gated on `selected`, so without this branch the content pane
              renders literally nothing — which is what a refresh used to show
              while the organization list was in flight, and what it showed
              permanently if that request failed. A blank page is
              indistinguishable from a broken one, so say which it is.
            */}
            {!selected && (
              <div style={{ padding: 32, color: '#666' }}>
                {loading ? (
                  <p>Loading your organization…</p>
                ) : organizations.length > 0 ? (
                  <>
                    <p>Select an organization to continue.</p>
                    <button onClick={() => navigate('list')}>Choose organization</button>
                  </>
                ) : (
                  <>
                    <p>
                      {error
                        ? 'Could not reach the server to load your organization.'
                        : 'No organization is available for this account.'}
                    </p>
                    <button onClick={() => load()}>Retry</button>
                  </>
                )}
              </div>
            )}

            {/* Home IS Command Center. Both names render it so a view
                persisted by an earlier build still resolves. */}
            {(view === 'home' || view === 'commandcenter') && selected && (
              <CommandCenter
                tenantId={selected.tenantId}
                organizationName={selected.name}
                organization={selected}
                onNavigate={(v) => navigate(v, selected)}
                onUpdated={(org) => { setSelected(org); saveSession({ organization: org }); showToast('success', 'Organization updated'); }}
                onArchive={() => navigate('archive', selected)}
                onArchived={(org) => { setSelected(null); setView('list'); reloadAfter(`Organization "${org.name}" archived`, 'warning'); }}
              />
            )}
            {view === 'list' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button onClick={() => navigate('create')}>+ New Organization</button>
              </div>
            )}
            {view === 'list' && (
              <OrganizationList
                organizations={organizations}
                loading={loading}
                onSelect={(org) => navigate('details', org)}
                /* Not 'edit'. Editing moved inline onto the organization page and
                   the standalone edit screen went with it, so navigating there
                   rendered an empty content pane. */
                onEdit={(org) => navigate('details', org)}
                onArchive={(org) => navigate('archive', org)}
              />
            )}
            {view === 'create' && (
              <OrganizationCreate
                tenantId={tenantId}
                onCreated={(org) => { navigate('list'); reloadAfter(`Organization "${org.name}" created`); }}
                onCancel={() => navigate('list')}
              />
            )}
            {view === 'details' && selected && (
              <CommandCenter
                tenantId={selected.tenantId}
                organizationName={selected.name}
                organization={selected}
                onNavigate={(v) => navigate(v, selected)}
                onUpdated={(org) => { setSelected(org); saveSession({ organization: org }); showToast('success', 'Organization updated'); }}
                onArchive={() => navigate('archive', selected)}
                onArchived={(org) => { setSelected(null); setView('list'); reloadAfter(`Organization "${org.name}" archived`, 'warning'); }}
              />
            )}
            {view === 'departments' && selected && (
              <DepartmentApp organization={selected} onBack={() => navigate('details', selected)} />
            )}
            {view === 'people' && selected && (
              <PersonApp organization={selected} onBack={() => navigate('details', selected)} />
            )}
            {view === 'capabilities' && selected && (
              <CapabilityApp organization={selected} onBack={() => navigate('details', selected)} />
            )}
            {view === 'signals' && selected && (
              <SignalDashboard tenantId={selected.tenantId} onNavigate={(v) => navigate(v, selected)} />
            )}
            {view === 'workspace' && selected && (
              <IntelligenceWorkspace tenantId={selected.tenantId} onNavigate={(v) => navigate(v, selected)} />
            )}
            {view === 'analytics' && selected && (
              <DecisionAnalyticsPanel tenantId={selected.tenantId} />
            )}
            {view === 'executive' && selected && (
              <ExecutiveDashboard tenantId={selected.tenantId} />
            )}
            {view === 'graph' && selected && (
              <GraphExplorer tenantId={selected.tenantId} />
            )}
            {view === 'agents' && selected && (
              <AgentMonitor tenantId={selected.tenantId} />
            )}
            {view === 'evidence' && selected && (
              <EvidenceWorkspace tenantId={selected.tenantId} onNavigate={(v) => navigate(v, selected)} />
            )}
            {view === 'copilot' && selected && (
              <ConversationWorkspace tenantId={selected.tenantId} />
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
              <TaskMonitor tenantId={selected.tenantId} />
            )}
            {view === 'deliberation' && selected && (
              <DeliberationWorkspace tenantId={selected.tenantId} />
            )}
            {view === 'settings' && selected && (
              <Settings tenantId={selected.tenantId} />
            )}
            {view === 'search' && selected && (
              <GlobalSearch tenantId={selected.tenantId} />
            )}
            {view === 'policies' && selected && (
              <PolicyManagement tenantId={selected.tenantId} />
            )}
            {view === 'mentalmodels' && selected && (
              <MentalModelBrowser tenantId={selected.tenantId} />
            )}
            {view === 'executions' && selected && (
              <ExecutionCenter tenantId={selected.tenantId} />
            )}
            {view === 'aiworkspace' && selected && (
              <AIWorkspace tenantId={selected.tenantId} />
            )}
            {view === 'knowledgelibrary' && selected && (
              <KnowledgeLibrary tenantId={selected.tenantId} />
            )}
            {view === 'ingestion' && selected && (
              <IngestionWorkspace tenantId={selected.tenantId} onNavigate={(v) => navigate(v, selected)} />
            )}
            {view === 'memory' && selected && (
              <MemoryScreen tenantId={selected.tenantId} />
            )}
            {/* Now takes a tenant: the catalogue it renders is per-organization,
                where before it rendered the same two hardcoded definitions for
                everyone. */}
            {view === 'esolibrary' && selected && (
              <EsoLibraryScreen tenantId={selected.tenantId} />
            )}
            {view === 'kasbaexplorer' && selected && (
              <KasbaExplorer tenantId={selected.tenantId} />
            )}
            {view === 'archive' && selected && (
              <OrganizationArchiveConfirm
                organization={selected}
                onArchived={(org) => { setSelected(null); setView('list'); reloadAfter(`Organization "${org.name}" archived`, 'warning'); }}
                onCancel={() => navigate('details', selected)}
              />
            )}
      </ErrorBoundary>
    </AppShell>
  );
}
