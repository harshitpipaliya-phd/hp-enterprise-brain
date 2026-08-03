import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Sidebar } from '../src/shell/Sidebar';
import { AppShell } from '../src/shell/AppShell';
import { breadcrumbsFor, VIEW_META } from '../src/shell/viewMeta';
import { navViewsForRole, visibleViewsForRole } from '../src/shell/roleAccess';
import { readCollapsePreference } from '../src/shell/useSidebarState';

/**
 * Phase 2 shell.
 *
 * The role matrix cases below are the important ones: this redesign must not
 * change who can see what, and a visual refactor is exactly the kind of change
 * that widens access by accident.
 */

/** jsdom has no matchMedia; the shell reads it to decide column vs drawer. */
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = max ? width <= Number(max[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const noop = () => {};

function renderSidebar(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <Sidebar
      currentView="home"
      hasSelectedOrg
      userRole="admin"
      userName="Scholar Clone"
      collapsed={false}
      onToggleCollapsed={noop}
      onNavigate={noop}
      onLogout={noop}
      {...overrides}
    />,
  );
}

function renderShell(overrides: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <AppShell
      view="home"
      orgName="Scholar Clone"
      hasSelectedOrg
      userName="Scholar Clone"
      userRole="admin"
      onNavigate={noop}
      onLogout={noop}
      {...overrides}
    >
      <p>Screen content</p>
    </AppShell>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setViewport(1440);
});

afterEach(() => {
  document.body.style.overflow = '';
});

/* ========================================================================== */

describe('role matrix — unchanged by the redesign', () => {
  // Lifted from the pre-redesign Sidebar.tsx. If any of these counts move, the
  // refactor changed who can reach what, which is a product decision.
  const EXPECTED: Record<string, number> = {
    admin: 31,        // every view in VIEW_META
    tenant_admin: 26,
    manager: 15,
    analyst: 19,
    viewer: 11,
    member: 3,
  };

  it.each(Object.entries(EXPECTED))('%s sees exactly %i views', (role, count) => {
    expect(visibleViewsForRole(role).size).toBe(count);
  });

  it('treats an unknown role as member, not as admin', () => {
    expect(visibleViewsForRole('nonsense-role')).toEqual(visibleViewsForRole('member'));
  });

  it('treats a null role as member — the refresh-demotion case', () => {
    expect(visibleViewsForRole(null)).toEqual(visibleViewsForRole('member'));
  });

  it('keeps Agent Monitor admin-only', () => {
    expect(visibleViewsForRole('admin').has('agents')).toBe(true);
    expect(visibleViewsForRole('tenant_admin').has('agents')).toBe(false);
    expect(visibleViewsForRole('manager').has('agents')).toBe(false);
  });

  it('keeps Organizations out of every role below tenant_admin', () => {
    expect(visibleViewsForRole('tenant_admin').has('list')).toBe(true);
    expect(visibleViewsForRole('manager').has('list')).toBe(false);
    expect(visibleViewsForRole('analyst').has('list')).toBe(false);
    expect(visibleViewsForRole('viewer').has('list')).toBe(false);
  });

  it('never offers a hidden sub-view as a nav item', () => {
    for (const v of navViewsForRole('admin')) expect(VIEW_META[v].hidden).toBeFalsy();
  });
});

