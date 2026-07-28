import { useState, useEffect } from 'react';
import type { Organization } from '../../App';
import PersonList from './PersonList';
import PersonCreate from './PersonCreate';
import PersonEdit from './PersonEdit';
import PersonDetails from './PersonDetails';
import PersonArchiveConfirm from './PersonArchiveConfirm';
import PersonIntelligence from '../workspace/PersonIntelligence';
import { api } from '../../api/person';

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

export default function PersonApp({ organization, onBack }: { organization: Organization; onBack: () => void }) {
  const [view, setView] = useState<PersonView>('list');
  const [selected, setSelected] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPeople(organization.tenantId, organization.id);
      setPeople(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [organization.tenantId, organization.id]);

  const navigate = (v: PersonView, person?: Person) => {
    setSelected(person ?? null);
    setView(v);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button onClick={onBack}>← Back to Organizations</button>
          <h1 style={{ display: 'inline', marginLeft: 12 }}>People — {organization.name}</h1>
        </div>
        <button onClick={() => navigate('create')}>+ New Person</button>
      </header>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {view === 'list' && (
        <PersonList
          people={people}
          loading={loading}
          tenantId={organization.tenantId}
          onSelect={(person) => navigate('intelligence', person)}
          onEdit={(person) => navigate('edit', person)}
          onArchive={(person) => navigate('archive', person)}
        />
      )}
      {view === 'intelligence' && selected && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: -4, justifyContent: 'flex-end' }}>
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
            setPeople([person, ...people]);
            navigate('list');
            if (person.tempPassword) {
              alert('Person created. Temporary password: ' + person.tempPassword + '\n\nThis is a randomly generated placeholder \u2014 it may not match this ERP\'s real login hashing scheme. Use the ERP\'s own password-reset flow before relying on it to log in.');
            }
          }}
          onCancel={() => navigate('list')}
        />
      )}
      {view === 'edit' && selected && (
        <PersonEdit
          person={selected}
          onUpdated={(person) => { setPeople(people.map((p) => p.id === person.id ? person : p)); navigate('details', person); }}
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
          onArchived={(person) => { setPeople(people.map((p) => p.id === person.id ? person : p)); navigate('list'); }}
          onCancel={() => navigate('details', selected)}
        />
      )}
    </div>
  );
}
