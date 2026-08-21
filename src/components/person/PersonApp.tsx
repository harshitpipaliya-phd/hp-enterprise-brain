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
import StudentList from '../student/StudentList';
import StudentDetail from '../student/StudentDetail';
import type { Student } from '../../api/student';
import { loadSession, saveSession } from '../../utils/session';
import './PersonList.css';

export type PersonView = 'list' | 'create' | 'edit' | 'details' | 'archive' | 'intelligence';

/**
 * Which population this organization's People screen is showing.
 *
 *   'erp'      — the staff the HR system records: teachers, administrators,
 *                support staff, everyone with a row in the mapped Person table.
 *   'students' — the children the organization holds records for.
 *
 * BOTH ARE REACHABLE, AND THAT IS THE FIX. This used to be a decision the screen
 * made ONCE and never revisited: any student at all and the whole screen became
 * the student screen, with the staff list unreachable behind an early return. An
 * organization that has both — which every school does — could only ever see
 * one of them. A school's staff are not an alternative to its students; they are
 * the other half of the same question.
 *
 * WHICH ONE OPENS FIRST IS UNCHANGED. Students when the organization has any,
 * staff otherwise — the same rule as before, so an installation that was landing
 * on one of these still lands on it. The switcher only adds the door that was
 * missing.
 *
 * NO TENANT IS NAMED ANYWHERE IN THIS TREE. Both counts come from the server, so
 * an organization with staff and no students gets a staff screen, one with
 * students and no staff gets a student screen, and one with both gets the
 * switcher — decided per organization, by its own data.
 */
type Population = 'erp' | 'students';

/**
 * The two headline counts, from the SAME endpoint the Organization overview
 * reads.
 *
 * This matters more than it looks. `GET /departments/{tenant}/summary` is
 * FoundationCounts, the one place in the application that defines "how many
 * staff" and "how many students" — the class that exists precisely because
 * three screens once counted these two things three different ways and
 * disagreed. Taking the tab counts from anywhere else, including from the
 * length of the list this screen has loaded, would make a fourth definition and
 * reintroduce the exact defect that class was written to end. The number on the
 * Staff tab is therefore the number on the Organization card, always.
 */
interface PopulationCounts {
  staff: number;
  students: number;
}

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

