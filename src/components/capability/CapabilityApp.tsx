import { useState, useEffect } from 'react';
import { Archive, Clock3, Layers3, Plus, Target } from 'lucide-react';
import { HeaderActions, PageHeader } from '../../ui';
import type { Organization } from '../../App';
import CapabilityList from './CapabilityList';
import CapabilityCreate from './CapabilityCreate';
import CapabilityEdit from './CapabilityEdit';
import CapabilityDetails from './CapabilityDetails';
import CapabilityAssignment from './CapabilityAssignment';
import CapabilityArchiveConfirm from './CapabilityArchiveConfirm';
import CapabilityVersionHistory from './CapabilityVersionHistory';
import { api } from '../../api/capability';
import './CapabilityList.css';

export type CapabilityView = 'list' | 'create' | 'edit' | 'details' | 'assignment' | 'archive' | 'versions';

const CAPABILITY_VIEW_LABEL: Record<CapabilityView, string> = {
  list: 'Capabilities',
  create: 'New capability',
  edit: 'Edit capability',
  details: 'Capability detail',
  assignment: 'Assignments',
  archive: 'Archive capability',
  versions: 'Version history',
};

export interface Capability {
  id: string;
  tenantId: string;
  orgId: string;
  capabilityCode: string;
  name: string;
  description: string | null;
  category: string;
  capabilityType: string;
  difficulty: string;
  criticality: string;
  version: number;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
  knowledge: any;
  ability: any;
  skill: any;
  behaviour: any;
  attitude: any;
}

export default function CapabilityApp({ organization, onBack }: { organization: Organization; onBack: () => void }) {
  const [view, setView] = useState<CapabilityView>('list');
  const [selected, setSelected] = useState<Capability | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listCapabilities(organization.tenantId, organization.id);
      setCapabilities(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organization.tenantId, organization.id]);

  const navigate = (v: CapabilityView, cap?: Capability) => {
    setSelected(cap ?? null);
    setView(v);
  };

  const headerTitle = view === 'list'
    ? 'Capability Coverage'
    : view === 'create'
      ? 'Create Capability'
      : selected?.name ?? 'Capability';

  const headerDescription = view === 'list'
    ? `What ${organization.name} can do, where capability is strong, and where capability gaps exist.`
    : view === 'create'
      ? 'Define a reusable organizational capability with clear proficiency expectations across the KASBA model.'
      : 'Capability definition, assignment coverage, version history and operating status.';

  const headerMeta = selected ? [
    selected.capabilityCode ? { label: selected.capabilityCode, title: 'Capability code' } : null,
    selected.capabilityType ? { label: selected.capabilityType, title: 'Capability type' } : null,
    selected.category ? { label: selected.category, title: 'Category' } : null,
    selected.criticality ? { label: selected.criticality, title: 'Criticality' } : null,
    { label: `v${selected.version}`, title: 'Current version' },
  ] : [];

  return (
    <div className="cap-app">
      <PageHeader
        variant={view === 'list' ? 'list' : 'detail'}
        icon={<Target />}
        title={headerTitle}
        description={headerDescription}
        status={selected ? { label: selected.status, tone: selected.status === 'active' ? 'success' : selected.status === 'archived' ? 'warning' : 'neutral' } : undefined}
        meta={headerMeta}
        back={{ label: view === 'list' ? 'Organization' : 'Capabilities', onClick: view === 'list' ? onBack : () => navigate('list') }}
        breadcrumbs={[
          { label: organization.name, onClick: onBack },
          { label: 'Capabilities', onClick: view === 'list' ? undefined : () => navigate('list') },
          ...(view === 'list' ? [] : [{ label: CAPABILITY_VIEW_LABEL[view] }]),
        ]}
        actions={view === 'list' ? (
          <HeaderActions>
            <button type="button" className="u-btn u-btn-primary" onClick={() => navigate('create')}>
              <Plus size={15} aria-hidden="true" /> New Capability
            </button>
          </HeaderActions>
        ) : selected ? (
          <HeaderActions>
            {view !== 'assignment' && (
              <button type="button" className="u-btn u-btn-primary" onClick={() => navigate('assignment', selected)}>
                <Layers3 size={15} aria-hidden="true" /> Assign
              </button>
            )}
            {view !== 'versions' && (
              <button type="button" className="u-btn u-btn-secondary" onClick={() => navigate('versions', selected)}>
                <Clock3 size={15} aria-hidden="true" /> Versions
              </button>
            )}
            {view !== 'archive' && (
              <button type="button" className="u-btn u-btn-ghost" onClick={() => navigate('archive', selected)}>
                <Archive size={15} aria-hidden="true" /> Archive
              </button>
            )}
          </HeaderActions>
        ) : undefined}
      />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {view === 'list' && (
        <CapabilityList
          capabilities={capabilities}
          loading={loading}
          tenantId={organization.tenantId}
          onSelect={(cap) => navigate('details', cap)}
          onEdit={(cap) => navigate('edit', cap)}
          onArchive={(cap) => navigate('archive', cap)}
          onAssign={(cap) => navigate('assignment', cap)}
        />
      )}
      {view === 'create' && (
        <CapabilityCreate
          tenantId={organization.tenantId}
          orgId={organization.id}
          onCreated={() => { navigate('list'); load(); }}
          onCancel={() => navigate('list')}
        />
      )}
      {view === 'edit' && selected && (
        <CapabilityEdit
          capability={selected}
          onUpdated={(cap) => { navigate('details', cap); load(); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
      {view === 'details' && selected && (
        <CapabilityDetails
          capability={selected}
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onAssign={() => navigate('assignment', selected)}
          onVersions={() => navigate('versions', selected)}
          onBack={() => navigate('list')}
        />
      )}
      {view === 'assignment' && selected && (
        <CapabilityAssignment
          capability={selected}
          onBack={() => navigate('details', selected)}
        />
      )}
      {view === 'versions' && selected && (
        <CapabilityVersionHistory
          capability={selected}
          onBack={() => navigate('details', selected)}
        />
      )}
      {view === 'archive' && selected && (
        <CapabilityArchiveConfirm
          capability={selected}
          onArchived={() => { navigate('list'); load(); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
    </div>
  );
}
