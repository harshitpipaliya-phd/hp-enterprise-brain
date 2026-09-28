import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Alert, Button, StatusBadge } from '../../../../ui';
import { LoadingLine, Notice } from '../../console-ui';

/**
 * The pieces ConfigurationManager and ModelManager both use — G2G kept two copies
 * of each at the bottom of both files; here they are one.
 */

/** Laravel sends a list per field; the form shows the first, as G2G's Field did. */
export function firstError(errors: Record<string, string[]>, field: string): string | undefined {
  return errors[field]?.[0];
}

/** First load, still waiting. */
export function LoadingCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="aii-card">
      <LoadingLine>{children}</LoadingLine>
    </section>
  );
}

/** First load failed: nothing to show but the reason and a way to try again. */
export function LoadErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="aii-card aii-stack">
      <Notice icon="error" title={message} />
      <div>
        <Button size="sm" onClick={onRetry} icon={<RefreshCw size={14} aria-hidden="true" />}>
          Try again
        </Button>
      </div>
    </section>
  );
}

/**
 * The save result and any later error, in one polite live region so a screen reader
 * hears "Configuration saved." without the user hunting for it.
 */
export function ResultRegion({ notice, error }: { notice: string | null; error: string | null }) {
  return (
    <div aria-live="polite" className="aii-stack">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

export function NotWiredBadge({ children = 'not wired yet' }: { children?: React.ReactNode }) {
  return <StatusBadge tone="warning">{children}</StatusBadge>;
}

export function scopeLabel(platform: boolean): string {
  return platform ? 'Platform (shared)' : 'This organisation';
}
