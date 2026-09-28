import React from 'react';
import { AlertTriangle, DatabaseZap, Loader2, RefreshCw } from 'lucide-react';

import '../aiStack.css';
import '../aiStackScreens-b.css';

/**
 * Shared surfaces for the Agent Management screens — G2G's `agents/primitives.tsx`,
 * same components and props, rebuilt on HP Brain's tokens (ais- / ais-b- classes)
 * because HP Brain has no Tailwind.
 */

/** Shared surface for every agent screen, matching the AI Stack card. */
export function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Anchor target, so a summary screen can deep-link to one card. */
  id?: string;
}) {
  return (
    <div id={id} className={`ais-card ${className}`.trim()}>
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  description,
  breadcrumb,
  onRefresh,
  refreshing,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ais-b-screen-head">
      <div className="ais-minw0">
        {breadcrumb && <p className="ais-b-overline">{breadcrumb}</p>}
        <h1 className="ais-b-screen-title">{title}</h1>
        {description && <p className="ais-b-lead">{description}</p>}
      </div>
      <div className="ais-row">
        {actions}
        {onRefresh && (
          <button type="button" onClick={onRefresh} disabled={refreshing} className="ais-btn ais-btn--sm">
            <RefreshCw size={14} className={refreshing ? 'ais-spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}

export function MetricTiles({
  metrics,
}: {
  metrics: Array<{ key: string; label: string; value: number; available?: boolean; hint?: string }>;
}) {
  if (!metrics.length) return null;

  return (
    <div className="ais-metrics ais-b-metric-tiles">
      {metrics.map((metric) => (
        <div key={metric.key} className="ais-metric">
          <p className="ais-metric-label">{metric.label}</p>
          <p className={`ais-metric-value${metric.available === false ? ' ais-b-metric-value--off' : ''}`}>
            {metric.available === false ? '—' : metric.value.toLocaleString()}
          </p>
          {metric.available === false ? (
            <p className="ais-metric-hint">store not provisioned</p>
          ) : (
            metric.hint && <p className="ais-metric-hint">{metric.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No rows for this organisation yet.',
  onRowClick,
  maxHeight = '28rem',
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  emptyMessage?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  maxHeight?: string;
}) {
  if (!columns.length) {
    return <p className="ais-b-card-note">This table has none of the expected columns in this database.</p>;
  }

  if (!rows.length) {
    return <p className="ais-b-card-note">{emptyMessage}</p>;
  }

  return (
    <div className="ais-b-scroll" style={{ maxHeight }}>
      <table className="ais-table ais-b-sticky-head ais-b-td-tight">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="ais-th">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? 'ais-b-row-click' : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className="ais-b-cell-trunc" title={cellText(row[column.key])}>
                  {cellText(row[column.key]) || <span className="ais-faint">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One cell, as a person reads it.
 *
 * A stored JSON column used to be dumped verbatim into the table — a wall of
 * braces and quoted keys nobody can scan. Structured values are summarised
 * instead: a list becomes its items, an object becomes its values, and the full
 * text still reaches the cell's tooltip via the `title` attribute.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Some columns store JSON as text; unwrap it rather than showing it raw.
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return cellText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cellText(entry)).filter(Boolean).join(', ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const text = cellText(entry);
        return text ? `${humaniseKey(key)}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }

  return String(value);
}

/** `head_user_id` -> `Head user`. Column names are schema, not English. */
export function humaniseKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').replace(/\bids?\b/gi, '').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

export function Panel({
  title,
  count,
  available,
  table,
  children,
}: {
  title: string;
  count?: number;
  available?: boolean;
  /**
   * The source table. Kept for the tooltip an administrator may want, never
   * printed: a table name under a panel heading tells a reader nothing and
   * makes the screen read like a database console.
   */
  table?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="ais-b-overflow">
      <div className="ais-b-panel-head">
        <div className="ais-minw0">
          <h2 className="ais-b-title ais-b-truncate" title={table}>
            {title}
          </h2>
        </div>
        {available === false ? (
          <span className="ais-pill ais-pill--amber">not provisioned</span>
        ) : (
          typeof count === 'number' && <span className="ais-b-count">{count.toLocaleString()}</span>
        )}
      </div>
      {available === false ? (
        <p className="ais-b-card-note ais-b-card-note--icon">
          <DatabaseZap size={16} aria-hidden="true" />
          This store is not present in the current database, so there is nothing to show.
        </p>
      ) : (
        children
      )}
    </Card>
  );
}

/** Hand-drawn horizontal bars — no chart library, as in G2G. */
export function BreakdownBars({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) return <p className="ais-b-card-note">Nothing recorded yet.</p>;
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <ul className="ais-b-bars ais-b-list-reset">
      {data.map((item) => (
        <li key={item.label} className="ais-b-bars-row">
          <span className="ais-b-bars-label" title={item.label}>
            {item.label}
          </span>
          <span className="ais-b-bars-track" aria-hidden="true">
            <span className="ais-b-bars-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </span>
          <span className="ais-b-bars-value">{item.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ais-loading" role="status">
      <Loader2 size={16} className="ais-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ais-error" role="alert">
      <div className="ais-error-text">
        <AlertTriangle size={18} aria-hidden="true" />
        <div className="ais-minw0">
          <p className="ais-b-strong" style={{ margin: 0, color: 'inherit', fontWeight: 700 }}>
            HP Brain could not load this screen
          </p>
          <p className="ais-b-mt1" style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {message}
          </p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="ais-btn ais-btn--sm ais-btn--danger ais-b-mt3">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Pill({ tone = 'gray', children }: { tone?: 'gray' | 'blue' | 'green' | 'amber'; children: React.ReactNode }) {
  return <span className={`ais-pill ais-pill--${tone}`}>{children}</span>;
}

export function HeroHeader({
  breadcrumb,
  title,
  description,
  actions,
  meta,
}: {
  breadcrumb?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section className="ais-b-hero">
      <div className="ais-row ais-row--between" style={{ alignItems: 'flex-start', gap: 'var(--space-6)' }}>
        <div className="ais-b-flex1">
          {breadcrumb && <p className="ais-b-hero-crumb">{breadcrumb}</p>}
          <h1 className="ais-b-hero-title">{title}</h1>
          {description && <p className="ais-b-hero-desc">{description}</p>}
          {meta && <div className="ais-b-hero-meta">{meta}</div>}
        </div>
        {actions && <div className="ais-row ais-b-shrink0">{actions}</div>}
      </div>
    </section>
  );
}
