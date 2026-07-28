import { useState, useEffect } from 'react';
import type { Organization } from '../../App';
import DepartmentList from './DepartmentList';
import DepartmentCreate from './DepartmentCreate';
import DepartmentEdit from './DepartmentEdit';
import DepartmentDetails from './DepartmentDetails';
import DepartmentArchiveConfirm from './DepartmentArchiveConfirm';
import DepartmentIntelligence from '../workspace/DepartmentIntelligence';
import PersonIntelligence from '../workspace/PersonIntelligence';
import { api } from '../../api/department';

export type DepartmentView = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'intelligence';

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  departmentType: string;
  parentDepartmentId: string | null;
  headId: string | null;
  orgId: string;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

export default function DepartmentApp({ organization, onBack }: { organization: Organization; onBack: () => void }) {
  const [view, setView] = useState<DepartmentView>('list');
  const [selected, setSelected] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingPersonId, setViewingPersonId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listDepartments(organization.tenantId, organization.id);
      setDepartments(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organization.tenantId, organization.id]);

  const navigate = (v: DepartmentView, dept?: Department) => {
    setSelected(dept ?? null);
    setViewingPersonId(null);
    setView(v);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button onClick={onBack}>← Back to Organizations</button>
          <h1 style={{ display: 'inline', marginLeft: 12 }}>Departments — {organization.name}</h1>
        </div>
        <button onClick={() => navigate('create')}>+ New Department</button>
      </header>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {view === 'list' && (
        <DepartmentList
          departments={departments}
          loading={loading}
          onSelect={(dept) => navigate('intelligence', dept)}
          onEdit={(dept) => navigate('edit', dept)}
          onArchive={(dept) => navigate('archive', dept)}
        />
      )}
      {view === 'intelligence' && selected && viewingPersonId && (
        <PersonIntelligence tenantId={organization.tenantId} personId={viewingPersonId} onBack={() => setViewingPersonId(null)} />
      )}
      {view === 'intelligence' && selected && !viewingPersonId && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: -4, justifyContent: 'flex-end' }}>
            <button className="eb-pill-btn" onClick={() => navigate('details', selected)}>Raw Details</button>
            <button className="eb-pill-btn" onClick={() => navigate('edit', selected)}>Edit</button>
            <button className="eb-pill-btn" onClick={() => navigate('archive', selected)}>Archive</button>
          </div>
          <DepartmentIntelligence tenantId={organization.tenantId} departmentId={selected.id} onBack={() => navigate('list')} onSelectPerson={setViewingPersonId} />
        </div>
      )}
      {view === 'create' && (
        <DepartmentCreate
          tenantId={organization.tenantId}
          orgId={organization.id}
          onCreated={(dept) => { setDepartments([dept, ...departments]); navigate('list'); }}
          onCancel={() => navigate('list')}
        />
      )}
      {view === 'edit' && selected && (
        <DepartmentEdit
          department={selected}
          onUpdated={(dept) => { setDepartments(departments.map((d) => d.id === dept.id ? dept : d)); navigate('details', dept); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
      {view === 'details' && selected && (
        <DepartmentDetails
          department={selected}
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onBack={() => navigate('list')}
        />
      )}
      {view === 'archive' && selected && (
        <DepartmentArchiveConfirm
          department={selected}
          onArchived={(dept) => { setDepartments(departments.map((d) => d.id === dept.id ? dept : d)); navigate('list'); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
    </div>
  );
}