export default function PersonApp({ organization, onBack, onExploreInGraph }: { organization: Organization; onBack: () => void; onExploreInGraph?: (label: string, id: string) => void }) {
  const [view, setView] = useState<PersonView>('list');
  const [selected, setSelected] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<PersonDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [population, setPopulation] = useState<Population | null>(null);
  const [counts, setCounts] = useState<PopulationCounts | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  /*
    One request per organization, before anything heavy: two COUNTs and a
    GROUP BY, no rows. It settles both the tab labels and which tab opens.

    A FAILED SUMMARY OPENS THE STAFF SCREEN, as it did before. The staff list has
    its own endpoint and its own error state, so the screen still works; falling
    back to the student view instead would strand an organization whose student
    projection is what failed.
  */
  useEffect(() => {
    let cancelled = false;
    setPopulation(null);
    setCounts(null);
    setStudent(null);

    departmentApi.getSummary(organization.tenantId)
      .then((summary: any) => {
        if (cancelled) return;
        const staff = Number(summary?.people?.total ?? 0);
        const students = Number(summary?.students?.total ?? 0);
        setCounts({ staff, students });
        setPopulation(students > 0 ? 'students' : 'erp');
      })
      .catch(() => {
        if (cancelled) return;
        setCounts(null);
        setPopulation('erp');
      });

    return () => { cancelled = true; };
  }, [organization.tenantId]);

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
        // A stored person is a STAFF profile, so the refresh has to land on the
        // staff side of the switcher. Without this the summary's default wins
        // and a school reopens on Students with the restored profile invisible
        // behind it — the person is selected, and nothing shows them.
        setPopulation('erp');
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

  /*
    THE SWITCHER IS OFFERED ONLY WHERE THERE IS A CHOICE.

    An organization with staff and no students, or students and no staff, gets
    exactly the single screen it got before — no tab bar, no empty second tab
    inviting a click that leads to "nothing here". The control appears when both
    populations exist, which is when its absence was the defect.

    It is rendered from `counts`, so its labels are the Organization overview's
    own numbers rather than the length of whatever this screen has loaded.
  */
  const showSwitcher = counts !== null && counts.staff > 0 && counts.students > 0;

  const switcher = showSwitcher ? (
    <div className="people-population" role="tablist" aria-label="Population">
      <button
        type="button"
        role="tab"
        aria-selected={population === 'students'}
        className={`eb-pill-btn${population === 'students' ? ' active' : ''}`}
        onClick={() => { setPopulation('students'); setStudent(null); }}
      >
        Students <span className="people-population-count">{counts!.students.toLocaleString()}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={population === 'erp'}
        className={`eb-pill-btn${population === 'erp' ? ' active' : ''}`}
        onClick={() => { setPopulation('erp'); navigate('list'); }}
      >
        Staff <span className="people-population-count">{counts!.staff.toLocaleString()}</span>
      </button>
    </div>
  ) : null;

  // The summary has not answered yet. Deciding early would flash the staff
  // screen at every school before swapping to students a moment later.
  if (population === null) {
    return (
      <div className="people-app">
        <header className="people-app-header">
          <div>
            <button className="eb-pill-btn" onClick={onBack}>Back to Organization</button>
            <h1>People</h1>
          </div>
        </header>
        <div className="people-empty">Loading {organization.name}&apos;s people…</div>
      </div>
    );
  }

  /*
    THE STUDENT BRANCH STILL RETURNS EARLY AND SHARES NOTHING BELOW IT.

    Not woven into the ERP screen's view machine on purpose: a student is not a
    Person, has no ERP row, and cannot be created, edited or archived from here.
    Rendering them through PersonList's create/edit/archive flows would offer
    four actions that would all fail. The two experiences stay separate, and the
    ERP path below is byte-for-byte the screen Sunrise already had — the switcher
    is the only thing added to either.
  */
  if (population === 'students') {
    return (
      <div className="people-app">
        <header className="people-app-header">
          <div>
            <button className="eb-pill-btn" onClick={onBack}>Back to Organization</button>
            <h1>Students</h1>
            <p>
              The students {organization.name} has records for — their class, section and, where this
              organization has them, their results and fee history.
            </p>
            {switcher}
          </div>
        </header>

        {student
          ? (
            <StudentDetail
              tenantId={organization.tenantId}
              studentId={student.id}
              onBack={() => setStudent(null)}
              onExploreInGraph={onExploreInGraph}
            />
          )
          : <StudentList tenantId={organization.tenantId} onSelect={setStudent} />}
      </div>
    );
  }

  return (
    <div className="people-app">
      <header className="people-app-header">
        <div>
          <button className="eb-pill-btn" onClick={onBack}>Back to Organization</button>
          <h1>{showSwitcher ? 'Staff' : 'People'}</h1>
          <p>
            {showSwitcher
              ? `The staff ${organization.name} employs — teachers, administrators and support staff, as its HR system records them. Open someone to see their profile, department and recorded activity.`
              : `Everyone recorded in ${organization.name}. Open a person to see their profile, department and recorded activity.`}
          </p>
          {switcher}
        </div>
        {view === 'list' && <button onClick={() => navigate('create')}>+ New Person</button>}
      </header>

      {error && <div className="people-alert" role="alert">{error}</div>}

      {/*
        An organization whose HR system holds nobody is a real state, not a
        failure — a school that has entered its children but not yet its staff.
        Said plainly, and only once the load has actually finished, so it cannot
        be mistaken for the list still arriving.
      */}
      {view === 'list' && !loading && !error && people.length === 0 && (
        <div className="people-empty">No staff records found for this organization.</div>
      )}

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
          onExploreInGraph={onExploreInGraph}
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
