import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PersonApp from '../src/components/person/PersonApp';
import DepartmentApp from '../src/components/department/DepartmentApp';
import AIAssistant from '../src/components/workspace/AIAssistant';
import { screenObject, contextPayload, sameScreenObject } from '../src/utils/screenContext';

/**
 * The object on screen has to reach the AI Assistant, and the WRONG object must
 * never reach it.
 *
 * The defect these lock out: the Assistant received only a tenantId, so a
 * conversation opened from a person's profile could not say who it was about.
 * The fix threads the selection each screen already owns up to the shell and
 * down into the Assistant.
 *
 * WHAT IS BEING ASSERTED IS THE REPORT, NOT THE RENDER. Each screen reports
 * `{screen, objectId, objectType}` upward; the server then re-resolves that
 * object against its own tenant, so these values are hints and nothing here
 * asserts anything about authorization. The assertions that matter most are the
 * ones about staleness: a report that lingers after the reader has moved on is
 * worse than no report, because a conversation would then claim a subject the
 * reader never chose.
 *
 * THE ENTITY NAMES ARE THE BACKEND'S. 'OrganizationUnit' for a department is
 * what ScreenRegistry and EntityResolver call it — not 'Department', which is
 * the word the UI uses and which the resolver has no mapping for.
 */

// ---- Person screen -------------------------------------------------------

const getSummary = vi.fn();
const listDepartments = vi.fn();
const listPeople = vi.fn();
const listPeoplePage = vi.fn();

vi.mock('../src/api/department', () => ({
  api: {
    getSummary: (...args: unknown[]) => getSummary(...args),
    listDepartments: (...args: unknown[]) => listDepartments(...args),
  },
}));

vi.mock('../src/api/person', () => ({
  api: {
    listPeople: (...args: unknown[]) => listPeople(...args),
    listPeoplePage: (...args: unknown[]) => listPeoplePage(...args),
  },
}));

/*
  The list bodies are stubs that expose one button per row, because what these
  tests drive is SELECTION — which person is open — and the real tables'
  filtering, sorting and paging are covered by their own suites.
*/
vi.mock('../src/components/person/PersonList', () => ({
  default: ({ people, onSelect }: { people: any[]; onSelect: (p: any) => void }) => (
    <div data-testid="staff-list">
      {people.map((p) => (
        <button key={p.id} type="button" onClick={() => onSelect(p)}>open {p.id}</button>
      ))}
    </div>
  ),
}));
vi.mock('../src/components/student/StudentList', () => ({
  default: ({ onSelect }: { onSelect: (s: any) => void }) => (
    <button type="button" onClick={() => onSelect({ id: '7001' })}>open student</button>
  ),
}));
vi.mock('../src/components/student/StudentDetail', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <button type="button" onClick={onBack}>back from student</button>
  ),
}));
vi.mock('../src/components/workspace/PersonIntelligence', () => ({
  default: ({ personId, onBack }: { personId: string; onBack: () => void }) => (
    <div data-testid="person-profile">
      profile {personId}
      <button type="button" onClick={onBack}>back to people</button>
    </div>
  ),
}));
vi.mock('../src/components/person/PersonCreate', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonEdit', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonDetails', () => ({ default: () => <div /> }));
vi.mock('../src/components/person/PersonArchiveConfirm', () => ({ default: () => <div /> }));

// ---- Department screen ---------------------------------------------------

vi.mock('../src/components/department/DepartmentList', () => ({
  default: ({ departments, onSelect }: { departments: any[]; onSelect: (d: any) => void }) => (
    <div data-testid="department-list">
      {departments.map((d) => (
        <button key={d.id} type="button" onClick={() => onSelect(d)}>open dept {d.id}</button>
      ))}
    </div>
  ),
}));
vi.mock('../src/components/department/intelligence/DepartmentIntelligenceScreen', () => ({
  default: ({ departmentId, onOpenPerson, onBack }: { departmentId: string; onOpenPerson: (id: string) => void; onBack: () => void }) => (
    <div data-testid="department-profile">
      dept {departmentId}
      <button type="button" onClick={() => onOpenPerson('1608')}>open member</button>
      <button type="button" onClick={onBack}>back to departments</button>
    </div>
  ),
}));
vi.mock('../src/components/department/DepartmentCreate', () => ({ default: () => <div /> }));
vi.mock('../src/components/department/DepartmentEdit', () => ({ default: () => <div /> }));
vi.mock('../src/components/department/DepartmentDetails', () => ({ default: () => <div /> }));
vi.mock('../src/components/department/DepartmentArchiveConfirm', () => ({ default: () => <div /> }));

