/**
 * Usage & Cost — what the AI spent, broken down, and the quota that bounds it.
 *
 * Ported from G2G's app/ai/usage-cost/page.tsx. Same sections, copy and flow, on
 * HP Brain's primitives and the console's aii- layout; plain tables and aii-bar
 * bars rather than a chart library.
 *
 * WHY THE COST FIGURE CARRIES A CAVEAT
 *
 * A rate is applied when a call is recorded, so calls made before anybody entered a
 * rate have no cost and never will. `cost_complete` says whether the total covers
 * every call, and this screen prints the qualification when it does not — "covers 1
 * of 2 calls" rather than a number that reads as the whole bill.
 *
 * WHY REFUSED CALLS ARE COUNTED SEPARATELY FROM FAILED ONES
 *
 * A refusal is a quota working: nothing was sent and nothing was charged. A failure
 * is a provider rejecting a request that was. Folding them together would make a
 * correctly-enforced limit look like an outage.
 */

import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

import { AiApiError, describeAiError } from '../../../api/aiIntelligence/client';
import {
  fetchUsageEvents,
  fetchUsageOptions,
  fetchUsageSummary,
  saveUsageQuota,
  type UsageEvent,
  type UsageOptions,
  type UsageQuota,
  type UsageSummary,
} from '../../../api/aiIntelligence/usage';
import { Alert, Button, Field, Select, StatusBadge, TextInput, type BadgeTone } from '../../../ui';
import { CapabilityShell } from '../CapabilityShell';
import { LoadingLine, formatNumber, formatWhen } from '../console-ui';
import './aiScreens.css';

const WINDOW_LABELS: Record<string, string> = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
};

export default function UsageCostScreen() {
  return (
    <CapabilityShell slug="usage-cost">
      <UsageConsole />
    </CapabilityShell>
  );
}

