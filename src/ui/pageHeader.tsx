import React from 'react';
import { ArrowLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { StatusBadge } from './primitives';
import type { BadgeTone } from './primitives';

/**
 * THE PAGE HEADER SYSTEM.
 *
 * WHY THIS FILE EXISTS. Every screen in the product opened with its own idea of
 * what a page header is: `.intel-header`, `.dept-intel__header`,
 * `.signal-intel__header`, `.evidence-intel__header`, `.people-app-header`,
 * `.oi-head`, `.kx-head`, `.gx-head`, `.pp-head`, `.cc-org-hero`,
 * `.ingestion-hero`, plus a dozen screens that opened with a bare
 * `<header style={{ display: 'flex', justifyContent: 'space-between' }}>`.
 *
 * The previous pass tried to unify them from the outside, by naming all eleven
 * class names in one selector list in refine.css. That made them LOOK alike
 * while leaving eleven different DOM shapes underneath — so the icon, the
 * status, the metadata row and the action group each existed on some screens
 * and not others, wrapped differently at every breakpoint, and nothing could be
 * corrected in one place.
 *
 * This is the one implementation. A screen supplies FACTS — eyebrow, title,
 * description, icon, status, metadata, actions — and gets the product's header
 * back. Arrangement, elevation, responsive behaviour and accessible structure
 * are decided here, once.
 *
 * NOTHING HERE FETCHES. The header renders synchronously from props on the
 * first paint; a screen whose metadata is still in flight passes `undefined`
 * and that row simply is not there yet. That is deliberate — a header that
 * waits on a request is a page that opens blank.
 */

/* ============================================================================
   VARIANTS

   Same design language, different amount of context. The variant decides the
   size of the icon plate and the title and nothing else — every variant reads
   the same tokens, so they cannot drift apart.
   ========================================================================== */
export type PageHeaderVariant =
  /** Directories and tables: People, Departments, Capabilities, Organizations. */
  | 'list'
  /** A single named entity: a department, a person, a student. */
  | 'detail'
  /** Derived screens, which carry a provenance stamp. */
  | 'intelligence'
  /** Configuration. The quietest of the five. */
  | 'settings'
  /** The organization command centre. The only hero in the product. */
  | 'organization';

export interface PageHeaderCrumb {
  label: string;
  /** Omit on the final crumb, and on any crumb that is context rather than a
   *  destination — a link that goes nowhere costs a keyboard user a tab stop. */
  onClick?: () => void;
}

export interface PageHeaderMeta {
  /** Decorative. The label carries the meaning. */
  icon?: React.ReactNode;
  label: React.ReactNode;
  /** Native tooltip, for a value whose meaning the label does not make obvious. */
  title?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  variant?: PageHeaderVariant;
  /** Small uppercase line above the title. Answers "where am I". */
  eyebrow?: React.ReactNode;
  /** One sentence. Answers "what is this screen for". */
  description?: React.ReactNode;
  /** A lucide element. Sized by the variant — pass it without a `size`. */
  icon?: React.ReactNode;
  /** Rendered beside the title. */
  status?: { label: React.ReactNode; tone?: BadgeTone } | null;
  /** Identifiers under the description. Falsy entries are dropped, so a caller
   *  can write `org.email && { icon: …, label: org.email }` inline. */
  meta?: (PageHeaderMeta | null | undefined | false)[];
  breadcrumbs?: PageHeaderCrumb[];
  /** A single "back to …" affordance, above the title. */
  back?: { label: string; onClick: () => void } | null;
  /** Buttons. Group them with <HeaderActions> so they share one gap and one
   *  wrapping rule, and put anything past the important ones into
   *  <HeaderOverflowMenu>. */
  actions?: React.ReactNode;
  /** A panel beside the actions — a provenance stamp, a health score. */
  aside?: React.ReactNode;
  /** Rendered under the header bar, inside the same surface: tabs, a population
   *  switcher, a filter row that belongs to the header rather than to the page. */
  children?: React.ReactNode;
  className?: string;
  /** Only for a header that is not the first thing on its screen. */
  id?: string;
}

/**
 * THE NAV-SECTION LABELS THE HEADER REFUSES TO REPEAT.
 *
 * The sidebar already states which section of the product a screen belongs to.
 * Printing it again above every title spent the most valuable line in the
 * header on information the user is already looking at, and pushed the one
 * thing they actually needed — WHICH PAGE IS THIS — down and out of the
 * hierarchy.
 *
 * Screens no longer pass these, and this set is the guard rail rather than the
 * mechanism: a future screen that reintroduces one gets it dropped here instead
 * of shipping an inconsistent header. A genuinely page-specific eyebrow
 * ("Student record", "Teaching section") is not in this set and still renders.
 */
const NAV_SECTION_EYEBROWS = new Set([
  'foundation', 'intelligence loop', 'analytics',
  'knowledge', 'automation', 'account', 'overview',
]);

function isNavSectionEyebrow(eyebrow: React.ReactNode): boolean {
  return typeof eyebrow === 'string'
    && NAV_SECTION_EYEBROWS.has(eyebrow.trim().toLowerCase());
}

export function PageHeader({
  title, variant = 'list', eyebrow, description, icon, status, meta,
  breadcrumbs, back, actions, aside, children, className = '', id,
}: PageHeaderProps) {
  const metaItems = (meta ?? []).filter(Boolean) as PageHeaderMeta[];
  const hasCrumbs = !!breadcrumbs?.length;
  const shownEyebrow = eyebrow && !isNavSectionEyebrow(eyebrow) ? eyebrow : null;

  return (
    <header
      id={id}
      className={['u-ph', className].filter(Boolean).join(' ')}
      data-variant={variant}
    >
      {(hasCrumbs || back) && (
        <div className="u-ph__top">
          {back && (
            <button type="button" className="u-ph__back" onClick={back.onClick}>
              <ArrowLeft size={14} aria-hidden="true" />
              {back.label}
            </button>
          )}
          {hasCrumbs && <PageHeaderBreadcrumbs items={breadcrumbs!} />}
        </div>
      )}

      <div className="u-ph__bar">
        <div className="u-ph__lead">
          {icon && <span className="u-ph__icon" aria-hidden="true">{icon}</span>}

          <div className="u-ph__text">
            {shownEyebrow && <p className="u-ph__eyebrow">{shownEyebrow}</p>}

            <div className="u-ph__titlerow">
              <h1 className="u-ph__title">{title}</h1>
              {status && (
                <StatusBadge tone={status.tone ?? 'neutral'} icon={false}>
                  {status.label}
                </StatusBadge>
              )}
            </div>

            {description && <p className="u-ph__desc">{description}</p>}

            {metaItems.length > 0 && (
              <ul className="u-ph__meta">
                {metaItems.map((m, i) => (
                  // A long value is capped and ellipsised, so the chip carries
                  // the whole of it as its title — otherwise a truncated
                  // address would be unreadable and unrecoverable.
                  <li key={i} title={m.title ?? (typeof m.label === 'string' ? m.label : undefined)}>
                    {m.icon}
                    <span>{m.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {(actions || aside) && (
          <div className="u-ph__side">
            {actions && <div className="u-ph__actions">{actions}</div>}
            {aside && <div className="u-ph__aside">{aside}</div>}
          </div>
        )}
      </div>

      {children && <div className="u-ph__below">{children}</div>}
    </header>
  );
}

export const PremiumPageHeader = PageHeader;
export const PageBreadcrumbs = PageHeaderBreadcrumbs;
export const PageHeaderIcon = HeaderIcon;
export const PageHeaderContent = PageDescription;
export const PageHeaderActions = HeaderActions;
export const PageHeaderMeta = HeaderMeta;
export const PageHeaderStatus = StatusBadge;

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="u-ph__eyebrow">{children}</p>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="u-ph__title">{children}</h1>;
}

export function PageDescription({ children }: { children: React.ReactNode }) {
  return <p className="u-ph__desc">{children}</p>;
}

export function HeaderMeta({ items }: { items: (PageHeaderMeta | null | undefined | false)[] }) {
  const metaItems = items.filter(Boolean) as PageHeaderMeta[];
  if (metaItems.length === 0) return null;

  return (
    <ul className="u-ph__meta">
      {metaItems.map((m, i) => (
        <li key={i} title={m.title ?? (typeof m.label === 'string' ? m.label : undefined)}>
          {m.icon}
          <span>{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function HeaderIcon({ children }: { children: React.ReactNode }) {
  return <span className="u-ph__icon" aria-hidden="true">{children}</span>;
}

export function PrimaryHeaderAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={['u-btn u-btn-primary', props.className].filter(Boolean).join(' ')} />;
}

export function SecondaryHeaderAction(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={['u-btn u-btn-secondary', props.className].filter(Boolean).join(' ')} />;
}

export function PageHeaderScore({
  label,
  value,
  unit,
  status,
  empty = 'Not enough data',
}: {
  label: string;
  value?: React.ReactNode;
  unit?: React.ReactNode;
  status?: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <div className="u-ph__score">
      <span className="u-ph__score-label">{label}</span>
      {value === null || value === undefined ? (
        <span className="u-ph__score-empty">{empty}</span>
      ) : (
        <span className="u-ph__score-value">
          {value}
          {unit && <small>{unit}</small>}
        </span>
      )}
      {status && <span className="u-ph__score-status">{status}</span>}
    </div>
  );
}

/* ============================================================================
   BREADCRUMBS

   Deliberately quiet and deliberately small: the shell already renders the
   authoritative trail in the top bar, so an in-header trail only earns its
   space when it says something the shell's cannot — a department's name, a
   person's name, the row that was drilled into.
   ========================================================================== */
export function PageHeaderBreadcrumbs({ items }: { items: PageHeaderCrumb[] }) {
  return (
    <nav className="u-ph__crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight aria-hidden="true" />}
              {last || !c.onClick ? (
                <span aria-current={last ? 'page' : undefined}>{c.label}</span>
              ) : (
                <button type="button" onClick={c.onClick}>{c.label}</button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ============================================================================
   ACTION GROUP

   One gap, one wrapping rule, one alignment. Screens pass buttons; they do not
   each decide how a row of buttons behaves at 900px.
   ========================================================================== */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  return <div className="u-ph__group">{children}</div>;
}

export interface HeaderMenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Rendered in the destructive colour, and separated from the rest. */
  danger?: boolean;
}

/**
 * Overflow, for the actions past the important ones.
 *
 * A header with seven visible buttons has no primary action — everything is
 * equally loud, which is the state this pass exists to remove. Keep the one or
 * two that matter visible and put the rest in here.
 *
 * Escape closes and returns focus, an outside pointerdown closes, and the
 * trigger is labelled: an icon-only control is unlabelled to a screen reader
 * without it.
 */
export function HeaderOverflowMenu({
  items, label = 'More actions',
}: { items: HeaderMenuItem[]; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    // pointerdown rather than click: a click listener fires after the menu has
    // already re-rendered, which races with the item that was activated.
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

  if (items.length === 0) return null;

  return (
    <div className="u-ph__menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="u-btn u-btn-secondary u-btn-sm u-ph__menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <div className="u-ph__menu-panel" role="menu">
          {items.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              type="button"
              role="menuitem"
              className={`u-ph__menu-item${item.danger ? ' u-ph__menu-item--danger' : ''}`}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onSelect(); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The provenance stamp the derived screens carry.
 *
 * It lives here rather than in each intelligence screen because it is header
 * furniture: it sits in the `aside` slot on five screens and has to align with
 * the action row beside it on all five.
 */
export function HeaderStamp({ children, title }: { children: React.ReactNode; title?: string }) {
  return <div className="u-ph__stamp" title={title}>{children}</div>;
}
