import React from 'react';
import type { View } from '../App';
import { Sidebar, SidebarDrawer } from './Sidebar';
import { TopHeader } from './TopHeader';
import { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';
import { useSidebarState } from './useSidebarState';

export interface AppShellProps {
  view: View;
  orgName?: string;
  hasSelectedOrg: boolean;
  userName?: string | null;
  userRole: string | null;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  notificationSlot?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Sidebar + header + content region.
 *
 * The shell owns navigation chrome and nothing else — it takes `view` and
 * `onNavigate` and has no opinion about what a view renders. That keeps the
 * existing setView architecture untouched: no router, no URL, no change to the
 * View union.
 *
 * Layout is CSS grid driven by a single custom property, so expanding or
 * collapsing the sidebar moves the content edge without either side needing to
 * know the other's width.
 */
export function AppShell({
  view, orgName, hasSelectedOrg, userName, userRole,
  onNavigate, onLogout, notificationSlot, children,
}: AppShellProps) {
  const sidebar = useSidebarState();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  useCommandPaletteHotkey(React.useCallback(() => setPaletteOpen(true), []));

  const nav = (
    <Sidebar
      currentView={view}
      hasSelectedOrg={hasSelectedOrg}
      userRole={userRole}
      userName={userName}
      collapsed={sidebar.collapsed}
      onToggleCollapsed={sidebar.toggleCollapsed}
      onNavigate={onNavigate}
      onLogout={onLogout}
      asDrawer={sidebar.isCompact}
      onRequestClose={sidebar.isCompact ? sidebar.closeDrawer : undefined}
    />
  );

  return (
    <div
      className={`s-shell${sidebar.collapsed ? ' s-shell-collapsed' : ''}${sidebar.isCompact ? ' s-shell-compact' : ''}`}
    >
      {/* Keyboard and screen-reader users otherwise tab through every nav item
          on every screen before reaching the content they came for. */}
      <a className="s-skip" href="#main-content">Skip to main content</a>

      {!sidebar.isCompact && <div className="s-sidebar-slot">{nav}</div>}

      {sidebar.isCompact && (
        <SidebarDrawer open={sidebar.drawerOpen} onClose={sidebar.closeDrawer} triggerRef={menuButtonRef}>
          {nav}
        </SidebarDrawer>
      )}

      <div className="s-main">
        <TopHeader
          view={view}
          orgName={orgName}
          userName={userName}
          userRole={userRole}
          showMenuButton={sidebar.isCompact}
          menuButtonRef={menuButtonRef}
          onOpenDrawer={sidebar.openDrawer}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          notificationSlot={notificationSlot}
        />

        <main className="s-content" id="main-content" tabIndex={-1}>
          <div className="s-content-inner">{children}</div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        userRole={userRole}
        hasSelectedOrg={hasSelectedOrg}
        onNavigate={onNavigate}
      />
    </div>
  );
}
