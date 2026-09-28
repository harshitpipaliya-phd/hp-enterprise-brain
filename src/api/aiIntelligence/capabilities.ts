/**
 * Client for the AI & Intelligence console — `/ai-intelligence/capabilities`.
 *
 * Read-only by design: this reports what an organisation actually holds. The
 * screens that change any of it call the configuration, template or policy
 * clients, which keeps the surface that can write small enough to audit.
 */

import { aiRequest } from './client';

export type CapabilityState = 'live' | 'empty' | 'unavailable';

export interface CapabilityMetric {
  key: string;
  label: string;
  value: number;
}

export interface CapabilityTable {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | null>>;
}

export interface CapabilitySummary {
  key: string;
  state: CapabilityState;
  count: number;
  primary_table?: string;
  missing_tables?: string[];
}

export interface CapabilityDetail {
  key: string;
  tenant_id: string;
  state: CapabilityState;
  metrics: CapabilityMetric[];
  table: CapabilityTable | null;
  missing_tables?: string[];
}

export interface CapabilityIndex {
  tenant_id: string;
  capabilities: CapabilitySummary[];
}

export function fetchCapabilities(): Promise<CapabilityIndex> {
  return aiRequest<CapabilityIndex>('/capabilities');
}

export function fetchCapability(slug: string): Promise<CapabilityDetail> {
  return aiRequest<CapabilityDetail>(`/capabilities/${encodeURIComponent(slug)}`);
}
