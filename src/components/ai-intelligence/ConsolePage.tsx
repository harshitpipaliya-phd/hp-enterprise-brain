import React from 'react';
import { ArrowUpRight } from 'lucide-react';

import { fetchCapabilities, type CapabilitySummary } from '../../api/aiIntelligence/capabilities';
import { AI_CAPABILITIES, SOLUTIONS, capabilityRoute, capabilityStatusCounts } from './core';
import { ConsumptionPill, StatusChip, formatNumber } from './console-ui';
import { useConsoleNav } from './consoleNav';

/**
 * The AI & Intelligence console — G2G's app/ai/page.tsx.
 *
 * One screen listing every AI capability, what state it is in, how much of it this
 * organisation actually has, and which of the three products consume it today.
 * The description half is a view over the shared registry; the count half is read
 * from HP Brain's own tables.
 *
 * `Status` is a product statement (is this built). `In this organisation` is a
 * count of rows the signed-in organisation holds. They stay side by side because a
 * capability can honestly be in progress and already holding thousands of records.
 */
export default function ConsolePage() {
  const { go } = useConsoleNav();
  const counts = capabilityStatusCounts();

  // Failure is silent by design — the table is useful without the counts, and an
  // error banner over a working list would overstate what went wrong.
  const [live, setLive] = React.useState<Record<string, CapabilitySummary>>({});

  React.useEffect(() => {
    let cancelled = false;
    fetchCapabilities()
      .then((data) => {
        if (!cancelled) setLive(Object.fromEntries(data.capabilities.map((row) => [row.key, row])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="aii-page">
      <header>
        <h1 className="aii-title">AI &amp; Intelligence</h1>
        <p className="aii-lead">
          The AI capabilities this platform provides once and every module calls. HP Brain serves them from its
          own database, so what you see below is this organisation&rsquo;s own configuration and its own
          records — nothing here is shared with, or read from, another product.
        </p>
        <p className="aii-summary">
          {AI_CAPABILITIES.length} capabilities — {counts.live} live, {counts['in-progress']} in progress,{' '}
          {counts['coming-soon']} coming soon.
        </p>
      </header>

      <div className="aii-table-wrap">
        <table className="aii-table aii-table--wide">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Status</th>
              <th>In this organisation</th>
              {SOLUTIONS.map((solution) => <th key={solution.id}>{solution.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {AI_CAPABILITIES.map((capability) => (
              <tr key={capability.id}>
                <td>
                  <button type="button" className="aii-link" onClick={() => go(capabilityRoute(capability))}>
                    {capability.name}
                    <ArrowUpRight size={14} className="aii-link-arrow" aria-hidden="true" />
                  </button>
                  <p className="aii-small aii-muted" style={{ margin: '4px 0 0', maxWidth: '28rem', lineHeight: 1.5 }}>
                    {capability.purpose}
                  </p>
                </td>
                <td><StatusChip status={capability.status} size="sm" /></td>
                <td className="aii-num"><LiveCount summary={live[capability.slug]} /></td>
                {SOLUTIONS.map((solution) => (
                  <td key={solution.id}><ConsumptionPill state={capability.solutions[solution.id].today} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="aii-card">
        <h2 className="aii-card-title">How the three products share these</h2>
        <ul className="aii-stack" style={{ margin: 'var(--space-3) 0 0', padding: 0, listStyle: 'none', gap: 'var(--space-3)' }}>
          {SOLUTIONS.map((solution) => (
            <li key={solution.id} className="aii-row" style={{ alignItems: 'baseline', flexWrap: 'nowrap', gap: 'var(--space-3)' }}>
              <span style={{ width: '10rem', flexShrink: 0, fontSize: 14, fontWeight: 500 }}>{solution.label}</span>
              <span className="aii-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                {solution.description}{' '}
                {solution.kind === 'host'
                  ? 'Serves these capabilities itself; a caller’s scope rides on the signed-in user.'
                  : 'Identifies itself with the x-project-id header and a service token.'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * One capability's live record count. A dash until the counts arrive, because "0"
 * is a claim about the data and an unanswered request is not one.
 */
function LiveCount({ summary }: { summary?: CapabilitySummary }) {
  if (!summary) return <span className="aii-faint">—</span>;
  if (summary.state === 'unavailable') {
    return (
      <span className="aii-small aii-muted" title={`Not installed: ${(summary.missing_tables ?? []).join(', ')}`}>
        Not installed
      </span>
    );
  }
  if (summary.count === 0) return <span className="aii-small aii-muted">No records</span>;
  return <span style={{ fontWeight: 500 }}>{formatNumber(summary.count)}</span>;
}
