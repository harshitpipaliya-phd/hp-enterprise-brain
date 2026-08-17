import { useState, useEffect } from 'react';
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1320, margin: '0 auto', padding: 24 }}>
      <header className="cap-app-header">
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1320, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button className="eb-pill-btn" onClick={onBack}>Back to Organization</button>
          <h1>Capabilities</h1>
          <p>What {organization.name} needs its people to be able to do, and who is currently assigned to each.</p>
        </div>
        {view === 'list' && <button onClick={() => navigate('create')}>+ New Capability</button>}
      </header>
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
    </header>
  </div>
  );
}
