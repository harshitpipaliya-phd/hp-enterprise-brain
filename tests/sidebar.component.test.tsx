import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar, breadcrumbFor } from '../src/components/Sidebar';

/**
 * userRole IS REQUIRED AND MUST BE PASSED DELIBERATELY.
 *
 * Sidebar filters its items by role. These cases used to omit the prop, which
 * did not fail loudly — it fell through to the 'member' branch, where the only
 * visible items are Command Center and Settings. Every assertion about
 * Organizations, Signals or Executive Dashboard then failed with "unable to
 * find element", which reads like a rendering bug rather than a role that
 * cannot see those screens.
 *
 * The cases below state the role they are exercising, so a future change to the
 * role matrix fails here with a diagnosis instead of a mystery.
 */
describe('Sidebar component', () => {
  it('renders navigation items grouped by section', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={false} userRole="admin" onNavigate={() => {}} onLogout={() => {}} />);
    expect(screen.getByText('Organizations')).toBeTruthy();
    expect(screen.getByText('Foundation')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('disables org-scoped items when no organization is selected', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={false} userRole="admin" onNavigate={() => {}} onLogout={() => {}} />);
    const signalsButton = screen.getByText('Signals').closest('button') as HTMLButtonElement;
    expect(signalsButton.disabled).toBe(true);
  });

  it('enables org-scoped items once an organization is selected', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={true} userRole="admin" onNavigate={() => {}} onLogout={() => {}} />);
    const signalsButton = screen.getByText('Signals').closest('button') as HTMLButtonElement;
    expect(signalsButton.disabled).toBe(false);
  });

  it('calls onNavigate with the correct view when an enabled item is clicked', () => {
    let navigatedTo: string | null = null;
    render(<Sidebar currentView="list" hasSelectedOrg={true} userRole="admin" onNavigate={(v) => { navigatedTo = v; }} onLogout={() => {}} />);
    fireEvent.click(screen.getByText('Executive Dashboard'));
    expect(navigatedTo).toBe('executive');
  });

  it('does not navigate when a disabled (org-required) item is clicked without an org selected', () => {
    let navigatedTo: string | null = null;
    render(<Sidebar currentView="list" hasSelectedOrg={false} userRole="admin" onNavigate={(v) => { navigatedTo = v; }} onLogout={() => {}} />);
    fireEvent.click(screen.getByText('Signals'));
    expect(navigatedTo).toBe(null);
  });

  it('calls onLogout when the logout button is clicked', () => {
    let loggedOut = false;
    render(<Sidebar currentView="list" hasSelectedOrg={false} userRole="admin" onNavigate={() => {}} onLogout={() => { loggedOut = true; }} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(loggedOut).toBe(true);
  });

  /**
   * The role filter is the point of the prop, so one case has to prove it does
   * something. Without this, passing userRole="admin" everywhere above would
   * make the filter untested rather than tested.
   */
  it('hides items the role cannot reach', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={true} userRole="member" onNavigate={() => {}} onLogout={() => {}} />);
    expect(screen.queryByText('Signals')).toBeNull();
    expect(screen.queryByText('Organizations')).toBeNull();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  /**
   * Home is Command Center, and every role can reach it.
   *
   * The landing view is 'home'. When the nav entry for it was keyed to
   * 'commandcenter' instead, no role allow-list contained 'home', so the one
   * screen every user lands on was absent from the menu for all of them.
   */
  it.each(['admin', 'tenant_admin', 'manager', 'analyst', 'viewer', 'member'])(
    'offers Command Center to the %s role',
    (role) => {
      render(<Sidebar currentView="home" hasSelectedOrg={true} userRole={role} onNavigate={() => {}} onLogout={() => {}} />);
      expect(screen.getByText('Command Center')).toBeTruthy();
    },
  );

  it('navigates Command Center to the home view', () => {
    let navigatedTo: string | null = null;
    render(<Sidebar currentView="list" hasSelectedOrg={true} userRole="admin" onNavigate={(v) => { navigatedTo = v; }} onLogout={() => {}} />);
    fireEvent.click(screen.getByText('Command Center'));
    expect(navigatedTo).toBe('home');
  });

  it('marks Command Center active on the landing view', () => {
    render(<Sidebar currentView="home" hasSelectedOrg={true} userRole="admin" onNavigate={() => {}} onLogout={() => {}} />);
    const button = screen.getByText('Command Center').closest('button') as HTMLButtonElement;
    expect(button.className).toContain('active');
  });
});

/**
 * The breadcrumb reads the same nav table, so a view missing from it produced
 * the raw view name: the landing screen showed "Home / home".
 */
describe('breadcrumbFor', () => {
  it('names the landing view Command Center rather than "home"', () => {
    const trail = breadcrumbFor('home', 'Scholar Clone');

    expect(trail).toContain('Command Center');
    expect(trail).not.toContain('home');
  });

  it('includes the organization for an org-scoped view', () => {
    expect(breadcrumbFor('home', 'Scholar Clone')).toContain('Scholar Clone');
  });
});
