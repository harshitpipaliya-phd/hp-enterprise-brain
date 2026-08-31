
import { FolderTree, Plus } from 'lucide-react';
import { HeaderActions, PageHeader } from '../../ui';
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
import { ExploreInGraphButton } from '../graph/ExploreInGraphButton';

export type DepartmentView = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'intelligence';

/** The last breadcrumb on each sub-screen. `list` never renders one — that view
 *  is DepartmentList, which draws the product header itself. */
const DEPARTMENT_VIEW_LABEL: Record<DepartmentView, string> = {
  list: 'Departments',
  create: 'New department',
  edit: 'Edit department',
  details: 'Department',
  archive: 'Archive department',
  intelligence: 'Department intelligence',
};

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

export default function DepartmentApp({
  organization,
  onBack,
  onOpenPeople,
  onExploreInGraph,
}: {
  organization: Organization;
  onBack: () => void;
  onOpenPeople?: (departmentId: string) => void;
  onExploreInGraph?: (label: string, id: string) => void;
}) {
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

  /*
    THE ACADEMIC STRUCTURE IS NO LONGER A SEPARATE PAGE.

    This component used to REPLACE the Departments screen with a standalone
    "Academic structure" page whenever the HR system held no units — so on Lions
    the departments view was unreachable, and the school's organizational
    structure and its dataset dimensions could never be seen together.

    Both now live on one screen, in a deliberate order: the four teaching
    sections first as the organizational structure, and the academic dimensions
    below them as supporting detail. DepartmentList owns that composition (see
    AcademicSectionView); nothing is dropped and nothing is duplicated.
  */
  const navigate = (v: DepartmentView, dept?: Department) => {
    setSelected(dept ?? null);
    setViewingPersonId(null);
    setView(v);
  };

  return (
    <div style={{ fontFamily: 'var(--sans)', maxWidth: 1320, margin: '0 auto', padding: view === 'list' ? 0 : 24 }}>
      {/*
        ONE HEADER PER SCREEN.

        Two of the views below already carry the product header themselves —
        `list` is DepartmentList and `intelligence` is DepartmentIntelligence —
        so this one stands down for those. The remaining sub-screens (create,
        edit, details, archive) open with a form and no title of their own, and
        this is the header that names where they are.
      */}
      {view !== 'list' && view !== 'intelligence' && (
        <PageHeader
          variant="detail"
          icon={<FolderTree />}
          title="Departments"
          description={`How ${organization.name} is structured.`}
          back={{ label: 'Departments', onClick: () => navigate('list') }}
          breadcrumbs={[
            { label: organization.name },
            { label: 'Departments', onClick: () => navigate('list') },
            { label: DEPARTMENT_VIEW_LABEL[view] },
          ]}
          actions={(
            <HeaderActions>
              <button type="button" className="u-btn u-btn-primary" onClick={() => navigate('create')}>
                <Plus size={15} aria-hidden="true" /> New Department
              </button>
            </HeaderActions>
          )}
        />
      )}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {view === 'list' && (
        <DepartmentList
          organization={organization}
          departments={departments}
          loading={loading}
          onSelect={(dept) => navigate('intelligence', dept)}
          onOpenPeople={(dept) => onOpenPeople?.(dept.id)}
          onCreate={() => navigate('create')}
          onRefresh={load}
          onBack={onBack}
        />
      )}
      {view === 'intelligence' && selected && viewingPersonId && (
        <PersonIntelligence
          tenantId={organization.tenantId}
          personId={viewingPersonId}
          onBack={() => setViewingPersonId(null)}
          backLabel={`Back to ${selected.name}`}
          onExploreInGraph={onExploreInGraph}
        />
      )}
      {view === 'intelligence' && selected && !viewingPersonId && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: -4, justifyContent: 'flex-end' }}>
            <ExploreInGraphButton
              label="Department"
              id={selected.id}
              entityName={selected.name}
              onExplore={onExploreInGraph}
              className="eb-pill-btn"
            />
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
          organizationName={organization.name}
          onCreated={() => { navigate('list'); load(); }}
          onCancel={() => navigate('list')}
        />
      )}
      {view === 'edit' && selected && (
        <DepartmentEdit
          department={selected}
          onUpdated={(dept) => { navigate('details', dept); load(); }}
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
          onArchived={() => { navigate('list'); load(); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
    </div>
  );
}
