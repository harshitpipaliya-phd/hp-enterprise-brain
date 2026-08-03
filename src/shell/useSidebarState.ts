import { useCallback, useEffect, useState } from 'react';

const COLLAPSE_KEY = 'hpbrain-sidebar-collapsed';

/** Below this the sidebar stops being a column and becomes a drawer. */
export const DRAWER_BREAKPOINT = 1024;

/**
 * Reads the stored collapse preference.
 *
 * Anything that is not exactly 'true' or 'false' is treated as "no preference"
 * and returns false. The value survives deploys and is user-editable, so it can
 * legitimately be absent, stale, or garbage — and a bare
 * `localStorage.getItem(...) === 'true'` quietly reading a corrupt value is the
 * kind of default nobody notices until the sidebar starts up wrong.
 */
export function readCollapsePreference(): boolean {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return false;
  } catch {
    // Storage disabled (private browsing, blocked cookies). Not a reason to
    // fail to render a sidebar.
    return false;
  }
}

function writeCollapsePreference(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // The preference simply will not persist; the session still works.
  }
}

export interface SidebarState {
  /** True on viewports where the sidebar is a drawer rather than a column. */
  isCompact: boolean;
  /** Desktop only — the 76px icon rail. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Compact only — whether the drawer is showing. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export function useSidebarState(): SidebarState {
  const [collapsed, setCollapsed] = useState(readCollapsePreference);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < DRAWER_BREAKPOINT,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DRAWER_BREAKPOINT - 1}px)`);

    const apply = (matches: boolean) => {
      setIsCompact(matches);
      // Leaving a drawer "open" behind a desktop layout strands a focus trap
      // and a scroll lock the user cannot see or dismiss. Rotating a tablet
      // with the menu open used to do exactly that.
      if (!matches) setDrawerOpen(false);
    };

    apply(mq.matches);

    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsePreference(next);
      return next;
    });
  }, []);

  return {
    isCompact,
    // The icon rail is a desktop affordance. In a drawer the labels are always
    // shown, because a 76px overlay is a worse menu than no menu.
    collapsed: collapsed && !isCompact,
    toggleCollapsed,
    drawerOpen,
    openDrawer: useCallback(() => setDrawerOpen(true), []),
    closeDrawer: useCallback(() => setDrawerOpen(false), []),
  };
}
