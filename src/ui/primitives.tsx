import React from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, ChevronsUpDown,
  Info, Search, X, XCircle, Inbox, Lock, FileQuestion, RefreshCw,
} from 'lucide-react';

/**
 * Enterprise Brain UI primitives.
 *
 * WHY THIS LAYER EXISTS. The app had no generic UI components at all —
 * `components/rcl/` sounds like one but holds domain widgets. Every button,
 * card, input and table was bespoke markup, which is how 86 of 107 components
 * ended up carrying 1,087 inline `style={{…}}` objects and 225 hardcoded hex
 * colours between them.
 *
 * The inline styling is not merely untidy: a `style` attribute cannot express
 * :hover, :focus-visible, :disabled or a media query, so every screen written
 * that way is STRUCTURALLY incapable of the interaction and responsive states
 * this redesign requires. Each primitive below is class-based, so it gets all
 * of them once and every screen that adopts it inherits them.
 *
 * Styles live in ./ui.css under the .u- prefix, kept apart from the existing
 * .eb- vocabulary so both can coexist while screens migrate one at a time.
 */

/* ============================================================================
   BUTTON
   ========================================================================== */

export type ButtonVariant =
  | 'primary' | 'navy' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
  /** Rendered before the label. Decorative — give the button a real text label. */
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, block, icon, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={[
        'u-btn', `u-btn-${variant}`,
        size !== 'md' ? `u-btn-${size}` : '',
        block ? 'u-btn-block' : '',
        loading ? 'u-btn-loading' : '',
        className,
      ].filter(Boolean).join(' ')}
      // A loading button is still disabled to the pointer, but stays in the tab
      // order and keeps announcing itself — aria-busy tells assistive tech the
      // control is working rather than gone.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control is unlabelled to a screen reader without it. */
  label: string;
  size?: 'sm' | 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      className={['u-icon-btn', size === 'sm' ? 'u-icon-btn-sm' : '', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ============================================================================
   CARD
   ========================================================================== */

export function Card({ padded = true, className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={['u-card', padded ? 'u-card-pad' : '', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="u-card-header">
      <h3 className="u-card-title">{title}</h3>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`u-card-body ${className}`}>{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="u-card-footer">{children}</div>;
}

/* ============================================================================
   METRIC CARD
   ========================================================================== */

export type MetricStatus = 'good' | 'warn' | 'crit' | 'info';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  status?: MetricStatus;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  /** Explains what the metric counts. Shown as a native tooltip on the label. */
  tooltip?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, hint, icon, status, trend, tooltip, onClick }: MetricCardProps) {
  const inner = (
    <>
      <div className="u-metric-top">
        {icon}
        <span className="u-metric-label" title={tooltip}>{label}</span>
      </div>
      <span className="u-metric-value">{value}</span>
      <div className="u-row u-gap-2">
        {trend && (
          <span className="u-metric-trend" data-dir={trend.direction}>
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {trend.label}
          </span>
        )}
        {hint && <span className="u-metric-hint">{hint}</span>}
      </div>
    </>
  );

  // A real <button> only when it navigates. Making every tile a button would
  // promise a destination half of them lack and add dead stops to the tab order.
  return onClick ? (
    <button type="button" className="u-metric u-metric-action" data-status={status} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="u-metric" data-status={status}>{inner}</div>
  );
}

/* ============================================================================
   BADGE
   ========================================================================== */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

const TONE_ICON: Record<BadgeTone, React.ReactNode> = {
  success: <Check aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  danger: <XCircle aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  neutral: null,
  gold: null,
};

/**
 * Status never travels as colour alone.
 *
 * The tone supplies a glyph as well as a hue, so the meaning survives
 * greyscale, a printout, forced-colors mode, and a reader with a colour-vision
 * deficiency. Pass `icon={false}` only where an adjacent label already carries
 * the meaning in words.
 */
export function StatusBadge({
  tone = 'neutral', icon = true, children,
}: { tone?: BadgeTone; icon?: boolean; children: React.ReactNode }) {
  return (
    <span className={`u-badge u-badge-${tone}`}>
      {icon ? TONE_ICON[tone] : null}
      {children}
    </span>
  );
}

/* ============================================================================
   FORM CONTROLS
   ========================================================================== */

export interface FieldProps {
  label: string;
  /** Only needed to override the generated id (e.g. to match an external ref). */
  htmlFor?: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactElement;
}

/**
 * Label above, help below, error last — and all three WIRED to the control.
 *
 * The first version rendered the error as a sibling and nothing more. Visually
 * that reads fine, but the input had no `aria-describedby`, so a screen reader
 * announced the field as an unadorned "Organization code, edit text" with no
 * hint that it had failed validation or why. The message was on screen and
 * absent from the accessible tree.
 *
 * The child is cloned to attach `id`, `aria-describedby` and `aria-invalid`
 * rather than requiring every caller to thread three ids by hand — the version
 * that relies on discipline is the version that is wrong in half the forms.
 * An explicit prop already set by the caller always wins.
 *
 * The error is also a live region: a message that appears silently after a
 * failed submit is invisible to anyone not looking straight at that field.
 */
export function Field({ label, htmlFor, required, help, error, children }: FieldProps) {
  const reactId = React.useId();
  const helpId = `${reactId}-help`;
  const errorId = `${reactId}-error`;

  // The child's OWN id wins, and the label follows it. Pointing htmlFor at a
  // generated id while the input kept a caller-supplied one silently severed
  // the association — the label still looked correct and clicking it did
  // nothing, which is the failure mode hardest to notice by eye.
  const childId = React.isValidElement(children)
    ? (children.props as Record<string, unknown>).id as string | undefined
    : undefined;
  const controlId = childId ?? htmlFor ?? `${reactId}-control`;

  const describedBy = [
    help && !error ? helpId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: controlId,
        'aria-describedby':
          (children.props as Record<string, unknown>)['aria-describedby'] ?? describedBy,
        'aria-invalid':
          (children.props as Record<string, unknown>)['aria-invalid'] ?? (error ? true : undefined),
        'aria-required':
          (children.props as Record<string, unknown>)['aria-required'] ?? (required || undefined),
      })
    : children;

  return (
    <div className="u-field">
      <label className={`u-label ${required ? 'u-label-required' : ''}`} htmlFor={controlId}>
        {label}
      </label>
      {child}
      {help && !error && <span className="u-help" id={helpId}>{help}</span>}
      {error && (
        <span className="u-error" id={errorId} role="alert">
          <AlertTriangle aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ invalid, className = '', ...rest }, ref) {
    return <input ref={ref} className={`u-input ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ invalid, className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`u-textarea ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ invalid, className = '', children, ...rest }, ref) {
    return (
      <div className="u-select-wrap">
        <select ref={ref} className={`u-select ${className}`} aria-invalid={invalid || undefined} {...rest}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    );
  },
);

export function SearchInput({
  value, onValueChange, placeholder = 'Search…', ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <div className="u-search">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        className="u-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        {...rest}
      />
      {value && (
        <span className="u-search-clear">
          <IconButton label="Clear search" size="sm" onClick={() => onValueChange('')}>
            <X size={14} aria-hidden="true" />
          </IconButton>
        </span>
      )}
    </div>
  );
}

export function Checkbox({
  label, disabled, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={`u-check ${disabled ? 'u-check-disabled' : ''}`}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  label, checked, onCheckedChange, disabled,
}: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="u-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="u-switch-track"><span className="u-switch-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

/* ============================================================================
   STATES
   ========================================================================== */

export function EmptyState({
  title, description, action, icon,
}: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="u-state">
      <div className="u-state-icon">{icon ?? <Inbox size={22} aria-hidden="true" />}</div>
      <h3 className="u-state-title">{title}</h3>
      {description && <p className="u-state-desc">{description}</p>}
      {action}
    </div>
  );
}

/**
 * `title` says WHAT failed, `message` says what the server said about it.
 *
 * They are separate props because a caller that has both has two different
 * facts, and the wrapper that used to collapse them into one — passing
 * `message || title` — printed the same sentence as heading and body whenever
 * only the default was available, and silently threw away a custom title
 * whenever both were given.
 */
export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="u-state u-state-danger" role="alert">
      <div className="u-state-icon"><AlertTriangle size={22} aria-hidden="true" /></div>
      <h3 className="u-state-title">{title}</h3>
      {message && message !== title && <p className="u-state-desc">{message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RefreshCw size={15} aria-hidden="true" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PermissionDeniedState({ requiredPermission }: { requiredPermission?: string }) {
  return (
    <div className="u-state u-state-warning">
      <div className="u-state-icon"><Lock size={22} aria-hidden="true" /></div>
      <h3 className="u-state-title">You don’t have access to this</h3>
      <p className="u-state-desc">
        {requiredPermission
          ? `This screen requires the “${requiredPermission}” permission. Ask an administrator to grant it.`
          : 'Ask an administrator if you think you should be able to see this.'}
      </p>
    </div>
  );
}

export function NotFoundState({ what = 'page', onBack }: { what?: string; onBack?: () => void }) {
  return (
    <div className="u-state">
      <div className="u-state-icon"><FileQuestion size={22} aria-hidden="true" /></div>
      <h3 className="u-state-title">That {what} doesn’t exist</h3>
      <p className="u-state-desc">It may have been archived, or the link may be out of date.</p>
      {onBack && <Button variant="secondary" onClick={onBack}>Go back</Button>}
    </div>
  );
}

/**
 * Skeleton placeholder.
 *
 * Width and height are required rather than defaulted, because the whole point
 * is to occupy the same box the real content will: a skeleton of the wrong size
 * causes exactly the layout shift it was added to prevent.
 */
export function Skeleton({ width, height, radius }: { width: number | string; height: number | string; radius?: number }) {
  return <span className="u-skeleton" style={{ display: 'block', width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function Spinner({ size = 18, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <span className="u-row u-gap-2">
      <span className="u-spinner" style={{ width: size, height: size }} aria-hidden="true" />
      <span className="u-sr-only" role="status">{label}</span>
    </span>
  );
}

/** Skeleton rows shaped like the table they replace, so nothing jumps on load. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ padding: 'var(--eb-space-4)' }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="u-row u-gap-4" style={{ padding: '10px 0' }}>
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} style={{ flex: c === 0 ? 2 : 1 }}>
              <Skeleton width="100%" height={14} radius={4} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   ALERT
   ========================================================================== */

const ALERT_ICON = {
  success: <Check size={16} aria-hidden="true" />,
  warning: <AlertTriangle size={16} aria-hidden="true" />,
  danger: <XCircle size={16} aria-hidden="true" />,
  info: <Info size={16} aria-hidden="true" />,
};

export function Alert({
  tone = 'info', title, children,
}: { tone?: 'success' | 'warning' | 'danger' | 'info'; title?: string; children?: React.ReactNode }) {
  return (
    <div className={`u-alert u-alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {ALERT_ICON[tone]}
      <div>
        {title && <p className="u-alert-title">{title}</p>}
        {children && <p className="u-alert-body">{children}</p>}
      </div>
    </div>
  );
}

/* ============================================================================
   TOOLTIP
   ========================================================================== */

/**
 * Shows on hover AND on focus.
 *
 * Hover-only tooltips are unreachable by keyboard and by touch, which makes any
 * information they carry invisible to those users — so a tooltip must never be
 * the only place something important is said.
 */
export function Tooltip({ content, wrap, children }: { content: string; wrap?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      className="u-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && <span className="u-tip-bubble" role="tooltip" data-wrap={wrap ? 'true' : undefined}>{content}</span>}
    </span>
  );
}

/* ============================================================================
   MODAL
   ========================================================================== */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Accessible dialog: Escape closes, focus is trapped, focus returns on close,
 * and the page behind does not scroll.
 *
 * All four are things the app's two hand-rolled dialogs did not do. A dialog
 * without a focus trap lets Tab walk into the page behind it, where a screen
 * reader user is then interacting with content the dialog is supposed to be
 * covering, with no way to tell they have left.
 */
export function Modal({ open, onClose, title, description, size = 'md', footer, children }: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => {
        if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false;

        // checkVisibility() where the browser has it. NOT offsetParent: that is
        // null for every position:fixed element — which this dialog is inside —
        // and null for everything in jsdom, so the filter would empty the list
        // and focus would never enter the dialog at all.
        return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
      });

    focusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends, so Tab and Shift+Tab cycle inside the dialog rather
      // than escaping into the page behind it.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Returning focus is what stops a keyboard user being dumped at the top
      // of the document every time they close a dialog.
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="u-overlay"
      // Only a click that both starts and ends on the backdrop dismisses. A
      // plain onClick also fires when a drag began inside the dialog and
      // released outside it — closing the form mid-selection.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`u-modal ${size !== 'md' ? `u-modal-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <div className="u-modal-header">
          <div>
            <h2 className="u-modal-title" id={titleId}>{title}</h2>
            {description && <p className="u-modal-desc" id={descId}>{description}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}><X size={18} aria-hidden="true" /></IconButton>
        </div>
        {children && <div className="u-modal-body">{children}</div>}
        {footer && <div className="u-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmationDialog({
  open, onCancel, onConfirm, title, description, confirmLabel = 'Confirm',
  cancelLabel = 'Cancel', destructive, loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          {/* The filled red lives HERE and nowhere else — at the point where
              destruction is the question being asked, not scattered down a
              table where it competes with every ordinary action. */}
          <Button variant={destructive ? 'danger-solid' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ============================================================================
   TABS
   ========================================================================== */

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="u-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          className="u-tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   PAGE CHROME
   ========================================================================== */

/*
  PageHeader USED TO LIVE HERE and no longer does.

  It rendered a title, an optional sentence and an action slot — which was the
  right shape for two of the product's thirty-odd screens and could not express
  what the rest of them actually have: an icon, a status, an identifier row, a
  breadcrumb, a provenance stamp, a tab strip. Screens that needed those built
  their own header instead, which is how the product ended up with eleven.

  The replacement is ./pageHeader.tsx, re-exported from ../ui alongside these
  primitives, so `import { PageHeader } from '../../ui'` still resolves.
*/

export function PageToolbar({ children }: { children: React.ReactNode }) {
  return <div className="u-toolbar">{children}</div>;
}

export interface Crumb { label: string; onClick?: () => void }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="u-crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight aria-hidden="true" />}
            {last || !c.onClick ? (
              <span className="u-crumb-current" aria-current={last ? 'page' : undefined}>{c.label}</span>
            ) : (
              <button type="button" className="u-crumb-link" onClick={c.onClick}>{c.label}</button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ============================================================================
   AVATAR
   ========================================================================== */

export function Avatar({
  name, src, size = 'md', tone,
}: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg'; tone?: 'gold' }) {
  const initials = name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

  return (
    <span
      className={['u-avatar', size !== 'md' ? `u-avatar-${size}` : '', tone ? `u-avatar-${tone}` : ''].filter(Boolean).join(' ')}
      // The name is on the wrapper, so the image needs no duplicate alt text.
      title={name}
      aria-label={name}
      role="img"
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

/* ============================================================================
   TABLE
   ========================================================================== */

export type SortDirection = 'asc' | 'desc' | null;

export function SortableHeader({
  label, direction, onSort,
}: { label: string; direction: SortDirection; onSort: () => void }) {
  return (
    <th scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
      <button type="button" className="u-th-sort" onClick={onSort}>
        {label}
        <ChevronsUpDown aria-hidden="true" />
      </button>
    </th>
  );
}

export function TablePagination({
  page, pageSize, total, onPageChange, onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="u-pagination">
      <span>
        {total === 0 ? 'No records' : `Showing ${from}–${to} of ${total}`}
      </span>

      <div className="u-pagination-controls">
        {onPageSizeChange && (
          <label className="u-row u-gap-2">
            <span className="u-muted">Rows</span>
            {/* Wrapped, because .u-select sets appearance:none — a bare one has
                no dropdown arrow at all and reads as a text box. The chevron
                lives in .u-select-wrap. */}
            <span className="u-select-wrap">
              <select
                className="u-select"
                style={{ height: 'var(--control-height-sm)', width: 'auto', paddingRight: 'var(--eb-space-6)' }}
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {pageSizeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </label>
        )}
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span aria-live="polite">Page {page} of {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer. Return a string for automatic truncation + title tooltip. */
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
  /** Dropped below 1024px. Use for anything not needed to identify the row. */
  secondary?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: React.ReactNode;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
  compact?: boolean;
  caption?: string;
}

/**
 * One table, one set of behaviours.
 *
 * Nineteen files hand-rolled `<table>` markup, each with its own (or no)
 * loading, empty, error, sort and responsive handling. Consolidating them means
 * a fix to any of those lands everywhere at once.
 *
 * Below 720px `u-table-responsive` restacks each row into a labelled card via
 * the `data-label` attributes set here — a six-column table is unusable on a
 * phone no matter how it is scrolled.
 */
export function DataTable<T>({
  columns, rows, rowKey, loading, error, onRetry, empty,
  sortKey, sortDirection, onSort, compact, caption,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="u-table-wrap">
        <TableSkeleton rows={5} columns={columns.length} />
        <span className="u-sr-only" role="status">Loading table data</span>
      </div>
    );
  }

  if (error) {
    return <div className="u-table-wrap"><ErrorState message={error} onRetry={onRetry} /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="u-table-wrap">
        {empty ?? <EmptyState title="Nothing here yet" description="No records match the current filters." />}
      </div>
    );
  }

  return (
    <div className="u-table-wrap">
      <div className="u-table-scroll">
        <table className={`u-table u-table-responsive ${compact ? 'u-table-compact' : ''}`}>
          {caption && <caption className="u-sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) =>
                c.sortable && onSort ? (
                  <SortableHeader
                    key={c.key}
                    label={c.header}
                    direction={sortKey === c.key ? sortDirection ?? null : null}
                    onSort={() => onSort(c.key)}
                  />
                ) : (
                  <th key={c.key} scope="col" style={{ textAlign: c.align ?? 'left' }}>{c.header}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => {
                  const content = c.render(row);
                  return (
                    <td
                      key={c.key}
                      data-label={c.header}
                      style={{ textAlign: c.align ?? 'left' }}
                      // Only strings get a title: an element child would
                      // stringify to "[object Object]" in the tooltip.
                      title={typeof content === 'string' ? content : undefined}
                      className={typeof content === 'string' ? 'u-cell-truncate' : undefined}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
