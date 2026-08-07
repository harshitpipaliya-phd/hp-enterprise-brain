import { useEffect, useState } from 'react';
import type { Organization } from '../../App';
import { api as departmentApi } from '../../api/department';
import { api } from '../../api/person';
import PersonArchiveConfirm from './PersonArchiveConfirm';
import PersonCreate from './PersonCreate';
import PersonDetails from './PersonDetails';
import PersonEdit from './PersonEdit';
import PersonList from './PersonList';
import PersonIntelligence from '../workspace/PersonIntelligence';
import './PersonList.css';

export type PersonView = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'intelligence';

export interface Person {
  id: string;
  tenantId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  profilePhoto: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  employmentType: string;
  employmentStatus: string;
  joiningDate: string | null;
  departmentId: string | null;
  managerId: string | null;
  designation: string | null;
  location: string | null;
  reportingManagerId: string | null;
  orgId: string;
  status: string;
  createdBy: string;
  createdDate: string;
  updatedDate: string;
}

export interface PersonDepartment {
  id: string;
  name: string;
  status?: string;
}

export default function PersonApp({ organization, onBack }: { organization: Organization; onBack: () => void }) {
  const [view, setView] = useState<PersonView>('list');
  const [selected, setSelected] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<PersonDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [peopleData, departmentData] = await Promise.all([
        api.listPeople(organization.tenantId, organization.id),
        departmentApi.listDepartments(organization.tenantId, organization.id),
      ]);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
      setDepartments(Array.isArray(departmentData) ? departmentData : []);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load people.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organization.tenantId, organization.id]);

  const navigate = (next: PersonView, person?: Person) => {
    setSelected(person ?? null);
    setView(next);
  };

  return (
    <div className="people-app">
      <header className="people-app-header">
        <div>
          <button className="eb-pill-btn" onClick={onBack}>Back to Organizations</button>
          <h1>People Intelligence</h1>
          <p>{organization.name}</p>
        </div>
        {view === 'list' && <button onClick={() => navigate('create')}>+ New Person</button>}
      </header>

      {error && <div className="people-alert" role="alert">{error}</div>}

      {view === 'list' && (
        <PersonList
          people={people}
          departments={departments}
          loading={loading}
          tenantId={organization.tenantId}
          onSelect={(person) => navigate('intelligence', person)}
          onEdit={(person) => navigate('edit', person)}
          onArchive={(person) => navigate('archive', person)}
          onRefresh={load}
        />
      )}

      {view === 'intelligence' && selected && (
        <div>
          <div className="people-inline-actions">
            <button className="eb-pill-btn" onClick={() => navigate('details', selected)}>Raw Details</button>
            <button className="eb-pill-btn" onClick={() => navigate('edit', selected)}>Edit</button>
            <button className="eb-pill-btn" onClick={() => navigate('archive', selected)}>Archive</button>
          </div>
          <PersonIntelligence tenantId={organization.tenantId} personId={selected.id} onBack={() => navigate('list')} />
        </div>
      )}

      {view === 'create' && (
        <PersonCreate
          tenantId={organization.tenantId}
          orgId={organization.id}
          onCreated={(person: any) => {
            navigate('list');
            load();
            if (person.tempPassword) {
              alert('Person created. Temporary password: ' + person.tempPassword + '\n\nThis is a randomly generated placeholder. Use the ERP password-reset flow before relying on it to log in.');
            }
          }}
          onCancel={() => navigate('list')}
        />
      )}

      {view === 'edit' && selected && (
        <PersonEdit
          person={selected}
          onUpdated={(person) => { navigate('details', person); load(); }}
          onCancel={() => navigate('details', selected)}
        />
      )}

      {view === 'details' && selected && (
        <PersonDetails
          person={selected}
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onBack={() => navigate('list')}
          onViewTwin={() => navigate('intelligence', selected)}
        />
      )}

      {view === 'archive' && selected && (
        <PersonArchiveConfirm
          person={selected}
          onArchived={() => { navigate('list'); load(); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
    </div>
  );
}
