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
import { loadSession, saveSession } from '../../utils/session';
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

/**
 * Whether the stored person may still be reopened.
 *
 * Consumed on the first mount after the page loads, and never set true again —
 * so a refresh on someone's profile returns to it, while walking to People from
 * the sidebar gets the list. Without this, the two are indistinguishable from
 * inside the component, and every visit to People would silently reopen whoever
 * was looked at last.
 */
let restorePending = true;

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
      const rows: Person[] = Array.isArray(peopleData) ? peopleData : [];
      setPeople(rows);
      setDepartments(Array.isArray(departmentData) ? departmentData : []);
      return rows;
    } catch (e: any) {
      setError(e?.message ?? 'Could not load people.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reopen the person who was open before a refresh.
   *
   * This app has no router — the whole shell is driven by `view` state — so a
   * refresh on a person's profile used to land back on the People list. The
   * person's id is persisted alongside the view and the organization that
   * already survive a refresh, and is resolved against the list the API returns
   * for the CURRENT organization. That resolution is the point: it means a
   * stored id can only ever reopen someone this tenant can see, so a stale id
   * left over from another organization, or an archived person, or a value typed
   * into localStorage by hand, all fall through to the list rather than opening
   * a profile.
   */
  useEffect(() => {
    let cancelled = false;

    load().then((rows) => {
      // Checked AFTER the load resolves, and cleared only by the pass that
      // survives. StrictMode mounts, tears down and remounts every effect in
      // development, so a flag consumed at the top of the effect body would be
      // spent by the run that is then thrown away — the restore would work in
      // production and quietly not work while developing it.
      if (cancelled || !restorePending) return;
      restorePending = false;

      const storedId = loadSession().personId;
      if (!storedId) return;

      const match = rows.find((person) => String(person.id) === storedId);
      if (match) {
        setSelected(match);
        setView('intelligence');
      } else {
        saveSession({ personId: null });
      }
    });

    return () => { cancelled = true; };
  }, [organization.tenantId, organization.id]);

  const navigate = (next: PersonView, person?: Person) => {
    setSelected(person ?? null);
    setView(next);
    // Only the profile is worth restoring. Coming back from a refresh into a
    // half-filled edit form, or into an archive confirmation, would be worse
    // than coming back to the person.
    saveSession({ personId: next === 'list' || !person ? null : String(person.id) });
  };

  return (
    <div className="people-app">
      <header className="people-app-header">
        <div>
          <button className="eb-pill-btn" onClick={onBack}>Back to Organization</button>
          <h1>People</h1>
          <p>Everyone recorded in {organization.name}. Open a person to see their profile, department and recorded activity.</p>
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

      {/*
        The actions used to sit in a detached pill row above the profile, which
        put Archive one careless click from the top of the page and left the
        profile with a header that could not say what you could do with it. They
        are now the profile's own header actions, and each one is passed only
        when it leads somewhere real: Edit and Archive are backed by
        PATCH/POST /people/{tenant}/{id}, and the source record view is a screen
        that exists. Refresh is the profile's own and needs nothing from here.
      */}
      {view === 'intelligence' && selected && (
        <PersonIntelligence
          tenantId={organization.tenantId}
          personId={selected.id}
          onBack={() => navigate('list')}
          backLabel="Back to People"
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onViewSourceRecord={() => navigate('details', selected)}
        />
      )}

      {view === 'create' && (
        <PersonCreate
          tenantId={organization.tenantId}
          orgId={organization.id}
          organizationName={organization.name}
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

      {/*
        Edit, source record and archive all return to the profile rather than to
        the source-record screen. The profile is where the user came from, and
        landing them somewhere else after saving reads as the save having
        navigated them away from their work.
      */}
      {view === 'edit' && selected && (
        <PersonEdit
          person={selected}
          onUpdated={(person) => { navigate('intelligence', person); load(); }}
          onCancel={() => navigate('intelligence', selected)}
        />
      )}

      {view === 'details' && selected && (
        <PersonDetails
          person={selected}
          onEdit={() => navigate('edit', selected)}
          onArchive={() => navigate('archive', selected)}
          onBack={() => navigate('intelligence', selected)}
        />
      )}

      {view === 'archive' && selected && (
        <PersonArchiveConfirm
          person={selected}
          onArchived={() => { navigate('list'); load(); }}
          onCancel={() => navigate('intelligence', selected)}
        />
      )}
    </div>
  );
}
