/**
 * The chrome every AI Stack screen shares — ported from the LMS_K12 / G2G
 * `fees-ai-chrome` set, rebuilt on HP Brain's design tokens (ai-stack/aiStack.css)
 * because HP Brain has no Tailwind.
 *
 * Same components, same props, same wording rules. It is deliberately only chrome —
 * no data, no fetching, no knowledge of any tab — so a change here reaches every
 * module's AI Stack at once.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';

import './aiStack.css';

/** The heading strip: what the tab is, plus Refresh and whatever actions it owns. */
export function FeesAiHeader({
  icon: Icon,
  title,
  summary,
  loading = false,
  onRefresh,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  loading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="ais-header">
      <div className="ais-header-main">
        <span className="ais-header-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="ais-minw0">
          <h2 className="ais-header-title">{title}</h2>
          <p className="ais-header-summary">{summary}</p>
        </div>
      </div>

      <div className="ais-header-actions">
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="ais-btn" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'ais-spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}

/** A plain panel. Every list and form on these screens sits in one. */
export function FeesAiCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ais-card ${className}`.trim()}>{children}</div>;
}

export function FeesAiCardHeading({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="ais-card-heading">
      <div className="ais-minw0">
        <h3 className="ais-card-title">{title}</h3>
        {hint && <p className="ais-card-hint">{hint}</p>}
      </div>
      {actions}
    </div>
  );
}

export function FeesAiNotice({ children }: { children: ReactNode }) {
  return (
    <p className="ais-notice" role="status">
      <Check size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FeesAiError({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="ais-error" role="alert">
      <p className="ais-error-text">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>{children}</span>
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ais-btn ais-btn--sm ais-btn--danger">
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

/** Context the reader needs to interpret what they are looking at. Never a warning. */
export function FeesAiHint({ children }: { children: ReactNode }) {
  return (
    <p className="ais-hint">
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FeesAiLoading({ label }: { label: string }) {
  return (
    <div className="ais-loading" role="status">
      <Loader2 size={16} className="ais-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function FeesAiEmpty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ais-empty">
      <Icon size={28} className="ais-empty-icon" aria-hidden="true" />
      <p className="ais-empty-title">{title}</p>
      {children && <p className="ais-empty-body">{children}</p>}
      {action && <div className="ais-empty-action">{action}</div>}
    </div>
  );
}

/** A count with a label. Money is never invented — pass a string when there is no figure. */
export function FeesAiMetrics({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; value: string | number; hint?: string }>;
}) {
  if (!metrics.length) return null;

  return (
    <div className="ais-metrics">
      {metrics.map((metric) => (
        <div key={metric.key} className="ais-metric">
          <p className="ais-metric-label">{metric.label}</p>
          <p className="ais-metric-value">
            {typeof metric.value === 'number' ? metric.value.toLocaleString('en-IN') : metric.value}
          </p>
          {metric.hint && <p className="ais-metric-hint">{metric.hint}</p>}
        </div>
      ))}
    </div>
  );
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';

export function FeesAiPill({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ais-pill ais-pill--${tone}`}>{children}</span>;
}

/** Table head cells, so every list on these screens has the same overline treatment. */
export function FeesAiTableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className="ais-th">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Locale-stable date rendering, matching the Templates screen's `en-IN` output. */
export function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
