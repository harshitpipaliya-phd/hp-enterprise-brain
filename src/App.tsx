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
import { onSessionExpired } from './api/client';
import { getTenantId } from './utils/tenant';

export type View = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'departments' | 'people' | 'capabilities' | 'signals' | 'workspace' | 'analytics' | 'executive' | 'graph' | 'agents' | 'evidence' | 'copilot' | 'decisionintel' | 'tasks' | 'deliberation' | 'settings' | 'search' | 'policies' | 'mentalmodels' | 'executions' | 'aiworkspace' | 'knowledgelibrary' | 'commandcenter' | 'kasbaexplorer';

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  orgCode: string;
  industry: string | null;
  country: string | null;
  timezone: string;
  currency: string;
  logo: string | null;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}

function AppShell() {
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem('accessToken'));

  useEffect(() => {
    onSessionExpired(() => setAuthenticated(false));
  }, []);

  const [view, setView] = useState<View>('list');
  const [tenantId] = useState(getTenantId());
  const [selected, setSelected] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOrganizations(tenantId);
      setOrganizations(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (authenticated) load(); }, [authenticated, tenantId]);

  const navigate = (v: View, org?: Organization) => {
    setSelected(org ?? null);
    setView(v);
  };

  const { showToast } = useToast();

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <div className="eb-app">
      <CommandPalette onNavigate={(v) => navigate(v, selected ?? undefined)} hasSelectedOrg={!!selected} />
      <Sidebar
        currentView={view}
        hasSelectedOrg={!!selected}
        onNavigate={(v) => navigate(v, selected ?? undefined)}
        onLogout={() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); setAuthenticated(false); }}
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
          onCreated={(org) => { setOrganizations([org, ...organizations]); navigate('list'); showToast('success', `Organization "${org.name}" created`); }}
          onCancel={() => navigate('list')}
        />
      )}
      {view === 'edit' && selected && (
        <OrganizationEdit
          organization={selected}
          onUpdated={(org) => { setOrganizations(organizations.map((o) => o.id === org.id ? org : o)); navigate('details', org); showToast('success', 'Organization updated'); }}
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
          onArchived={(org) => { setOrganizations(organizations.map((o) => o.id === org.id ? org : o)); navigate('list'); showToast('warning', `Organization "${org.name}" archived`); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
        </div>
      </div>
    </div>
  );
}
