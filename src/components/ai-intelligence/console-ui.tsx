import React from 'react';
import { ArrowLeft, Check, Database, Hammer, Loader2, Lock, ServerCrash, type LucideIcon } from 'lucide-react';

import { capabilityStatusLabel, type CapabilityStatus, type ConsumptionState } from './core';

/**
 * The small pieces the AI console's screens share — G2G's console-ui.tsx, on
 * HP Brain's tokens.
 *
 * They exist so the index and the capability pages cannot word or colour the same
 * thing differently: the console's claim is that one description of a capability
 * is shown everywhere, and two screens drawing their own chips would undercut it.
 */

const STATUS_ICON: Record<CapabilityStatus, LucideIcon> = {
  live: Check,
  'in-progress': Hammer,
  'coming-soon': Lock,
};

export function StatusChip({ status, size = 'default' }: { status: CapabilityStatus; size?: 'sm' | 'default' }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`aii-chip aii-chip--${status}${size === 'sm' ? ' aii-chip--sm' : ''}`}>
      <Icon size={12} aria-hidden />
      {capabilityStatusLabel(status)}
    </span>
  );
}

// Never colour alone: each state is named, so the table reads the same to someone
// who cannot distinguish the fills.
const CONSUMPTION: Record<ConsumptionState, string> = {
  yes: 'In use',
  partial: 'Partly',
  no: 'Not yet',
};

export function ConsumptionPill({ state }: { state: ConsumptionState }) {
  return <span className={`aii-pill aii-pill--${state}`}>{CONSUMPTION[state]}</span>;
}

/** One titled block of a capability page. */
export function SectionCard({
  title, description, action, children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="aii-card">
      <div className="aii-row aii-row--between">
        <h2 className="aii-card-title">{title}</h2>
        {action}
      </div>
      {description && <p className="aii-card-desc">{description}</p>}
      {children && <div className="aii-card-content">{children}</div>}
    </section>
  );
}

/** A short list of points. */
export function PointList({ points }: { points: readonly string[] }) {
  return (
    <ul className="aii-points">
      {points.map((point) => <li key={point}>{point}</li>)}
    </ul>
  );
}

/** "← AI & Intelligence", or any other back target. */
export function BackLink({ label = 'AI & Intelligence', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" className="aii-back" onClick={onClick}>
      <ArrowLeft size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

export function LoadingLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="aii-loading" role="status">
      <Loader2 size={16} className="aii-spin" aria-hidden="true" />
      {children}
    </p>
  );
}

/** A dashed notice: nothing here yet, or something could not load. */
export function Notice({
  icon = 'database', title, children,
}: {
  icon?: 'database' | 'error';
  title?: string;
  children?: React.ReactNode;
}) {
  const Icon = icon === 'error' ? ServerCrash : Database;
  return (
    <div className="aii-empty" role={icon === 'error' ? 'alert' : undefined}>
      <Icon size={16} aria-hidden="true" />
      <div>
        {title && <p className="aii-empty-title">{title}</p>}
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

/** Dates as the rest of HP Brain shows them; a dash when there is none. */
export function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN');
}
