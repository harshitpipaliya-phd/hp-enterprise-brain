
export type HealthTone = 'good' | 'warn' | 'crit' | 'info';

export function toDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value: unknown): string {
  const date = toDate(value);
  return date ? date.toLocaleString() : 'Insufficient data';
}

export function formatShortDate(value: unknown): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : 'Insufficient data';
}

export function ageInDays(value: unknown): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export function formatAge(value: unknown): string {
  const days = ageInDays(value);
  if (days == null) return 'Insufficient data';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

export function formatNumber(value: unknown): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : 'Insufficient data';
}

export function formatDecimal(value: unknown, digits = 1): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : 'Insufficient data';
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return 'Insufficient data';
  return `${(value * 100).toFixed(digits)}%`;
}

export function average(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (value != null && Number.isFinite(value) ? value : 0), 0);
}

export function latestTimestamp(values: unknown[]): string | null {
  const latest = values
    .map(toDate)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return latest ? latest.toISOString() : null;
}

export function classifyScore(score: number | null | undefined): HealthTone {
  if (score == null || !Number.isFinite(score)) return 'info';
  if (score >= 0.7) return 'crit';
  if (score >= 0.4) return 'warn';
  return 'good';
}

export function badgeTone(status: string | null | undefined): HealthTone {
  const normalized = String(status || '').toLowerCase();
  if (['approved', 'accepted', 'completed', 'resolved', 'success', 'confirmed', 'active'].includes(normalized)) return 'good';
  if (['failed', 'rejected', 'critical', 'high', 'rolled_back', 'archived'].includes(normalized)) return 'crit';
  if (['pending', 'proposed', 'queued', 'running', 'investigating', 'supported', 'partial', 'inconclusive'].includes(normalized)) return 'warn';
  return 'info';
}

export function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function groupCount<T>(rows: T[], keyOf: (row: T) => string): Array<{ key: string; total: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    totals.set(key, (totals.get(key) || 0) + 1);
  }
  return [...totals.entries()].map(([key, total]) => ({ key, total }));
}

export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = (day + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function weeklySeries(rows: Array<{ createdDate?: string; created_date?: string }>, weeks = 8) {
  const now = new Date();
  const buckets: Array<{ label: string; value: number }> = [];
  const starts: Date[] = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = startOfWeek(new Date(now.getTime() - index * 7 * 86400000));
    starts.push(start);
    buckets.push({
      label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: 0,
    });
  }

  for (const row of rows) {
    const date = toDate((row as any).createdDate ?? (row as any).created_date);
    if (!date) continue;
    for (let index = starts.length - 1; index >= 0; index -= 1) {
      if (date >= starts[index]) {
        buckets[index].value += 1;
        break;
      }
    }
  }

  return buckets;
}

export function numericMetricFromObject(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') return null;

  const object = value as Record<string, unknown>;
  for (const key of ['value', 'actual', 'score', 'amount', 'percent', 'ratio']) {
    const candidate = object[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }

  return null;
}
