import React from 'react';
import { RefreshCw } from 'lucide-react';

import { fetchCapability, type CapabilityDetail } from '../../api/aiIntelligence/capabilities';
import { describeAiError } from '../../api/aiIntelligence/client';
import { Button } from '../../ui';
import { LoadingLine, Notice, formatNumber } from './console-ui';

/**
 * What a capability actually holds for the organisation the user is signed in to.
 *
 * The registry says what a capability is for; this says whether it is configured
 * here, how much of it there is, and what it has done lately — read from HP Brain's
 * own tables. The organisation is never passed in: the server resolves it from the
 * JWT, so this cannot be pointed at another organisation by a prop.
 *
 * THREE STATES, NOT TWO. `unavailable` means the capability's tables have not been
 * migrated and names them; `empty` means they exist and hold nothing for this
 * organisation; `live` means there are rows.
 */
export function CapabilityLiveData({ slug, name }: { slug: string; name: string }) {
  const [detail, setDetail] = React.useState<CapabilityDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCapability(slug)
      .then((data) => { if (!cancelled) { setDetail(data); setError(null); } })
      .catch((cause) => { if (!cancelled) { setDetail(null); setError(describeAiError(cause)); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, reloadToken]);

  return (
    <section className="aii-card aii-card--flush">
      <header className="aii-card-head">
        <div>
          <h2 className="aii-card-title">In this organisation</h2>
          <p className="aii-card-sub">Live records for the organisation you are signed in to.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setReloadToken((t) => t + 1)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'aii-spin' : undefined} aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <div className="aii-card-body">
        {loading && !detail && !error && <LoadingLine>Loading {name}…</LoadingLine>}
        {error && <Notice icon="error" title="Could not load this capability">{error}</Notice>}
        {detail && !error && <Body detail={detail} name={name} />}
      </div>
    </section>
  );
}

function Body({ detail, name }: { detail: CapabilityDetail; name: string }) {
  if (detail.state === 'unavailable') {
    const missing = detail.missing_tables ?? [];
    return (
      <Notice title="Not installed on this deployment">
        {name} needs {missing.length === 1 ? 'a table' : 'tables'} that this database does not have yet:{' '}
        <span className="aii-mono">{missing.join(', ')}</span>. Run the HP Brain migration that creates{' '}
        {missing.length === 1 ? 'it' : 'them'} and this panel fills in.
      </Notice>
    );
  }

  const table = detail.table;
  const hasRows = !!table && table.rows.length > 0;

  return (
    <div className="aii-stack">
      {detail.metrics.length > 0 && (
        <div className="aii-grid-3">
          {detail.metrics.map((metric) => (
            <div key={metric.key} className="aii-metric">
              <p className="aii-metric-label">{metric.label}</p>
              <p className="aii-metric-value">{formatNumber(metric.value)}</p>
            </div>
          ))}
        </div>
      )}

      {!hasRows ? (
        <Notice>
          Nothing recorded for this organisation yet. The tables exist, so records will appear here as soon as {name} is used.
        </Notice>
      ) : (
        <div className="aii-table-wrap">
          <table className="aii-table">
            <thead>
              <tr>{table!.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {table!.rows.map((row, i) => (
                <tr key={i}>
                  {table!.columns.map((c) => (
                    <td key={c.key} className="aii-truncate" title={row[c.key] ?? ''}>
                      {row[c.key] ?? <span className="aii-faint">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
