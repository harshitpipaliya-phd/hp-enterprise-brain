import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, PanelLeftClose } from 'lucide-react';
import type { View } from '../App';
import { COLLAPSIBLE_SECTIONS, SECTIONS, VIEW_META } from './viewMeta';
import type { SectionId } from './viewMeta';
import { navViewsForRole } from './roleAccess';
import { Avatar } from '../ui';

export interface SidebarProps {
  currentView: View;
  hasSelectedOrg: boolean;
  userRole: string | null;
  userName?: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  /** Drawer mode: labels always shown, and navigating dismisses the panel. */
  asDrawer?: boolean;
  onRequestClose?: () => void;
}

/**
 * The primary navigation.
 *
 * Renders as a fixed column on desktop (260px, or a 76px icon rail when
 * collapsed) and as an overlay drawer below 1024px. Both share this component
 * so the role filter, the ordering and the active state cannot drift apart
 * between layouts.
 *
 * Collapsible sections (Intelligence Loop, Analytics, Knowledge, Automation)
 * render a single group header that toggles its children. Only one group is
 * open at a time. When the current view belongs to a collapsible section, that
 * section is auto-expanded so the active item is always visible.
 */
export function Sidebar({
  currentView, hasSelectedOrg, userRole, userName,
  collapsed, onToggleCollapsed, onNavigate, onLogout,
  asDrawer, onRequestClose,
}: SidebarProps) {
  const views = navViewsForRole(userRole);
  // Labels are hidden only on the desktop icon rail. A drawer is an overlay
  // with room for text, so collapsing it would be a pure loss.
  const iconsOnly = collapsed && !asDrawer;

  // Which collapsible section is currently open. Seeded from the active view so
  // a restored session lands with its section already open, and kept in step
  // with navigation by the layout effect below.
  const [expandedSection, setExpandedSection] = React.useState<SectionId | null>(() => {
    const section = VIEW_META[currentView]?.section;
    return section && COLLAPSIBLE_SECTIONS.includes(section) ? section : null;
  });

  // Auto-expand the parent of the active view. Runs before paint (layout
  // effect) so the open/closed state matches the content with no flash.
  React.useLayoutEffect(() => {
    const section = VIEW_META[currentView]?.section;
    if (section && COLLAPSIBLE_SECTIONS.includes(section)) {
      setExpandedSection(section);
    } else {
      setExpandedSection(null);
    }
  }, [currentView]);

  const toggleSection = (section: SectionId) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleNavigate = (view: View, disabled: boolean) => {
    if (disabled) return;
    onNavigate(view);
    // A drawer that stays open over the screen it just navigated to hides the
    // result of the tap on precisely the devices with least room to spare.
    onRequestClose?.();
  };

  return (
    <nav
      className={`s-sidebar${iconsOnly ? ' s-sidebar-collapsed' : ''}${asDrawer ? ' s-sidebar-drawer' : ''}`}
      aria-label="Main navigation"
    >
      <div className="s-brand">
        <span className="s-brand-mark" aria-hidden="true">HP</span>
        {!iconsOnly && (
          <span className="s-brand-text">
            <span className="s-brand-name">Enterprise Brain</span>
            <span className="s-brand-sub">Organizational Intelligence</span>
          </span>
        )}

        {asDrawer ? (
          <button type="button" className="s-brand-btn" onClick={onRequestClose} aria-label="Close navigation">
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="s-brand-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* Only this region scrolls, so the brand and the profile stay put on a
          tall menu rather than scrolling away from the user. */}
      <div className="s-scroll">
        {SECTIONS.map((section) => {
          const items = views.filter((v) => VIEW_META[v].section === section);
          if (items.length === 0) return null;

          // Collapsible sections become a single header that toggles its
          // children. Always-visible sections (Overview, Foundation, Account)
          // keep a static heading, and the icon rail keeps its rule.
          const isCollapsible = !iconsOnly && COLLAPSIBLE_SECTIONS.includes(section);
          const isExpanded = isCollapsible && expandedSection === section;

          return (
            <div className={`s-section${isCollapsible ? ` s-section-group${isExpanded ? ' s-section-expanded' : ''}` : ''}`} key={section}>
              {isCollapsible ? (
                <button
                  type="button"
                  className="s-section-group-header"
                  onClick={() => toggleSection(section)}
                  aria-expanded={isExpanded}
                >
                  <span>{section}</span>
                  <span className="s-section-chevron" aria-hidden="true">
                    <ChevronDown size={14} />
                  </span>
                </button>
              ) : iconsOnly ? (
                <span className="s-section-rule" aria-hidden="true" />
              ) : (
                <h2 className="s-section-title">{section}</h2>
              )}

              {(!isCollapsible || isExpanded) && (
                <ul className="s-list">
                  {items.map((view) => {
                    const meta = VIEW_META[view];
                    const Icon = meta.icon;
                    const disabled = meta.requiresOrg && !hasSelectedOrg;
                    const active = currentView === view;

                    return (
                      <li key={view}>
                        <button
                          type="button"
                          className={`s-item${active ? ' s-item-active' : ''}`}
                          onClick={() => handleNavigate(view, disabled)}
                          disabled={disabled}
                          // aria-current is the semantic half of "you are here";
                          // the gold rail is only the visual half, and a screen
                          // reader cannot see a rail.
                          aria-current={active ? 'page' : undefined}
                          title={
                            disabled ? 'Select an organization first'
                              : iconsOnly ? meta.label
                                : undefined
                          }
                        >
                          <span className="s-item-icon"><Icon size={18} aria-hidden="true" /></span>
                          {!iconsOnly && <span className="s-item-label">{meta.label}</span>}
                          {/* On the icon rail the label is still in the accessible
                              tree — a title attribute alone is not reliably
                              announced, and an icon-only button would otherwise be
                              nameless. */}
                          {iconsOnly && <span className="u-sr-only">{meta.label}</span>}
                          {iconsOnly && <span className="s-tip" aria-hidden="true">{meta.label}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="s-profile">
        <div className="s-profile-row">
          <Avatar name={userName || 'Signed in user'} size="sm" tone="gold" />
          {!iconsOnly && (
            <span className="s-profile-text">
              <span className="s-profile-name">{userName || 'Signed in'}</span>
              {/* Only rendered when the role is actually known — inventing
                  "Member" for a null role would misreport the user's access. */}
              {userRole && <span className="s-profile-role">{userRole.replace(/_/g, ' ')}</span>}
            </span>
          )}
        </div>

        <button
          type="button"
          className="s-item s-logout"
          onClick={onLogout}
          title={iconsOnly ? 'Sign out' : undefined}
        >
          <span className="s-item-icon"><LogOut size={18} aria-hidden="true" /></span>
          {!iconsOnly && <span className="s-item-label">Sign out</span>}
          {iconsOnly && <span className="u-sr-only">Sign out</span>}
          {iconsOnly && <span className="s-tip" aria-hidden="true">Sign out</span>}
        </button>
      </div>
    </nav>
  );
}

/**
 * Drawer wrapper: focus trap, Escape, backdrop, scroll lock, focus restore.
 *
 * Every one of those is a thing a menu overlay silently gets wrong. Without the
 * trap, Tab walks behind the drawer into the page it is covering; without the
 * restore, closing it drops the keyboard user at the top of the document;
 * without the scroll lock, the page behind scrolls under the finger on iOS.
 */
export function SidebarDrawer({
  open, onClose, triggerRef, children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pointerDownOnBackdrop = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : true));

    focusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus?.();
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="s-drawer-backdrop"
      data-testid="sidebar-backdrop"
      // Dismiss only when the gesture BEGAN on the backdrop. A plain onClick
      // also fires when a drag started inside the panel and released outside
      // it, closing the menu mid-scroll.
      onMouseDown={(e) => { pointerDownOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (pointerDownOnBackdrop.current && e.target === e.currentTarget) onClose();
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div ref={panelRef} className="s-drawer-panel" role="dialog" aria-modal="true" aria-label="Navigation menu">
        {children}
      </div>
    </div>
  );
}