function UsageConsole() {
  const windowId = React.useId();

  const [summary, setSummary] = React.useState<UsageSummary | null>(null);
  const [events, setEvents] = React.useState<UsageEvent[]>([]);
  const [options, setOptions] = React.useState<UsageOptions | null>(null);
  const [selectedWindow, setSelectedWindow] = React.useState('month');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([fetchUsageSummary(selectedWindow), fetchUsageEvents(), fetchUsageOptions()])
      .then(([nextSummary, nextEvents, nextOptions]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setEvents(nextEvents.events);
        setOptions(nextOptions);
        setError('');
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describeAiError(cause));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWindow, reloadToken]);

  const reload = React.useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  if (loading && summary === null && error === '') {
    return (
      <div className="aii-card">
        <LoadingLine>Loading usage…</LoadingLine>
      </div>
    );
  }

  return (
    <section className="aiw-section" aria-labelledby="aiw-usage-heading">
      <header className="aiw-section-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="aiw-h2" id="aiw-usage-heading">Usage &amp; cost</h2>
          <p className="aiw-desc">
            Every model call this platform makes is counted at one point, so nothing can spend
            without appearing here. Quotas refuse a call before it reaches a provider.
          </p>
        </div>
        <div className="aiw-actions">
          <label htmlFor={windowId} className="u-sr-only">Window</label>
          <Select
            id={windowId}
            value={selectedWindow}
            onChange={(event) => {
              setLoading(true);
              setSelectedWindow(event.target.value);
            }}
          >
            {(options?.windows ?? ['day', 'week', 'month', 'quarter']).map((value) => (
              <option key={value} value={value}>
                {WINDOW_LABELS[value] ?? value}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="sm"
            onClick={reload}
            icon={<RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />}
          >
            Refresh
          </Button>
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {summary && (
        <>
          <Totals summary={summary} />
          <Quotas
            quotas={summary.quotas}
            options={options}
            onSaved={(message) => {
              setError('');
              setNotice(message);
              reload();
            }}
            onError={(message) => {
              setNotice('');
              setError(message);
            }}
          />

          <div className="aii-grid-2">
            <Breakdown
              title="By module"
              caption="Which part of the product is spending. The first question a bill raises."
              rows={summary.by_module.map((row) => ({
                key: row.ai_module,
                label: row.module_label,
                calls: row.calls,
                tokens: row.tokens,
                cost: row.estimated_cost_usd,
              }))}
            />
            <Breakdown
              title="By provider and model"
              caption="What each model costs. This is what decides which model a capability should get."
              rows={summary.by_model.map((row) => ({
                key: `${row.provider}/${row.model ?? '-'}`,
                label: `${row.provider} / ${row.model ?? 'provider default'}`,
                calls: row.calls,
                tokens: row.tokens,
                cost: row.estimated_cost_usd,
              }))}
            />
          </div>

          <Trend rows={summary.by_day} />
          <Events events={events} />
          <OtherLedgers ledgers={summary.other_ledgers} />
        </>
      )}
    </section>
  );
}

function formatCost(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(6)}`;
}

function Totals({ summary }: { summary: UsageSummary }) {
  const { totals } = summary;

  return (
    <div className="aii-stack" style={{ gap: 'var(--space-3)' }}>
      <dl className="aii-grid-3" style={{ margin: 0 }}>
        <Metric label="Model calls" value={formatNumber(totals.calls)} />
        <Metric label="Tokens" value={formatNumber(totals.total_tokens)} />
        <Metric
          label="Estimated cost"
          value={formatCost(totals.estimated_cost_usd)}
          /* The caveat, inline. See the file note on why the bare number misleads. */
          note={
            totals.estimated_cost_usd === null
              ? 'No rate is set on any model used. Add one in Model Management.'
              : totals.cost_complete
                ? undefined
                : `Covers ${totals.calls_priced} of ${totals.calls} calls — the rest ran before a rate was set.`
          }
        />
        <Metric
          label="Average latency"
          value={totals.avg_latency_ms === null ? '—' : `${totals.avg_latency_ms} ms`}
        />
      </dl>

      {(totals.failed > 0 || totals.refused > 0) && (
        <p className="aiw-flags">
          {totals.failed > 0 && (
            <span className="aiw-flag-failed">
              {totals.failed} call{totals.failed === 1 ? '' : 's'} failed at the provider
            </span>
          )}
          {/* Separate from failures on purpose — a refusal is the quota working. */}
          {totals.refused > 0 && (
            <span>{totals.refused} refused by a quota before reaching a provider (no cost)</span>
          )}
        </p>
      )}
    </div>
  );
}

function Quotas({
  quotas,
  options,
  onSaved,
  onError,
}: {
  quotas: UsageQuota[];
  options: UsageOptions | null;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [moduleKey, setModuleKey] = React.useState('');
  const [period, setPeriod] = React.useState<'day' | 'month'>('month');
  const [limit, setLimit] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    try {
      await saveUsageQuota({
        ai_module: moduleKey === '' ? null : moduleKey,
        period,
        token_limit: Number(limit),
      });
      const removed = Number(limit) === 0;
      setLimit('');
      onSaved(removed ? 'Quota removed.' : 'Quota saved.');
    } catch (cause) {
      onError(describeAiError(cause));
      if (cause instanceof AiApiError) setFieldErrors(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="aiw-panel" aria-labelledby="aiw-quotas-heading">
      <h3 className="aiw-h3" id="aiw-quotas-heading">Quotas</h3>
      <p className="aiw-caption">
        A token ceiling per period, checked before a call is sent — so a runaway hits the limit
        instead of the invoice. The narrowest quota that matches applies: a module&rsquo;s beats the
        organisation&rsquo;s.
      </p>

      {quotas.length > 0 && (
        <ul className="aiw-quotas">
          {quotas.map((quota) => (
            <li key={quota.id}>
              <div className="aii-row aii-row--between" style={{ alignItems: 'baseline' }}>
                <span className="aiw-strong" style={{ fontSize: 14 }}>
                  {quota.module_label}
                  <span className="aii-muted aii-small" style={{ marginLeft: 'var(--space-2)', fontWeight: 400 }}>
                    per {quota.period}
                  </span>
                </span>
                <span className="aii-small aii-muted aiw-num">
                  {formatNumber(quota.tokens_used)} / {formatNumber(quota.token_limit)} tokens (
                  {quota.percent_used}%)
                </span>
              </div>

              <div
                className={`aii-bar${quota.exceeded ? ' aiw-bar--danger' : quota.warning ? ' aii-bar--warn' : ''}`}
                role="progressbar"
                aria-label={`${quota.module_label} per ${quota.period}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, quota.percent_used)}
              >
                <span style={{ width: `${Math.min(100, quota.percent_used)}%` }} />
              </div>

              {/* Exceeded and warning lead to different actions, so they read differently. */}
              {quota.exceeded ? (
                <p className="aiw-quota-exceeded">
                  <ShieldAlert size={14} aria-hidden="true" />
                  Spent — calls in this scope are being refused.
                </p>
              ) : quota.warning ? (
                <p className="aiw-quota-warning">Past the {quota.warn_at_percent}% warning mark.</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="aiw-quota-form">
        <Field label="Scope" error={fieldErrors.ai_module?.[0]}>
          <Select value={moduleKey} onChange={(event) => setModuleKey(event.target.value)}>
            <option value="">Whole organisation</option>
            {(options?.modules ?? []).map((module) => (
              <option key={module.key} value={module.key}>
                {module.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Period" error={fieldErrors.period?.[0]}>
          <Select value={period} onChange={(event) => setPeriod(event.target.value as 'day' | 'month')}>
            <option value="month">Per month</option>
            <option value="day">Per day</option>
          </Select>
        </Field>

        <Field label="Token limit" required error={fieldErrors.token_limit?.[0] ?? fieldErrors.warn_at_percent?.[0]}>
          <TextInput
            required
            type="number"
            min={0}
            inputMode="numeric"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="1000000"
          />
        </Field>

        <Button type="submit" variant="primary" loading={saving} disabled={limit === ''}>
          Save
        </Button>
        <span className="aiw-hint">0 removes the quota.</span>
      </form>
    </section>
  );
}

function Breakdown({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: Array<{ key: string; label: string; calls: number; tokens: number; cost: number | null }>;
}) {
  return (
    <section className="aiw-panel">
      <h3 className="aiw-h3">{title}</h3>
      <p className="aiw-caption">{caption}</p>

      {rows.length === 0 ? (
        <p className="aiw-body aiw-body--muted" style={{ marginTop: 'var(--space-3)' }}>No calls in this window.</p>
      ) : (
        <div className="aii-table-wrap" style={{ marginTop: 'var(--space-3)' }}>
          <table className="aii-table">
            <caption className="u-sr-only">{title}</caption>
            <thead>
              <tr>
                {['Name', 'Calls', 'Tokens', 'Cost'].map((heading, index) => (
                  <th key={heading} scope="col" className={index === 0 ? undefined : 'aiw-right'}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="aii-num aiw-right aii-muted">{row.calls}</td>
                  <td className="aii-num aiw-right aii-muted">{formatNumber(row.tokens)}</td>
                  <td className="aii-num aiw-right aii-muted">{formatCost(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Trend({ rows }: { rows: UsageSummary['by_day'] }) {
  if (rows.length === 0) return null;

  const peak = Math.max(...rows.map((row) => row.tokens), 1);

  return (
    <section className="aiw-panel">
      <h3 className="aiw-h3">By day</h3>
      <p className="aiw-caption">The only breakdown that catches a runaway before the invoice does.</p>
      <ul className="aiw-trend">
        {rows.map((row) => (
          <li key={row.day}>
            <span className="aiw-trend-day">{row.day}</span>
            <span className="aii-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(2, (row.tokens / peak) * 100)}%` }} />
            </span>
            <span className="aiw-trend-value">
              {formatNumber(row.tokens)} <span aria-hidden="true">t</span><span className="u-sr-only">tokens</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Events({ events }: { events: UsageEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="aii-card aii-card--flush">
      <div className="aii-card-head">
        <div>
          <h3 className="aii-card-title">Recent calls</h3>
          <p className="aii-card-sub">
            For when a total needs explaining. &ldquo;Resolved from&rdquo; is the precedence step that
            chose the credential.
          </p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="aii-table aii-table--wide">
          <caption className="u-sr-only">Recent calls</caption>
          <thead>
            <tr>
              {['Module', 'Model', 'Resolved from', 'Tokens', 'Latency', 'Outcome', 'When'].map((heading) => (
                <th key={heading} scope="col">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{event.module_label}</td>
                <td className="aii-mono aii-muted" style={{ whiteSpace: 'nowrap' }}>
                  {event.model ?? event.provider}
                </td>
                <td className="aii-small aii-muted" style={{ whiteSpace: 'nowrap' }}>{event.source ?? '—'}</td>
                <td className="aii-num aii-muted">{formatNumber(event.input_tokens + event.output_tokens)}</td>
                <td className="aii-num aii-muted">{event.latency_ms === null ? '—' : `${event.latency_ms} ms`}</td>
                <td>
                  <OutcomeChip outcome={event.outcome} />
                  {event.error && <p className="aiw-event-error">{event.error}</p>}
                </td>
                <td className="aii-small aii-muted" style={{ whiteSpace: 'nowrap' }}>{formatWhen(event.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Counts from meters this layer does not write.
 *
 * Named rather than merged into the totals: those rows are real usage recorded by
 * another part of the system, and adding them to a figure this layer produced would
 * make neither number checkable. The keys are whatever the server reports — none are
 * named here, so a ledger the server adds shows up without a client change.
 */
function OtherLedgers({ ledgers }: { ledgers: Record<string, number | null> | null | undefined }) {
  const present = Object.entries(ledgers ?? {}).filter(
    (entry): entry is [string, number] => entry[1] !== null && entry[1] > 0,
  );

  if (present.length === 0) return null;

  return (
    <p className="aiw-dashed aii-small">
      Other usage ledgers exist in this database and are not counted above, because a different
      application writes them:{' '}
      {present.map(([table, count]) => `${table} (${formatNumber(count)} rows)`).join(', ')}.
    </p>
  );
}

function OutcomeChip({ outcome }: { outcome: string }) {
  const tone: BadgeTone = outcome === 'success' ? 'success' : outcome === 'refused' ? 'neutral' : 'danger';

  return (
    <StatusBadge tone={tone}>
      <span style={{ textTransform: 'capitalize' }}>{outcome}</span>
    </StatusBadge>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="aii-metric">
      <dt className="aii-metric-label">{label}</dt>
      <dd className="aii-metric-value" style={{ marginLeft: 0 }}>{value}</dd>
      {note && <dd className="aiw-metric-note">{note}</dd>}
    </div>
  );
}
