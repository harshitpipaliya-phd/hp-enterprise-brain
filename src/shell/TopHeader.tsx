import React from 'react';
import { Bell, ChevronRight, Menu, Search, UserRound } from 'lucide-react';
import type { View } from '../App';
import { breadcrumbsFor } from './viewMeta';
import { visibleViewsForRole } from './roleAccess';
import { Avatar, IconButton } from '../ui';

export interface TopHeaderProps {
  view: View;
  orgName?: string;
  userName?: string | null;
  userRole: string | null;
  showMenuButton: boolean;
  // React 19 types RefObject<T> as possibly-null; the DOM ref prop still wants
  // the non-null form, so this is the shape both agree on.
  menuButtonRef: React.Ref<HTMLButtonElement>;
  onOpenDrawer: () => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  onOpenCommandPalette: () => void;
  /** Rendered in the notifications slot when the app supplies one. */
  notificationSlot?: React.ReactNode;
}

/**
 * Sticky application header.
 *
 * NOTHING HERE IS INVENTED. Each control either drives an existing view or is
 * omitted. In particular there is no Help entry: the app has no help screen,
 * route or documentation target, and a button that looks live and does nothing
 * is worse than its absence — it costs a keyboard user a tab stop to discover
 * that it is a dead end.
 */
export function TopHeader({
  view, orgName, userName, userRole, showMenuButton, menuButtonRef,
  onOpenDrawer, onNavigate, onLogout, onOpenCommandPalette, notificationSlot,
}: TopHeaderProps) {
  const crumbs = breadcrumbsFor(view, orgName);
  const canOpenAssistant = visibleViewsForRole(userRole).has('aiassistant');

  return (
    <header className="s-header">
      <div className="s-header-left">
        {showMenuButton && (
          <button
            ref={menuButtonRef}
            type="button"
            className="s-menu-btn"
            onClick={onOpenDrawer}
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        )}

        <nav aria-label="Breadcrumb" className="s-crumbs">
          <ol>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`}>
                  {i > 0 && <ChevronRight className="s-crumb-sep" aria-hidden="true" />}
                  {last ? (
                    <span className="s-crumb-current" aria-current="page">{c.label}</span>
                  ) : c.view ? (
                    <button type="button" className="s-crumb-link" onClick={() => onNavigate(c.view!)}>
                      {c.label}
                    </button>
                  ) : (
                    // Section headings and the organization name are context,
                    // not destinations. Rendering them as buttons would put
                    // stops in the tab order that do nothing when activated.
                    <span className="s-crumb-static">{c.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div className="s-header-right">
        <button type="button" className="s-search-btn" onClick={onOpenCommandPalette}>
          <Search size={16} aria-hidden="true" />
          <span className="s-search-label">Jump to…</span>
          <kbd className="s-kbd">Ctrl K</kbd>
        </button>

        {/*
          Navigates to the existing AI Assistant screen. It is labelled as
          navigation rather than dressed up as a search field, because typing
          here would imply results this header cannot produce.
        */}
        {canOpenAssistant && (
          <IconButton label="Go to AI Assistant" onClick={() => onNavigate('aiassistant')}>
            <Search size={18} aria-hidden="true" />
          </IconButton>
        )}

        {/* Supplied by the app when a real notification source exists. No
            placeholder bell and no invented unread count when it does not. */}
        {notificationSlot ?? (
          <IconButton label="Notifications are not available" disabled>
            <Bell size={18} aria-hidden="true" />
          </IconButton>
        )}

        <UserMenu
          userName={userName}
          userRole={userRole}
          onLogout={onLogout}
          onOpenSettings={() => onNavigate('settings')}
          canOpenSettings={visibleViewsForRole(userRole).has('settings')}
        />
      </div>
    </header>
  );
}

function UserMenu({
  userName, userRole, onLogout, onOpenSettings, canOpenSettings,
}: {
  userName?: string | null;
  userRole: string | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  canOpenSettings: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    // pointerdown, not click: a click listener fires after the menu has already
    // re-rendered, which makes the outside-click test race with the item that
    // was clicked.
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  return (
    <div className="s-usermenu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="s-usermenu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={userName ? `Account menu for ${userName}` : 'Account menu'}
      >
        {userName ? <Avatar name={userName} size="sm" /> : <UserRound size={18} aria-hidden="true" />}
      </button>

      {open && (
        <div className="s-usermenu-panel" role="menu">
          {/* Identity is shown only when the app actually knows it. No sample
              names, and no role invented for a user whose role is unknown. */}
          <div className="s-usermenu-head">
            <span className="s-usermenu-name">{userName || 'Signed in'}</span>
            {userRole && <span className="s-usermenu-role">{userRole.replace(/_/g, ' ')}</span>}
          </div>

          {canOpenSettings && (
            <button type="button" role="menuitem" className="s-usermenu-item" onClick={() => { close(); onOpenSettings(); }}>
              Settings
            </button>
          )}

          <button type="button" role="menuitem" className="s-usermenu-item s-usermenu-danger" onClick={() => { setOpen(false); onLogout(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
