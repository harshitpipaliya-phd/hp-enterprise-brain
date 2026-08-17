import { describe, it, expect, beforeEach } from 'vitest';
import { loadSession, saveSession, clearSession } from '../src/utils/session';

/**
 * What must survive a refresh.
 *
 * THE DEFECT THESE EXIST FOR. Only the access token was persisted. After a
 * refresh the app knew someone was signed in but not who: `userRole` came back
 * null, Sidebar's role filter has no null branch and falls through to 'member',
 * and the member allow-list is exactly two entries. An admin who pressed F5
 * watched their entire navigation collapse to "Command Center" and "Settings",
 * with a blank content pane behind it because every view is gated on a selected
 * organization that had not been restored yet either.
 *
 * Both halves are asserted here because they failed together and would regress
 * together.
 */
describe('session persistence', () => {
  beforeEach(() => localStorage.clear());

  const org = {
    id: '6',
    tenantId: '6',
    name: 'Scholar Clone',
    legalName: null,
    orgCode: '',
    industry: null,
    country: null,
    timezone: null,
    currency: null,
    logo: null,
    status: 'active',
    createdBy: '',
    createdDate: '',
    updatedDate: '',
  };

  it('returns an empty session when nothing has been stored', () => {
    expect(loadSession()).toEqual({ role: null, userName: null, organization: null, view: null, personId: null });
  });

  it('round-trips the role, so a refresh cannot silently demote the user', () => {
    saveSession({ role: 'admin' });

    expect(loadSession().role).toBe('admin');
  });

  it('round-trips the selected organization, so the first render is not blank', () => {
    saveSession({ organization: org });

    expect(loadSession().organization?.id).toBe('6');
    expect(loadSession().organization?.tenantId).toBe('6');
  });

  it('round-trips the current view, so a refresh stays on the same screen', () => {
    saveSession({ view: 'people' });

    expect(loadSession().view).toBe('people');
  });

  it('merges partial writes instead of replacing the whole session', () => {
    saveSession({ role: 'analyst', organization: org, view: 'signals' });
    // navigate() writes only organization+view; it must not wipe the role.
    saveSession({ view: 'people' });

    const s = loadSession();
    expect(s.role).toBe('analyst');
    expect(s.organization?.id).toBe('6');
    expect(s.view).toBe('people');
  });

  it('clears everything on sign-out', () => {
    saveSession({ role: 'admin', organization: org, view: 'people' });
    clearSession();

    expect(loadSession()).toEqual({ role: null, userName: null, organization: null, view: null, personId: null });
  });

  /**
   * A stored session outlives deploys, so a build that changes the shape will
   * read one written by the previous build. Throwing here would white-screen
   * the app on every load with no way for the user to recover — strictly worse
   * than forgetting the session.
   */
  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem('hpbrain-session', '{not json');

    expect(() => loadSession()).not.toThrow();
    expect(loadSession()).toEqual({ role: null, userName: null, organization: null, view: null, personId: null });
  });

  it('rejects a malformed organization instead of handing it to a component', () => {
    localStorage.setItem('hpbrain-session', JSON.stringify({ role: 'admin', organization: { name: 'no id' } }));

    const s = loadSession();
    expect(s.organization).toBeNull();
    // The valid part of the session is still usable.
    expect(s.role).toBe('admin');
  });

  it('rejects a non-string role', () => {
    localStorage.setItem('hpbrain-session', JSON.stringify({ role: 42 }));

    expect(loadSession().role).toBeNull();
  });

  it('round-trips the open person so a refresh returns to their profile', () => {
    saveSession({ personId: '592' });

    expect(loadSession().personId).toBe('592');
  });

  /**
   * An empty string would pass a truthiness check downstream in some shapes and
   * fail in others; normalising it to null here means PersonApp has one case to
   * handle rather than two.
   */
  it('treats a non-string or empty person id as no person', () => {
    localStorage.setItem('hpbrain-session', JSON.stringify({ personId: 592 }));
    expect(loadSession().personId).toBeNull();

    localStorage.setItem('hpbrain-session', JSON.stringify({ personId: '' }));
    expect(loadSession().personId).toBeNull();
  });
});
