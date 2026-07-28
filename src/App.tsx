import { useState, useEffect } from 'react';
import OrganizationList from './components/organization/OrganizationList';
import OrganizationCreate from './components/organization/OrganizationCreate';
import OrganizationEdit from './components/organization/OrganizationEdit';
import OrganizationDetails from './components/organization/OrganizationDetails';
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
import DecisionIntelligence from './components/workspace/DecisionIntelligence';
import TaskMonitor from './components/workspace/TaskMonitor';
import DeliberationWorkspace from './components/workspace/DeliberationWorkspace';
import Settings from './components/workspace/Settings';
import GlobalSearch from './components/workspace/GlobalSearch';
import PolicyManagement from './components/workspace/PolicyManagement';
import MentalModelBrowser from './components/workspace/MentalModelBrowser';
import ExecutionCenter from './components/workspace/ExecutionCenter';
import AIWorkspace from './components/workspace/AIWorkspace';
import KnowledgeLibrary from './components/workspace/KnowledgeLibrary';
import CommandCenter from './components/workspace/CommandCenter';
import KasbaExplorer from './components/workspace/KasbaExplorer';
import Login from './components/auth/Login';
import { Sidebar, Breadcrumb, breadcrumbFor } from './components/Sidebar';
import { NotificationBell } from './components/NotificationBell';
import { ToastProvider, useToast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { api } from './api/organization';
import type { OrganizationRow } from './api/organization';
import { onSessionExpired } from './api/client';
import { getAuthTenantId, getSelectedOrgId, setSelectedOrgId, clearSelectedOrgId } from './utils/tenant';

export type View = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'departments' | 'people' | 'capabilities' | 'signals' | 'workspace' | 'analytics' | 'executive' | 'graph' | 'agents' | 'evidence' | 'copilot' | 'decisionintel' | 'tasks' | 'deliberation' | 'settings' | 'search' | 'policies' | 'mentalmodels' | 'executions' | 'aiworkspace' | 'knowledgelibrary' | 'commandcenter' | 'kasbaexplorer';

/**
 * The organization shape is now owned by api/organization.ts, which is where
 * the ERP row is normalized. Re-exported here so the ~10 components that
 * `import type { Organization } from '../../App'` keep working, and so the two
 * definitions cannot drift apart again — the previous local copy declared
 * timezone/currency as non-null strings that the ERP has no columns for.
 */
export type Organization = OrganizationRow;

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

/**
 * With no accessToken the client falls back to the dev-bypass bearer token,
 * which the backend accepts outside production — so the app is usable without
 * signing in. An explicit sign-out has to be remembered, otherwise the Logout
 * button would drop straight back into a dev-bypass session and Login would be
 * unreachable.
 */
const SIGNED_OUT_KEY = 'signedOut';

function initialAuthState(): boolean {
  if (localStorage.getItem('accessToken')) return true;
  return localStorage.getItem(SIGNED_OUT_KEY) === null;
}

function AppShell() {
  const [authenticated, setAuthenticated] = useState(initialAuthState);
  const [view, setView] = useState<View>('list');
  // The organizations list is the one call made BEFORE an organization has been
  // chosen, so it is addressed with the token's own tenant. Every screen after
  // this point derives its tenant from the selected organization instead
  // (org.tenantId === org.id), which is where the Brain's rows actually live.
  const [tenantId, setTenantId] = useState(getAuthTenantId());
  const [selected, setSelected] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    onSessionExpired(() => setAuthenticated(false));
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrganizations(tenantId);
      setOrganizations(data);

      // Re-attach the organization the user last selected so a refresh keeps
      // the same tenant context instead of dropping back to the empty list.
      const remembered = getSelectedOrgId();
      setSelected((current) => current ?? data.find((o) => o.id === remembered) ?? null);
    } catch (e: any) {
      setError(e.message);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, tenantId]);

  // Every hook above runs unconditionally; the sign-in gate has to come after
  // them, or the hook count changes between renders when auth flips.
  if (!authenticated) {
    return (
      <Login
        onLogin={() => {
          localStorage.removeItem(SIGNED_OUT_KEY);
          setTenantId(getAuthTenantId());
          setAuthenticated(true);
        }}
      />
    );
  }

  const navigate = (v: View, org?: Organization) => {
    if (org) setSelectedOrgId(org.id);
    setSelected(org ?? null);
    setView(v);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.setItem(SIGNED_OUT_KEY, '1');
    clearSelectedOrgId();
    setSelected(null);
    setOrganizations([]);
    setAuthenticated(false);
  };

  /** Re-read the list from the API after any mutation, rather than splicing local state. */
  const reloadAfter = async (message?: string, tone: 'success' | 'warning' = 'success') => {
    await load();
    if (message) showToast(tone, message);
  };

  return (
    <div className="eb-app">
      <CommandPalette onNavigate={(v) => navigate(v, selected ?? undefined)} hasSelectedOrg={!!selected} />
<Sidebar
         currentView={view}
         hasSelectedOrg={!!selected}
         onNavigate={(v) => navigate(v, selected ?? undefined)}
         onLogout={logout}
       />
      <div className="eb-main">
        <div style={{ position: 'relative' }}>
          <Breadcrumb items={breadcrumbFor(view, selected?.name)} />
          {selected && (
            <div style={{ position: 'absolute', top: 8, right: 24 }}>
              <NotificationBell tenantId={selected.tenantId} />
            </div>
          )}
        </div>
        <div className="eb-content">
          {view === 'list' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => navigate('create')}>+ New Organization</button>
            </div>
          )}
          {error && <div style={{ color: 'red' }}>{error}</div>}
      {view === 'list' && (
        <OrganizationList
          organizations={organizations}
          loading={loading}
          onSelect={(org) => navigate('details', org)}
          onEdit={(org) => navigate('edit', org)}
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
      {view === 'edit' && selected && (
        <OrganizationEdit
          organization={selected}
          onUpdated={(org) => { navigate('details', org); reloadAfter('Organization updated'); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
      {view === 'details' && selected && (
        <OrganizationDetails
          organization={selected}
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onBack={() => navigate('list')}
          onViewDepartments={() => navigate('departments', selected)}
          onViewPeople={() => navigate('people', selected)}
          onViewCapabilities={() => navigate('capabilities', selected)}
          onViewSignals={() => navigate('signals', selected)}
          onViewWorkspace={() => navigate('workspace', selected)}
          onViewAnalytics={() => navigate('analytics', selected)}
          onViewExecutive={() => navigate('executive', selected)}
          onViewGraph={() => navigate('graph', selected)}
          onViewAgents={() => navigate('agents', selected)}
          onViewEvidence={() => navigate('evidence', selected)}
          onViewCopilot={() => navigate('copilot', selected)}
          onViewDecisionIntel={() => navigate('decisionintel', selected)}
          onViewTasks={() => navigate('tasks', selected)}
          onViewDeliberation={() => navigate('deliberation', selected)}
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
        <SignalDashboard tenantId={selected.tenantId} />
      )}
      {view === 'workspace' && selected && (
        <IntelligenceWorkspace tenantId={selected.tenantId} />
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
        <EvidenceWorkspace tenantId={selected.tenantId} />
      )}
      {view === 'copilot' && selected && (
        <ConversationWorkspace tenantId={selected.tenantId} />
      )}
      {view === 'decisionintel' && selected && (
        <DecisionIntelligence tenantId={selected.tenantId} />
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
      {view === 'commandcenter' && selected && (
        <CommandCenter tenantId={selected.tenantId} onNavigate={(v) => navigate(v, selected)} />
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
        </div>
      </div>
    </div>
  );
}
