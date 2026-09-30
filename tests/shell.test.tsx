import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Sidebar } from '../src/shell/Sidebar';
import { AppShell } from '../src/shell/AppShell';
import { breadcrumbsFor, VIEW_META } from '../src/shell/viewMeta';
import { navViewsForRole, visibleViewsForRole, PLATFORM_SERVICES } from '../src/shell/roleAccess';
import type { View } from '../src/App';
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

describe('role matrix', () => {
  // These lists only decide which menu items are DRAWN. `navigate()` applies no role guard and the
  // API re-checks permissions from the signed JWT on every request, so a view reached another way
  // still 403s. The tests below therefore pin the two things that matter about the lists:
  //   1. the SECURITY-RELEVANT invariants — which views a role must never be offered — stated
  //      as policy rather than as a count that any added screen silently invalidates, and
  //   2. the current size of each role's menu, as an explicit tripwire: a change to who sees
  //      what is a product decision and should have to touch this file on purpose.
  const ALL_VIEWS = Object.keys(VIEW_META) as View[];

  // Routes carrying permission:settings.manage (admin and tenant_admin only), plus admin-only tooling.
  // workflow and notifications are deliberately excluded: managers work the approval queue and every
  // authenticated role has notifications.
  const SETTINGS_MANAGE_VIEWS: View[] = [
    'ingestion', 'ai', 'list',
    ...PLATFORM_SERVICES.filter((v) => v !== 'workflow' && v !== 'notifications'),
  ];

  // What a read-only or unrecognised role must never be offered: anything that writes, executes,
  // approves, administers or configures.
  const WRITE_OR_GOVERNANCE_VIEWS: View[] = [
    'signals', 'evidence', 'cases', 'deliberation', 'executions', 'ingestion', 'tasks', 'policies',
    'esolibrary', 'ai', 'agents', 'list', 'workflow', ...SETTINGS_MANAGE_VIEWS,
  ];

  // Current menu sizes. admin is derived: it sees every view the nav declares.
  const EXPECTED: Record<string, number> = {
    tenant_admin: 36,
    manager: 18,
    analyst: 18,
    viewer: 12,
    member: 3,
  };

  it('admin sees every view the nav declares', () => {
    expect(visibleViewsForRole('admin').size).toBe(ALL_VIEWS.length);
    expect(visibleViewsForRole('admin')).toEqual(new Set(ALL_VIEWS));
  });

  it.each(Object.entries(EXPECTED))('%s is offered exactly %i views (pinned)', (role, count) => {
    expect(visibleViewsForRole(role).size).toBe(count);
  });

  it('never offers any role a view that admin cannot see', () => {
    const admin = visibleViewsForRole('admin');
    for (const role of Object.keys(EXPECTED)) {
      for (const v of visibleViewsForRole(role)) expect(admin.has(v)).toBe(true);
    }
  });

  it.each(['manager', 'analyst', 'viewer', 'member'])(
    'keeps every settings.manage view out of %s',
    (role) => {
      const visible = visibleViewsForRole(role);
      for (const v of SETTINGS_MANAGE_VIEWS) expect(visible.has(v), `${role} must not see ${v}`).toBe(false);
    },
  );

  it('offers the settings.manage views to tenant_admin', () => {
    const visible = visibleViewsForRole('tenant_admin');
    for (const v of SETTINGS_MANAGE_VIEWS.filter((x) => x !== 'agents')) {
      expect(visible.has(v), `tenant_admin should see ${v}`).toBe(true);
    }
  });

  it.each(['viewer', 'member'])('offers no write, approval, execution or admin view to %s', (role) => {
    const visible = visibleViewsForRole(role);
    for (const v of WRITE_OR_GOVERNANCE_VIEWS) expect(visible.has(v), `${role} must not see ${v}`).toBe(false);
  });

  it('offers the execution centre only to roles holding eso.execute (manager and above)', () => {
    for (const role of ['admin', 'tenant_admin', 'manager']) {
      expect(visibleViewsForRole(role).has('executions')).toBe(true);
    }
    for (const role of ['analyst', 'viewer', 'member']) {
      expect(visibleViewsForRole(role).has('executions')).toBe(false);
    }
  });

  it('gives managers the approval queue and analysts and viewers only notifications', () => {
    expect(visibleViewsForRole('manager').has('workflow')).toBe(true);
    expect(visibleViewsForRole('analyst').has('workflow')).toBe(false);
    expect(visibleViewsForRole('viewer').has('workflow')).toBe(false);
    for (const role of ['analyst', 'viewer']) expect(visibleViewsForRole(role).has('notifications')).toBe(true);
  });

  it('gives a member exactly home, command centre and settings', () => {
    expect(visibleViewsForRole('member')).toEqual(new Set(['home', 'commandcenter', 'settings']));
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

  it('keeps the organization picker route out of every role below tenant_admin', () => {
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
    expect(screen.queryByRole('button', { name: 'Organizations' })).toBeNull();
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

  it('places Memory under Knowledge, not Intelligence Loop', () => {
    renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Intelligence Loop' }));
    expect(screen.queryByRole('button', { name: 'Memory' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Knowledge' }));

    const knowledgeItems = within(screen.getByRole('button', { name: 'Knowledge' }).closest('.s-section') as HTMLElement)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(knowledgeItems).toEqual([
      'Knowledge',
      'Graph Explorer',
      'KASBA Explorer',
      'Knowledge Library',
      'Memory',
      'AI Assistant',
      'Global Search',
      'ESO Library',
    ]);
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
  it('names the landing view Organization, never the raw view id', () => {
    const trail = breadcrumbsFor('home', 'Scholar Clone').map((c) => c.label);
    expect(trail).toContain('Organization');
    expect(trail).not.toContain('home');
  });

  it.each([
    ['home', 'Overview', 'Organization'],
    ['people', 'Foundation', 'People'],
    ['signals', 'Intelligence Loop', 'Signals'],
    ['executive', 'Analytics', 'Executive Dashboard'],
    ['graph', 'Knowledge', 'Graph Explorer'],
    ['memory', 'Knowledge', 'Memory'],
    ['tasks', 'Automation', 'Task Orchestrator'],
    ['settings', 'Account', 'Settings'],
    ['rbac', 'Platform Services', 'RBAC'],
    ['eventbus', 'Platform Services', 'Event Bus'],
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

  it('covers every declared view without falling through', () => {
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
  it('navigates to the existing AI Assistant screen rather than faking search', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Go to AI Assistant' }));
    expect(onNavigate).toHaveBeenCalledWith('aiassistant');
  });

  it('hides the search entry from a role that cannot reach the screen', () => {
    renderShell({ userRole: 'member' });
    expect(screen.queryByRole('button', { name: 'Go to AI Assistant' })).toBeNull();
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

  it('lists the Platform Services the role may reach, and navigates to one', () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu for Scholar Clone' }));
    const group = screen.getByRole('group', { name: 'Platform Services' });
    expect(within(group).getAllByRole('menuitem').map((b) => b.textContent)).toEqual([
      'RBAC', 'Workflow', 'Notification', 'Scheduler', 'Document', 'Integration', 'Audit', 'Event Bus',
    ]);
    fireEvent.click(within(group).getByRole('menuitem', { name: 'Audit' }));
    expect(onNavigate).toHaveBeenCalledWith('audit');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrows Platform Services to what a manager may reach', () => {
    renderShell({ userRole: 'manager' });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu for Scholar Clone' }));
    const group = screen.getByRole('group', { name: 'Platform Services' });
    expect(within(group).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Workflow', 'Notification']);
  });

  it('omits the Platform Services group for a role that can reach none of them', () => {
    renderShell({ userRole: 'member' });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu for Scholar Clone' }));
    expect(screen.queryByRole('group', { name: 'Platform Services' })).toBeNull();
  });

  it('shows no identity it does not have', () => {
    renderShell({ userName: null, userRole: null });
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Signed in')).toBeTruthy();
  });
});

describe('user menu — AI & Intelligence', () => {
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Account menu/ }));

  it.each(['admin', 'tenant_admin'])('offers the console and every capability to %s', (role) => {
    const onOpenAiConsole = vi.fn();
    renderShell({ userRole: role, onOpenAiConsole });
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /AI & Intelligence/ }));
    expect(onOpenAiConsole).toHaveBeenLastCalledWith('');

    openMenu();
    // A capability with its own screen opens that route; one without opens its slug.
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI Providers' }));
    expect(onOpenAiConsole).toHaveBeenLastCalledWith('providers');
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Knowledge Graph/ }));
    expect(onOpenAiConsole).toHaveBeenLastCalledWith('knowledge-graph');
  });

  it.each(['manager', 'analyst', 'viewer', 'member', null])('is absent for %s — the API would 403', (role) => {
    renderShell({ userRole: role, onOpenAiConsole: vi.fn() });
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /AI & Intelligence/ })).toBeNull();
  });

  it('is absent until an organization is selected, because the console is tenant-scoped', () => {
    renderShell({ hasSelectedOrg: false, onOpenAiConsole: vi.fn() });
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /AI & Intelligence/ })).toBeNull();
  });

  it('keeps Sign out reachable below the capability list', () => {
    const onLogout = vi.fn();
    renderShell({ onLogout, onOpenAiConsole: vi.fn() });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledOnce();
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
    expect(within(list).getByText('Organization')).toBeTruthy();
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
    expect(within(list).queryByText('Organizations')).toBeNull();
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