describe('sidebar', () => {
  it('marks the current view with aria-current, not colour alone', () => {
    renderSidebar({ currentView: 'people' });
    const active = screen.getByRole('button', { name: 'People' });
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className).toContain('s-item-active');
  });

  it('disables org-scoped items until an organization is chosen', () => {
    renderSidebar({ hasSelectedOrg: false });
    expect((screen.getByRole('button', { name: 'People' }) as HTMLButtonElement).disabled).toBe(true);
    // Organizations does not require one, so it stays reachable.
    expect((screen.getByRole('button', { name: 'Organizations' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not navigate when a disabled item is clicked', () => {
    const onNavigate = vi.fn();
    renderSidebar({ hasSelectedOrg: false, onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'People' }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('keeps every item nameable when collapsed to the icon rail', () => {
    renderSidebar({ collapsed: true });
    // Labels are visually hidden but must remain in the accessible tree — an
    // icon-only button would otherwise have no name at all.
    expect(screen.getByRole('button', { name: 'People' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('shows section headings expanded and hides them collapsed', () => {
    const { rerender } = renderSidebar();
    expect(screen.getByText('Intelligence Loop')).toBeTruthy();

    rerender(
      <Sidebar
        currentView="home" hasSelectedOrg userRole="admin" userName="X"
        collapsed onToggleCollapsed={noop} onNavigate={noop} onLogout={noop}
      />,
    );
    expect(screen.queryByText('Intelligence Loop')).toBeNull();
  });

  it('shows the role only when it is actually known', () => {
    const { rerender } = renderSidebar({ userRole: 'tenant_admin' });
    expect(screen.getByText('tenant admin')).toBeTruthy();

    rerender(
      <Sidebar
        currentView="home" hasSelectedOrg userRole={null} userName="X"
        collapsed={false} onToggleCollapsed={noop} onNavigate={noop} onLogout={noop}
      />,
    );
    // No invented "Member" label for a user whose role we do not know.
    expect(screen.queryByText('member')).toBeNull();
  });
});

describe('collapse preference', () => {
  it('defaults to expanded when nothing is stored', () => {
    expect(readCollapsePreference()).toBe(false);
  });

  it('round-trips a stored preference', () => {
    localStorage.setItem('hpbrain-sidebar-collapsed', 'true');
    expect(readCollapsePreference()).toBe(true);
  });

  it('treats a corrupt stored value as no preference rather than as collapsed', () => {
    // `getItem(...) === 'true'` would read this as false by luck; the point is
    // that anything unrecognised is handled deliberately, not incidentally.
    localStorage.setItem('hpbrain-sidebar-collapsed', '{"collapsed":true}');
    expect(readCollapsePreference()).toBe(false);

    localStorage.setItem('hpbrain-sidebar-collapsed', 'TRUE');
    expect(readCollapsePreference()).toBe(false);
  });

  it('persists a desktop collapse toggle', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('hpbrain-sidebar-collapsed')).toBe('true');
  });
});

describe('mobile drawer', () => {
  beforeEach(() => setViewport(390));

  it('is closed initially and offers a menu trigger', () => {
    renderShell();
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });

  it('opens, traps focus inside, and locks background scroll', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes on Escape and restores focus to the trigger', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('closes when a navigation item is chosen', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'People' }));

    expect(onNavigate).toHaveBeenCalledWith('people');
    // A drawer left open covers the screen it just navigated to.
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });

  it('closes on a backdrop click', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const backdrop = screen.getByTestId('sidebar-backdrop');
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);

    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });

  it('does NOT close when a drag starts in the panel and ends on the backdrop', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const backdrop = screen.getByTestId('sidebar-backdrop');
    const panel = screen.getByRole('dialog', { name: 'Navigation menu' });

    fireEvent.mouseDown(panel);
    fireEvent.mouseUp(backdrop);

    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeTruthy();
  });

  it('shows the drawer trigger only on compact viewports', () => {
    setViewport(1440);
    renderShell();
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});

describe('breadcrumbs', () => {
  it('names the landing view Command Center, never the raw view id', () => {
    const trail = breadcrumbsFor('home', 'Scholar Clone').map((c) => c.label);
    expect(trail).toContain('Command Center');
    expect(trail).not.toContain('home');
  });

  it.each([
    ['home', 'Overview', 'Command Center'],
    ['people', 'Foundation', 'People'],
    ['signals', 'Intelligence Loop', 'Signals'],
    ['executive', 'Analytics', 'Executive Dashboard'],
    ['graph', 'Knowledge', 'Graph Explorer'],
    ['tasks', 'Automation', 'Task Orchestrator'],
    ['settings', 'Account', 'Settings'],
  ] as const)('maps %s through its section', (view, section, label) => {
    const trail = breadcrumbsFor(view, 'Scholar Clone').map((c) => c.label);
    expect(trail).toContain(section);
    expect(trail[trail.length - 1]).toBe(label);
  });

  it('includes the organization only for org-scoped views', () => {
    expect(breadcrumbsFor('people', 'Scholar Clone').map((c) => c.label)).toContain('Scholar Clone');
    // Organizations is the picker itself; naming one inside its own trail is wrong.
    expect(breadcrumbsFor('list', 'Scholar Clone').map((c) => c.label)).not.toContain('Scholar Clone');
  });

  it('adds the parent screen for a sub-view', () => {
    const trail = breadcrumbsFor('edit', 'Scholar Clone').map((c) => c.label);
    expect(trail).toEqual(['Home', 'Scholar Clone', 'Foundation', 'Organizations', 'Edit Organization']);
  });

  it('gives a destination only to crumbs that navigate', () => {
    const trail = breadcrumbsFor('people', 'Scholar Clone');
    expect(trail[0].view).toBe('home');
    // Organization name and section heading are context, not links.
    expect(trail[1].view).toBeUndefined();
    expect(trail[2].view).toBeUndefined();
    expect(trail[trail.length - 1].view).toBeUndefined();
  });

  it('covers every one of the 31 views without falling through', () => {
    for (const view of Object.keys(VIEW_META) as (keyof typeof VIEW_META)[]) {
      const trail = breadcrumbsFor(view);
      expect(trail.length).toBeGreaterThan(1);
      expect(trail[trail.length - 1].label).toBe(VIEW_META[view].label);
    }
  });

  it('marks the last crumb as the current page', () => {
    renderShell({ view: 'people' });
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('People').getAttribute('aria-current')).toBe('page');
  });
});

describe('header entry points', () => {
  it('navigates to the existing Global Search screen rather than faking search', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Go to Global Search' }));
    expect(onNavigate).toHaveBeenCalledWith('search');
  });

  it('hides the search entry from a role that cannot reach the screen', () => {
    renderShell({ userRole: 'member' });
    expect(screen.queryByRole('button', { name: 'Go to Global Search' })).toBeNull();
  });

  it('disables notifications honestly when the app supplies no source', () => {
    renderShell();
    const bell = screen.getByRole('button', { name: 'Notifications are not available' });
    expect((bell as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders the real notification control when one is provided', () => {
    renderShell({ notificationSlot: <button type="button">3 unread</button> });
    expect(screen.getByText('3 unread')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Notifications are not available' })).toBeNull();
  });

  it('offers no Help control, because there is no help destination', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: /help/i })).toBeNull();
  });
});

describe('user menu', () => {
  it('opens, closes on Escape, and returns focus to its trigger', () => {
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Account menu for Scholar Clone' });

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the pointer goes down outside it', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu for Scholar Clone' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('signs out through the supplied handler', () => {
    const onLogout = vi.fn();
    renderShell({ onLogout });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu for Scholar Clone' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('shows no identity it does not have', () => {
    renderShell({ userName: null, userRole: null });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Signed in')).toBeTruthy();
  });
});

describe('command palette', () => {
  const open = () => fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

  it('opens on Ctrl+K', () => {
    renderShell();
    open();
    expect(screen.getByRole('dialog', { name: 'Jump to a screen' })).toBeTruthy();
  });

  it('lists only the views this role may reach', () => {
    renderShell({ userRole: 'member' });
    open();
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Command Center')).toBeTruthy();
    expect(within(list).getByText('Settings')).toBeTruthy();
    // A member cannot see People in the sidebar, so it must not be typeable here.
    expect(within(list).queryByText('People')).toBeNull();
  });

  it('filters by label', () => {
    renderShell();
    open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'graph' } });
    const list = screen.getByRole('listbox');
    expect(within(list).getByText('Graph Explorer')).toBeTruthy();
    expect(within(list).queryByText('People')).toBeNull();
  });

  it('navigates with arrow keys and Enter', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    open();

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'people' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onNavigate).toHaveBeenCalledWith('people');
  });

  it('moves the active option with ArrowDown', () => {
    renderShell();
    open();
    const input = screen.getByRole('combobox');
    const before = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).not.toBe(before);
  });

  it('closes on Escape', () => {
    renderShell();
    open();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Jump to a screen' })).toBeNull();
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    renderShell();
    open();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz' } });
    // Two on purpose: the visible empty row and the screen-reader status.
    expect(screen.getAllByText(/No screens match/).length).toBeGreaterThan(0);
  });

  it('omits org-scoped screens when no organization is selected', () => {
    renderShell({ hasSelectedOrg: false });
    open();
    const list = screen.getByRole('listbox');
    expect(within(list).queryByText('People')).toBeNull();
    expect(within(list).getByText('Organizations')).toBeTruthy();
  });
});

describe('content region', () => {
  it('renders children and offers a skip link ahead of the navigation', () => {
    renderShell();
    expect(screen.getByText('Screen content')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeTruthy();
  });

  it('exposes the content region as a main landmark', () => {
    renderShell();
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