// ---- Assistant -----------------------------------------------------------

const createSession = vi.fn();
const listSessions = vi.fn();
const getMessages = vi.fn();
const listPromptTemplates = vi.fn();

vi.mock('../src/api/conversation', () => ({
  conversationApi: {
    createSession: (...args: unknown[]) => createSession(...args),
    listSessions: (...args: unknown[]) => listSessions(...args),
    searchSessions: vi.fn().mockResolvedValue([]),
    getMessages: (...args: unknown[]) => getMessages(...args),
    listPromptTemplates: (...args: unknown[]) => listPromptTemplates(...args),
    sendMessage: vi.fn(),
    setPinned: vi.fn(),
    rename: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

const businessSearch = vi.fn();

vi.mock('../src/api/intelligence', () => ({ api: { search: (...a: unknown[]) => businessSearch(...a) } }));
vi.mock('../src/api/graph', () => ({ graphApi: { search: vi.fn().mockResolvedValue({ results: [] }) } }));
vi.mock('../src/api/ai', () => ({
  aiApi: {
    providers: vi.fn().mockResolvedValue({ providers: [] }),
    executions: vi.fn().mockResolvedValue([]),
  },
}));

const organization = { id: '1000018', tenantId: '1000018', name: 'Fiber Valley' } as any;

const summary = (staff: number, students: number) => ({
  people: { total: staff },
  students: { total: students },
});

const staff = [{ id: '1608' }, { id: '1609' }];

beforeEach(() => {
  vi.clearAllMocks();
  getSummary.mockResolvedValue(summary(2, 0));
  listDepartments.mockResolvedValue([{ id: '2050', name: 'Sales' }, { id: '2051', name: 'Support' }]);
  listPeople.mockResolvedValue(staff);
  listPeoplePage.mockImplementation(async () => {
    const rows = await listPeople();
    return { people: rows, total: rows.length, page: 1, perPage: 100, pages: 1 };
  });

  businessSearch.mockResolvedValue({ results: [] });
  listSessions.mockResolvedValue([]);
  getMessages.mockResolvedValue([]);
  listPromptTemplates.mockResolvedValue([]);
  createSession.mockResolvedValue({ id: 'session-1', title: 'Context conversation', pinned: false });
});

/** The last value a screen reported, which is what the shell would be holding. */
const lastReport = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.length === 0 ? undefined : spy.mock.calls[spy.mock.calls.length - 1][0];

// =========================================================================

describe('screenContext helpers', () => {
  it('derives the entity type from the screen, so the pair cannot be mismatched', () => {
    expect(screenObject('person-profile', 1608)).toEqual({
      screen: 'person-profile', objectId: '1608', objectType: 'Person',
    });

    // The backend's name for a department, not the UI's.
    expect(screenObject('department-profile', '2050')).toEqual({
      screen: 'department-profile', objectId: '2050', objectType: 'OrganizationUnit',
    });

    expect(screenObject('student-profile', '7001')?.objectType).toBe('Student');
  });

  it('treats an absent or blank id as no object at all', () => {
    expect(screenObject('person-profile', null)).toBeNull();
    expect(screenObject('person-profile', undefined)).toBeNull();
    expect(screenObject('person-profile', '   ')).toBeNull();
  });

  it('sends nothing at all when there is no object, so the old request shape is unchanged', () => {
    expect(contextPayload(null)).toEqual({});
    expect(contextPayload(undefined)).toEqual({});
  });

  /**
   * Ids collide across entities in this system — department 2050 and person
   * 2050 are both real rows in the live Fiber Valley tenant. An id-only
   * comparison would call that "no change".
   */
  it('does not confuse two different entities that share an id', () => {
    expect(sameScreenObject(
      screenObject('person-profile', '2050'),
      screenObject('department-profile', '2050'),
    )).toBe(false);
  });
});

describe('Person screen reports its object', () => {
  it('reports the person whose profile is open', async () => {
    const onObjectChange = vi.fn();

    render(<PersonApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    await screen.findByTestId('staff-list');
    // On the list there is no single subject.
    expect(lastReport(onObjectChange)).toBeNull();

    fireEvent.click(screen.getByText('open 1608'));

    await screen.findByTestId('person-profile');
    await waitFor(() => expect(lastReport(onObjectChange)).toEqual({
      screen: 'person-profile', objectId: '1608', objectType: 'Person',
    }));
  });

  /** Person A → Person B. The report must move with the reader. */
  it('updates the report when the reader moves to a different person', async () => {
    const onObjectChange = vi.fn();

    render(<PersonApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    await screen.findByTestId('staff-list');
    fireEvent.click(screen.getByText('open 1608'));
    await waitFor(() => expect(lastReport(onObjectChange)?.objectId).toBe('1608'));

    // Back to the roster, then open someone else — the path a reader takes.
    fireEvent.click(screen.getByText('back to people'));
    await waitFor(() => expect(lastReport(onObjectChange)).toBeNull());

    fireEvent.click(screen.getByText('open 1609'));
    await waitFor(() => expect(lastReport(onObjectChange)).toEqual({
      screen: 'person-profile', objectId: '1609', objectType: 'Person',
    }));

    // And 1608 is not what the shell is holding any more.
    expect(lastReport(onObjectChange)?.objectId).not.toBe('1608');
  });

  it('reports no object while the roster is showing', async () => {
    const onObjectChange = vi.fn();

    render(<PersonApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    await screen.findByTestId('staff-list');
    fireEvent.click(screen.getByText('open 1608'));
    await waitFor(() => expect(lastReport(onObjectChange)?.objectId).toBe('1608'));

    fireEvent.click(screen.getByText('back to people'));

    // Null, not a lingering 1608. This is the stale case, inside one screen.
    await waitFor(() => expect(lastReport(onObjectChange)).toBeNull());
  });

  /** A student is a Student, not a Person — they have no ERP person row. */
  it('reports a student as Student, using the student screen', async () => {
    getSummary.mockResolvedValue(summary(2, 5000));
    const onObjectChange = vi.fn();

    render(<PersonApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    fireEvent.click(await screen.findByText('open student'));

    await waitFor(() => expect(lastReport(onObjectChange)).toEqual({
      screen: 'student-profile', objectId: '7001', objectType: 'Student',
    }));

    fireEvent.click(screen.getByText('back from student'));
    await waitFor(() => expect(lastReport(onObjectChange)).toBeNull());
  });

  it('works unchanged for callers that do not ask for context', async () => {
    render(<PersonApp organization={organization} onBack={() => {}} />);

    await screen.findByTestId('staff-list');
    fireEvent.click(screen.getByText('open 1608'));

    // No onObjectChange, no crash, same screen as before.
    expect(await screen.findByTestId('person-profile')).toBeTruthy();
  });
});

describe('Department screen reports its object', () => {
  it('reports the department whose profile is open, by its universal entity name', async () => {
    const onObjectChange = vi.fn();

    render(<DepartmentApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    await screen.findByTestId('department-list');
    expect(lastReport(onObjectChange)).toBeNull();

    fireEvent.click(screen.getByText('open dept 2050'));

    await screen.findByTestId('department-profile');
    await waitFor(() => expect(lastReport(onObjectChange)).toEqual({
      screen: 'department-profile', objectId: '2050', objectType: 'OrganizationUnit',
    }));
  });

  /**
   * DEPARTMENT → PERSON, WITHIN THE DEPARTMENTS SCREEN. Opening a member goes
   * through setViewingPersonId and never through navigate(), so a report wired
   * into navigation alone would still be naming the department while the reader
   * is looking at a person.
   */
  it('switches the report to the person when a member is opened from a department', async () => {
    const onObjectChange = vi.fn();

    render(<DepartmentApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    fireEvent.click(await screen.findByText('open dept 2050'));
    await waitFor(() => expect(lastReport(onObjectChange)?.objectType).toBe('OrganizationUnit'));

    fireEvent.click(screen.getByText('open member'));

    await waitFor(() => expect(lastReport(onObjectChange)).toEqual({
      screen: 'person-profile', objectId: '1608', objectType: 'Person',
    }));
  });

  it('reports no object when the reader returns to the department list', async () => {
    const onObjectChange = vi.fn();

    render(<DepartmentApp organization={organization} onBack={() => {}} onObjectChange={onObjectChange} />);

    fireEvent.click(await screen.findByText('open dept 2050'));
    await waitFor(() => expect(lastReport(onObjectChange)?.objectId).toBe('2050'));

    fireEvent.click(screen.getByText('back to departments'));

    await waitFor(() => expect(lastReport(onObjectChange)).toBeNull());
  });
});

describe('AI Assistant carries the context into a conversation', () => {
  const openAssistantAndCreate = async (context: any) => {
    render(<AIAssistant tenantId="1000018" context={context} />);

    /*
      The Assistant's own existing control, in its Scoped Conversation tab.
      Reached through the tab because that is the path a reader takes, and
      because the button being ENABLED there without a search result is half of
      what this integration had to fix.
    */
    fireEvent.click(await screen.findByRole('button', { name: /scoped conversation/i }));

    const button = await screen.findByRole('button', { name: /new context conversation/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(createSession).toHaveBeenCalled());

    return createSession.mock.calls[0][0];
  };

  it('sends screen, objectId and objectType for a person', async () => {
    const body = await openAssistantAndCreate(screenObject('person-profile', '1608'));

    expect(body).toMatchObject({
      tenantId: '1000018',
      screen: 'person-profile',
      objectId: '1608',
      objectType: 'Person',
    });
  });

  it('sends the universal entity name for a department', async () => {
    const body = await openAssistantAndCreate(screenObject('department-profile', '2050'));

    expect(body).toMatchObject({
      screen: 'department-profile',
      objectId: '2050',
      objectType: 'OrganizationUnit',
    });
  });

  /**
   * EXISTING BEHAVIOUR IS UNCHANGED WITH NO CONTEXT AND NO SEARCH RESULT.
   *
   * The control stays disabled, exactly as it was before any of this existed: a
   * conversation on this screen has always needed a subject, and "opened from
   * the home screen with nothing selected" does not supply one. Screen context
   * ADDS a second way to satisfy that requirement; it does not remove it.
   */
  it('leaves the conversation control disabled when there is no subject at all', async () => {
    render(<AIAssistant tenantId="1000018" context={null} />);

    fireEvent.click(await screen.findByRole('button', { name: /scoped conversation/i }));

    const button = await screen.findByRole('button', { name: /new context conversation/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(createSession).not.toHaveBeenCalled();
  });

  /**
   * A result searched for HERE, with no screen context: the request carries no
   * context fields, so the body is byte-identical to the one this app sent
   * before screen context existed.
   */
  it('sends no context fields when the subject came from a search rather than a screen', async () => {
    businessSearch.mockResolvedValue({
      results: [{ entityType: 'Signal', id: 'sig-1', headline: 'A signal', record: {} }],
    });

    render(<AIAssistant tenantId="1000018" context={null} />);

    const input = await screen.findByPlaceholderText(/find the screen object/i);
    fireEvent.change(input, { target: { value: 'signal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    // No click on the result: search() auto-selects the first hit
    // (AIAssistant line 175), which is the screen's existing behaviour.
    await screen.findByText('ID: sig-1');

    fireEvent.click(screen.getByRole('button', { name: /scoped conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new context conversation/i }));

    await waitFor(() => expect(createSession).toHaveBeenCalled());

    const body = createSession.mock.calls[0][0];

    expect(body).toEqual({ tenantId: '1000018', title: 'Context: Signal sig-1' });
    expect(body).not.toHaveProperty('screen');
    expect(body).not.toHaveProperty('objectId');
    expect(body).not.toHaveProperty('objectType');
  });

  it('names the object in the conversation title when there is one', async () => {
    const body = await openAssistantAndCreate(screenObject('person-profile', '1608'));

    expect(body.title).toBe('Context: Person 1608');
  });

  it('states what it was opened over, and says nothing when it was opened over nothing', async () => {
    const { unmount } = render(<AIAssistant tenantId="1000018" context={screenObject('person-profile', '1608')} />);

    const banner = await screen.findByTestId('assistant-screen-context');
    expect(banner.textContent).toContain('Person 1608');

    unmount();

    render(<AIAssistant tenantId="1000018" context={null} />);
    await screen.findByRole('button', { name: /context search/i });
    expect(screen.queryByTestId('assistant-screen-context')).toBeNull();
  });
});
